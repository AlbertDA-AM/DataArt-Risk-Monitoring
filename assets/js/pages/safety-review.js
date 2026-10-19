/* Safety review: AE listing and AE trends tabs, SAE reporting timeliness, Medical Monitor
   notes. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;

  function render(contentEl, data) {
    var filters = { serious: 'all', study: 'all' };
    var tab = 'listing';

    function draw() {
      var serious = data.adverseEvents.filter(function (e) { return e.serious; });
      var withinWindow = serious.filter(function (e) { return e.withinReportingWindow; }).length;
      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div>' +
        '<b>' + serious.length + ' serious adverse events.</b> ' + Math.round((withinWindow / (serious.length || 1)) * 100) + '% reported within 24 hours.</div></div>' +
        '<div style="height:10px"></div>' +
        '<div class="tabs" id="srTabs"><button class="tab' + (tab === 'listing' ? ' active' : '') + '" data-tab="listing">AE listing</button>' +
        '<button class="tab' + (tab === 'trends' ? ' active' : '') + '" data-tab="trends">AE trends</button></div>' +
        '<div data-tab-panel="listing"' + (tab !== 'listing' ? ' hidden' : '') + '>' + listingHtml() + '</div>' +
        '<div data-tab-panel="trends"' + (tab !== 'trends' ? ' hidden' : '') + '>' + trendsHtml(data) + '</div>';

      document.getElementById('srTabs').querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { tab = t.dataset.tab; draw(); }); });
      bindListing();
    }

    var columns;
    function listingHtml() {
      var rows = data.adverseEvents.filter(function (e) {
        if (filters.serious !== 'all' && String(e.serious) !== filters.serious) return false;
        if (filters.study !== 'all' && e.studyId !== filters.study) return false;
        return true;
      }).slice(0, 300);
      columns = [
        { key: 'id', label: 'ID' }, { key: 'term', label: 'Term' },
        { key: 'serious', label: 'Serious', render: function (r) { return r.serious ? '<span class="status-pill status-action">SAE</span>' : '<span class="status-pill status-ok">AE</span>'; } },
        { key: 'severity', label: 'Severity' }, { key: 'relatedness', label: 'Relatedness' },
        { key: 'site', label: 'Site', render: function (r) { var s = data.sites.filter(function (x) { return x.id === r.siteId; })[0]; return s ? 'Site ' + s.code : r.siteId; } },
        { key: 'onset', label: 'Onset', render: function (r) { return FMT.dateShort(r.onset); } },
        { key: 'window', label: 'Reported in 24h', render: function (r) { return r.serious ? (r.withinReportingWindow ? '<span class="status-pill status-ok">Yes</span>' : '<span class="status-pill status-action">No</span>') : '–'; } },
        { key: 'notes', label: '', sortable: false, render: function (r) { return '<button class="btn btn-sm mm-note-btn" data-id="' + r.id + '">Medical Monitor note</button>'; } }
      ];
      return '<div class="card"><div class="table-toolbar">' +
        '<select class="select-input" id="seriousFilter"><option value="all">AE and SAE</option><option value="true">SAE only</option><option value="false">AE only</option></select>' +
        '<select class="select-input" id="studyFilterLocal"><option value="all">All studies</option>' + data.studies.map(function (s) { return '<option value="' + s.id + '">' + s.id + '</option>'; }).join('') + '</select>' +
        '<div class="spacer"></div><span class="muted" style="font-size:11px">Showing ' + rows.length + '</span></div>' +
        global.RBQM_TABLE.render(columns, rows) + '</div>';
    }

    function bindListing() {
      var sSel = document.getElementById('seriousFilter'), stSel = document.getElementById('studyFilterLocal');
      if (sSel) sSel.addEventListener('change', function (e) { filters.serious = e.target.value; draw(); });
      if (stSel) stSel.addEventListener('change', function (e) { filters.study = e.target.value; draw(); });
      document.querySelectorAll('.mm-note-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          global.RBQM_MODAL.open({
            title: 'Medical Monitor note: ' + b.dataset.id, confirmLabel: 'Save',
            bodyHtml: '<div class="field"><label>Note</label><textarea class="text-input" id="mmNote" rows="3"></textarea></div>',
            onConfirm: function (modalEl) {
              var val = modalEl.querySelector('#mmNote').value.trim();
              if (!val) return false;
              STORE.patch('notes', 'ae-' + b.dataset.id, { text: val, date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF) });
              STORE.logAudit('AdverseEvent', b.dataset.id, null, 'Medical Monitor note added');
              global.RBQM_TOAST.show('Note saved');
              return true;
            }
          });
        });
      });
    }

    function trendsHtml(data) {
      var byTerm = {};
      data.adverseEvents.forEach(function (e) { byTerm[e.term] = (byTerm[e.term] || 0) + 1; });
      var ranked = Object.keys(byTerm).map(function (t) { return { term: t, count: byTerm[t] }; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
      var max = ranked.length ? ranked[0].count : 1;
      return '<div class="card"><div class="card-title">Most frequent terms</div>' +
        ranked.map(function (r) {
          return '<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:11.5px"><span>' + r.term + '</span><span>' + r.count + '</span></div>' +
            '<div style="height:7px;background:var(--c-panel);border-radius:4px"><div style="height:100%;width:' + Math.round((r.count / max) * 100) + '%;background:var(--c-blue-400);border-radius:4px"></div></div></div>';
        }).join('') + '</div>';
    }

    draw();
  }

  global.RBQM_PAGE_SAFETY_REVIEW = { render: render };
})(window);
