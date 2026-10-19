/* Site profile (sub-page, reached from Sites, dashboard, KRI detail). */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;
  var G = global.RBQM_GENERATOR;
  var chart;

  function render(contentEl, data) {
    var site = data.sites.filter(function (s) { return s.id === ROUTER.get('site'); })[0] || data.sites[0];
    var snap = G.latestFinalizedSnapshotForStudy(data.snapshots, site.studyId);
    var risk = data.siteRisk.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; })[0];
    var kriRows = data.kriResults.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; });
    var study = data.studies.filter(function (s) { return s.id === site.studyId; })[0];
    var cro = data.cros.filter(function (c) { return c.id === site.croId; })[0];
    var plan = data.monitoringPlan.filter(function (p) { return p.siteId === site.id; })[0];
    var signals = data.signals.filter(function (s) { return s.siteId === site.id; });
    var capas = data.capas.filter(function (c) { return c.siteId === site.id; });
    var subjects = data.subjects.filter(function (s) { return s.siteId === site.id; });
    var notes = (STORE.get('notes', site.id) || {}).list || [];

    contentEl.innerHTML =
      headerHtml(site, study, cro, risk) +
      stateBannerHtml(site, risk) +
      '<div style="height:10px"></div><div class="grid grid-main-side">' +
      '<div>' +
      cardTitle('Why this score') + '<div id="riskChart" style="height:220px"></div></div>' +
      '<div>' + monitoringCard(plan) + '</div>' +
      '</div>' +
      '<div style="height:10px"></div><div class="grid grid-2">' +
      signalsCard(signals) + capasCard(capas) +
      '</div>' +
      '<div style="height:10px"></div>' +
      subjectsCard(subjects) +
      '<div style="height:10px"></div>' +
      notesCard(notes, site.id);

    mountChart(kriRows);
    bindNotes(site.id);
  }

  function cardTitle(t) { return '<div class="card"><div class="card-title">' + t + '</div>'; }

  function headerHtml(site, study, cro, risk) {
    return '<div class="card"><div class="card-head">' +
      '<div><h2 style="font-size:17px">Site ' + site.code + ', ' + site.country + '</h2>' +
      '<p class="muted">PI ' + site.piInitials + ' &middot; ' + (cro ? cro.name : site.croId) + ' &middot; ' + study.id + ' - ' + study.title + ' &middot; enrollment ' + site.plannedEnrollment + '</p></div>' +
      (site.status === 'closed' ? '<span class="status-pill status-insufficient">Closed</span>' :
        risk && risk.score != null ? '<span class="risk-badge band-' + risk.band + '" style="font-size:20px">' + risk.score + '</span>' : '<span class="status-pill status-insufficient">Insufficient data</span>') +
      '</div></div>';
  }

  function stateBannerHtml(site, risk) {
    if (site.status === 'closed') {
      return '<div style="height:10px"></div><div class="empty-state card"><h3>Site closed</h3><p>This site is excluded from rankings.</p>' +
        '<a class="btn" href="sites.html">View history</a></div>';
    }
    if (!risk || risk.score == null) {
      return '<div style="height:10px"></div><div class="empty-state card"><h3>Not enough data yet</h3>' +
        '<p>This site has too few subjects for a reliable comparison. We will show a status after more data arrives.</p></div>';
    }
    return '';
  }

  function mountChart(kriRows) {
    var el = document.getElementById('riskChart');
    if (!el) return;
    if (chart) chart.dispose();
    chart = echarts.init(el);
    var active = kriRows.filter(function (r) { return r.status !== 'insufficient'; });
    chart.setOption({
      grid: { left: 100, right: 20, top: 10, bottom: 20 },
      tooltip: {},
      xAxis: { type: 'value', max: 100 },
      yAxis: { type: 'category', data: active.map(function (r) { return KRI.byCode(r.kriCode).shortName; }) },
      series: [{
        type: 'bar', barWidth: 12,
        data: active.map(function (r) { return { value: r.status === 'action' ? 100 : r.status === 'watch' ? 55 : 10, itemStyle: { color: r.status === 'action' ? '#f0503c' : r.status === 'watch' ? '#ffb133' : '#08a8a4' } }; })
      }]
    });
  }

  function monitoringCard(plan) {
    if (!plan) return cardTitle('Monitoring') + '<p class="muted">No monitoring plan item for this site.</p></div>';
    return cardTitle('Monitoring') +
      '<p><b>' + plan.recommendedType + '</b> &middot; next due ' + FMT.dateShort(plan.due) + '</p>' +
      '<p class="muted" style="font-size:11.5px">' + plan.rationale + '</p>' +
      '<p class="muted" style="font-size:11.5px">SDV scope: ' + plan.sdvScope + '</p>' +
      '<a class="btn btn-sm" href="monitoring-plan.html">Open monitoring plan</a></div>';
  }

  function signalsCard(signals) {
    return cardTitle('Signals (' + signals.length + ')') +
      (signals.length ? signals.map(function (s) {
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--c-border);font-size:11.5px">' +
          '<a href="kri-detail.html?kri=' + s.kriCode + '&site=' + s.siteId + '">' + s.id + ' - ' + (KRI.byCode(s.kriCode) ? KRI.byCode(s.kriCode).name : s.kriCode) + '</a><span>' + s.status + '</span></div>';
      }).join('') : '<p class="muted">No signals for this site.</p>') + '</div>';
  }

  function capasCard(capas) {
    return cardTitle('CAPAs (' + capas.length + ')') +
      (capas.length ? capas.map(function (c) {
        return '<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--c-border);font-size:11.5px">' +
          '<a href="issues-capa.html">' + c.id + '</a><span>' + c.state + '</span></div>';
      }).join('') : '<p class="muted">No CAPAs yet.</p>') + '</div>';
  }

  function subjectsCard(subjects) {
    return cardTitle('Subjects (' + subjects.length + ')') +
      '<table class="table"><thead><tr><th class="no-sort">Subject</th><th class="no-sort">Enrolled</th><th class="no-sort">Arm</th><th class="no-sort">Status</th></tr></thead><tbody>' +
      subjects.slice(0, 20).map(function (s) {
        return '<tr class="clickable subject-row" data-id="' + s.id + '"><td>' + s.id + '</td><td>' + FMT.dateShort(s.enrollDate) + '</td><td>' + s.arm + '</td><td>' + s.status + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (subjects.length > 20 ? '<p class="muted" style="font-size:11px">Showing 20 of ' + subjects.length + '.</p>' : '') + '</div>';
  }

  function notesCard(notes, siteId) {
    return cardTitle('Notes') +
      notes.map(function (n) { return '<div style="font-size:11.5px;padding:4px 0;border-bottom:1px solid var(--c-border)">' + n.text + ' <span class="muted">(' + FMT.dateShort(n.date) + ')</span></div>'; }).join('') +
      '<div style="margin-top:8px;display:flex;gap:6px"><input class="text-input" id="noteInput" placeholder="Add a note" style="flex:1"><button class="btn" id="addNoteBtn">Add</button></div></div>';
  }

  function bindNotes(siteId) {
    document.querySelectorAll('.subject-row').forEach(function (tr) {
      tr.addEventListener('click', function () { global.RBQM_ROUTER.navigate('subject-detail.html', { subject: tr.dataset.id, site: siteId }); });
    });
    var addBtn = document.getElementById('addNoteBtn');
    if (!addBtn) return;
    addBtn.addEventListener('click', function () {
      var input = document.getElementById('noteInput');
      if (!input.value.trim()) return;
      var notes = (STORE.get('notes', siteId) || {}).list || [];
      notes = notes.concat([{ text: input.value.trim(), date: G.iso(G.ASOF), userId: 'U-001' }]);
      STORE.patch('notes', siteId, { list: notes });
      STORE.logAudit('Site', siteId, null, 'Note added');
      global.RBQM_TOAST.show('Note added');
      global.location.reload();
    });
  }

  global.RBQM_PAGE_SITE_PROFILE = { render: render };
})(window);
