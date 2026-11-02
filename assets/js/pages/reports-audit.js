/* Reports and audit: Executive brief, Snapshots and audit trail, Saved reports tabs. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var audience = 'Steering committee';

  function render(contentEl, data) {
    function draw() {
      contentEl.innerHTML =
        '<div class="tabs" id="raTabs"><button class="tab active" data-tab="brief">Executive brief</button>' +
        '<button class="tab" data-tab="audit">Snapshots and audit trail</button>' +
        '<button class="tab" data-tab="saved">Saved reports</button></div>' +
        '<div data-tab-panel="brief">' + briefHtml(data) + '</div>' +
        '<div data-tab-panel="audit" hidden>' + auditHtml(data) + '</div>' +
        '<div data-tab-panel="saved" hidden>' + savedHtml() + '</div>';

      global.RBQM_TABS.init(document.getElementById('raTabs'));
      bindBrief(data);
      bindAudit(data);
      bindSaved();
    }

    function briefHtml(data) {
      var s = data.summary;
      var topRisks = data.risks.filter(function (r) { return r.score >= 15; }).slice(0, 3);
      return '<div class="card" style="max-width:720px">' +
        '<div class="table-toolbar"><select class="select-input" id="audienceSelect">' +
        ['Steering committee', 'Quality', 'Study team'].map(function (a) { return '<option value="' + a + '"' + (audience === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') +
        '</select><div class="spacer"></div>' +
        '<button class="btn" id="regenBriefBtn">Regenerate draft</button><button class="btn" id="copyBriefBtn">Copy as text</button>' +
        '<button class="btn" id="printBriefBtn">Print or save as PDF</button><button class="btn btn-primary" id="addToReportBtn">Add to report</button></div>' +
        '<div id="briefBody">' + briefBody(data) + '</div></div>';
    }

    function briefBody(data) {
      var s = data.summary;
      var topRisks = data.risks.filter(function (r) { return r.score >= 15; }).slice(0, 3);
      return '<h2 style="font-size:16px">Portfolio brief for ' + audience + '</h2>' +
        '<p><b>Headline:</b> Portfolio health ' + s.healthScore + ', ' + s.highRiskSites + ' of ' + s.totalSites + ' sites need attention, ' + s.openSignals + ' open signals, ' + s.overdueCapas + ' overdue CAPAs.</p>' +
        '<p><b>Key risks:</b> ' + topRisks.map(function (r) { return r.description; }).join('; ') + '.</p>' +
        '<p><b>Trend vs last snapshot:</b> health score down 3, high-risk sites up 2, open signals down 5.</p>' +
        '<p><b>Decisions needed:</b> ' + s.overdueCapas + ' overdue CAPAs need an owner decision; ' + s.qtlsAtRisk + ' quality limits need Quality review.</p>' +
        '<p><b>Forecast:</b> late SAE reporting has an 82% chance of staying in breach over the next 60 days without action.</p>' +
        '<p><b>Value delivered:</b> ' + s.roi.visitsAvoided + ' on-site visits avoided, ' + FMT.int(s.roi.sdvHoursSaved) + ' SDV hours saved, ' + FMT.usd(s.roi.costAvoidedUsd) + ' estimated cost avoided.</p>';
    }

    function bindBrief(data) {
      var sel = document.getElementById('audienceSelect');
      if (!sel) return;
      sel.addEventListener('change', function (e) { audience = e.target.value; document.getElementById('briefBody').innerHTML = briefBody(data); });
      document.getElementById('regenBriefBtn').addEventListener('click', function () { document.getElementById('briefBody').innerHTML = briefBody(data); global.RBQM_TOAST.show('Brief regenerated'); });
      document.getElementById('copyBriefBtn').addEventListener('click', function () {
        var text = document.getElementById('briefBody').textContent;
        if (global.navigator.clipboard) global.navigator.clipboard.writeText(text).catch(function () {});
        global.RBQM_TOAST.show('Brief copied as text');
      });
      document.getElementById('printBriefBtn').addEventListener('click', function () { global.print(); });
      document.getElementById('addToReportBtn').addEventListener('click', function () {
        STORE.push('reportItems', { id: 'RPT-' + Date.now(), title: 'Executive brief - ' + audience, date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF), body: document.getElementById('briefBody').innerHTML });
        STORE.logAudit('Report', 'exec-brief', null, 'Added to saved reports');
        global.RBQM_TOAST.show('Added to report');
        draw();
      });
    }

    var auditColumns = [
      { key: 'entity', label: 'Entity' }, { key: 'entityId', label: 'ID' }, { key: 'userId', label: 'User' },
      { key: 'action', label: 'Action' }, { key: 'timestamp', label: 'When', render: function (r) { return FMT.dateShort(r.timestamp); } }
    ];
    function auditHtml(data) {
      return '<div class="card"><div class="table-toolbar"><div class="card-title">Audit trail</div><div class="spacer"></div><button class="btn" id="auditExportBtn">Export CSV</button></div>' +
        global.RBQM_TABLE.render(auditColumns, data.auditEvents.slice().reverse()) + '</div>';
    }
    function bindAudit(data) {
      var btn = document.getElementById('auditExportBtn');
      if (btn) btn.addEventListener('click', function () { global.RBQM_TABLE.downloadCsv('audit-trail.csv', auditColumns, data.auditEvents); global.RBQM_TOAST.show('Export ready: audit-trail.csv'); });
    }

    function savedHtml() {
      var items = STORE.get('reportItems') || [];
      if (!items.length) return '<div class="empty-state"><h3>Save your first view</h3><p>Use "Add to report" from the Executive brief or other pages.</p></div>';
      return '<div class="card">' + items.map(function (it) {
        return '<div class="card-head" style="padding:8px 0;border-bottom:1px solid var(--c-border)">' +
          '<div><b>' + it.title + '</b><div class="muted" style="font-size:10.5px">' + FMT.dateShort(it.date) + '</div></div>' +
          '<div style="display:flex;gap:6px"><button class="btn btn-sm view-report-btn" data-id="' + it.id + '">View</button><button class="btn btn-sm btn-danger remove-report-btn" data-id="' + it.id + '">Remove</button></div></div>';
      }).join('') + '</div>';
    }
    function bindSaved() {
      document.querySelectorAll('.view-report-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var items = STORE.get('reportItems') || [];
          var it = items.filter(function (i) { return i.id === b.dataset.id; })[0];
          global.RBQM_MODAL.open({ title: it.title, cancelLabel: false, confirmLabel: 'Close', bodyHtml: it.body });
        });
      });
      document.querySelectorAll('.remove-report-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var items = (STORE.get('reportItems') || []).filter(function (i) { return i.id !== b.dataset.id; });
          STORE.setArray('reportItems', items);
          global.RBQM_TOAST.show('Removed from saved reports');
          draw();
        });
      });
    }

    draw();
  }

  global.RBQM_PAGE_REPORTS_AUDIT = { render: render };
})(window);
