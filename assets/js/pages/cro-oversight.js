/* CRO oversight: scorecard per CRO (query response, entry, missed visits, overdue CAPAs,
   actions), Request CRO action / Send reminder (simulated, tracked). */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var CAPA_ENGINE = global.RBQM_CAPA;
  var CFG = global.RBQM_CONFIG;
  var G = global.RBQM_GENERATOR;

  function avgKri(data, siteIds, code) {
    var vals = [];
    var byStudy = {};
    siteIds.forEach(function (id) { var s = data.sites.filter(function (x) { return x.id === id; })[0]; if (s) byStudy[s.studyId] = byStudy[s.studyId] || G.latestFinalizedSnapshotForStudy(data.snapshots, s.studyId); });
    siteIds.forEach(function (id) {
      var s = data.sites.filter(function (x) { return x.id === id; })[0];
      if (!s) return;
      var snap = byStudy[s.studyId];
      var r = data.kriResults.filter(function (x) { return x.siteId === id && x.kriCode === code && x.snapshotId === snap.id; })[0];
      if (r && r.value != null) vals.push(r.value);
    });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  function render(contentEl, data) {
    draw();

    function draw() {
      var worstCro = data.cros.map(function (c) { return { c: c, v: avgKri(data, data.sites.filter(function (s) { return s.croId === c.id; }).map(function (s) { return s.id; }), 'query_response_time') }; })
        .sort(function (a, b) { return (b.v || 0) - (a.v || 0); })[0];
      contentEl.innerHTML =
        '<div class="card-subtitle" style="margin-bottom:8px">' + (worstCro ? worstCro.c.name + ' is slowest on query response time.' : '') + '</div>' +
        data.cros.map(croCard).join('') +
        '<div class="card"><div class="card-title">Open actions with CROs</div>' + actionsList() + '</div>';

      document.querySelectorAll('.cro-request-btn').forEach(function (b) {
        b.addEventListener('click', function () { requestAction(b.dataset.cro); });
      });
      document.querySelectorAll('.cro-reminder-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          STORE.logAudit('CRO', b.dataset.id, null, 'Reminder sent');
          global.RBQM_TOAST.show('Reminder sent');
        });
      });
    }

    function croCard(cro) {
      var siteIds = data.sites.filter(function (s) { return s.croId === cro.id; }).map(function (s) { return s.id; });
      var overdueCapas = data.capas.filter(function (c) { return siteIds.indexOf(c.siteId) !== -1 && CAPA_ENGINE.isOverdue(c, CFG.asOfDate); }).length;
      var measures = [
        ['Query response time', avgKri(data, siteIds, 'query_response_time'), 7, 'd', 'high'],
        ['Data entry timeliness', avgKri(data, siteIds, 'entry_timeliness'), 5, 'd', 'high'],
        ['Missed visits', avgKri(data, siteIds, 'missed_visits'), 0.05, '%', 'high'],
        ['Open queries over 30 days', avgKri(data, siteIds, 'open_queries_30d'), 0.05, '%', 'high']
      ];
      return '<div class="card" style="margin-bottom:10px"><div class="card-head"><div class="card-title">' + cro.name + '</div>' +
        '<div style="display:flex;gap:6px"><button class="btn btn-sm cro-reminder-btn" data-id="' + cro.id + '">Send reminder</button>' +
        '<button class="btn btn-sm btn-primary cro-request-btn" data-cro="' + cro.id + '">Request CRO action</button></div></div>' +
        '<div class="grid grid-6">' + measures.map(function (m) {
          var val = m[1];
          var display = val == null ? '–' : (m[3] === '%' ? FMT.pct(val, 1) : Math.round(val) + m[3]);
          var over = val != null && val > m[2];
          return '<div><div style="font-size:15px;font-weight:700" class="' + (over ? 'muted' : '') + '">' + display + '</div>' +
            '<div class="muted" style="font-size:10px">' + m[0] + (over ? ' <span class="status-pill status-watch">above target</span>' : '') + '</div></div>';
        }).join('') +
        '<div><div style="font-size:15px;font-weight:700">' + overdueCapas + '</div><div class="muted" style="font-size:10px">CAPAs overdue</div></div>' +
        '<div><div style="font-size:15px;font-weight:700">' + siteIds.length + '</div><div class="muted" style="font-size:10px">Sites</div></div>' +
        '</div></div>';
    }

    function actionsList() {
      var items = data.capas.filter(function (c) { return c.state !== 'Closed'; }).slice(0, 6);
      if (!items.length) return '<p class="muted">No open actions.</p>';
      return items.map(function (c) {
        var site = data.sites.filter(function (s) { return s.id === c.siteId; })[0];
        var cro = data.cros.filter(function (x) { return x.id === site.croId; })[0];
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--c-border);font-size:11.5px">' +
          '<span>' + c.id + ' - ' + (cro ? cro.name : site.croId) + ' - Site ' + site.code + '</span><a href="issues-capa.html">Open</a></div>';
      }).join('');
    }

    function requestAction(croId) {
      var cro = data.cros.filter(function (c) { return c.id === croId; })[0];
      global.RBQM_MODAL.open({
        title: 'Request CRO action', subtitle: cro.name, confirmLabel: 'Send request',
        bodyHtml: '<div class="field"><label>Request</label><textarea class="text-input" id="croRequest" rows="3" placeholder="Describe the action needed"></textarea></div>',
        onConfirm: function (modalEl) {
          var val = modalEl.querySelector('#croRequest').value.trim();
          if (!val) return false;
          STORE.logAudit('CRO', croId, null, 'Action requested: ' + val);
          global.RBQM_TOAST.show('Request sent to ' + cro.name);
          return true;
        }
      });
    }
  }

  global.RBQM_PAGE_CRO_OVERSIGHT = { render: render };
})(window);
