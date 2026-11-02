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

    var HB = global.RBQM_SITE_HEARTBEAT;
    var rank = rankOf(data, site, risk);

    function overviewHtml() {
      return HB.keyFiguresHtml(data, site) +
        '<div style="height:10px"></div>' + assessmentCard(site, risk) +
        '<div style="height:10px"></div><div class="grid grid-main-side">' +
        '<div>' +
        cardTitle('Why this score') + '<div id="riskChart" style="height:220px"></div></div>' +
        '<div>' + monitoringCard(plan) + '<div style="height:10px"></div>' + indicatorValuesCard(site, kriRows) + '</div>' +
        '</div>' +
        '<div style="height:10px"></div><div class="grid grid-2">' +
        signalsCard(signals) + capasCard(capas) +
        '</div>' +
        '<div style="height:10px"></div>' +
        subjectsCard(subjects) +
        '<div style="height:10px"></div>' +
        notesCard(notes, site.id);
    }

    function draw() {
      contentEl.innerHTML =
        headerHtml(site, study, cro, risk, rank, HB.periodHtml(data, site)) +
        stateBannerHtml(site, risk) +
        '<div style="height:10px"></div><div class="tabs" id="spTabs">' + [['overview', 'Overview'], ['history', 'Indicator history'], ['tickets', 'Risks and tickets']].map(function (t) {
          return '<button class="tab' + (activeTab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div data-tab-panel="overview">' + overviewHtml() + '</div>' +
        '<div data-tab-panel="history" hidden>' + HB.historyHtml(data, site) + '</div>' +
        '<div data-tab-panel="tickets" hidden>' + HB.ticketsHtml(data, site) + '</div>';
      global.RBQM_TABS.init(document.getElementById('spTabs'), function (name) { activeTab = name; if (name === 'overview') setTimeout(function () { mountChart(kriRows); }, 0); });
      mountChart(kriRows);
      bindNotes(site.id);
      bindAssessment(site, risk, draw);
      HB.bindPeriod(contentEl, draw);
      HB.bindHistory(contentEl);
      HB.bindTickets(contentEl, data, draw);
    }
    draw();
  }

  var activeTab = 'overview';

  /** Rank among the study's sites by latest risk score (1 = highest). */
  function rankOf(data, site, risk) {
    if (!risk || risk.score == null) return null;
    var snaps = {};
    var scores = data.sites.filter(function (s) { return s.studyId === site.studyId; }).map(function (s) {
      var snap = snaps[s.studyId] || (snaps[s.studyId] = G.latestFinalizedSnapshotForStudy(data.snapshots, s.studyId));
      var r = data.siteRisk.filter(function (x) { return x.siteId === s.id && x.snapshotId === snap.id; })[0];
      return r && r.score != null ? r.score : null;
    }).filter(function (v) { return v != null; });
    return { rank: scores.filter(function (v) { return v > risk.score; }).length + 1, of: data.sites.filter(function (s) { return s.studyId === site.studyId; }).length };
  }

  var LEVEL_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

  function assessmentCard(site, risk) {
    if (!risk || risk.score == null) return '';
    var a = STORE.get('notes', 'assess-' + site.id), differs = a && a.rating !== risk.band;
    return '<div class="card"><div class="card-head"><div><div class="card-title" data-term="System rating vs your assessment" data-help="Compare the system risk level with your own judgment. Your assessment never changes the score.">System rating vs your assessment</div>' +
      '<div style="font-size:12px;margin-top:3px">System rating: <span class="risk-badge band-' + risk.band + '">' + LEVEL_LABEL[risk.band] + '</span> (score ' + risk.score + ')' +
      (a ? ' &nbsp; Your assessment: <span class="risk-badge band-' + a.rating + '">' + LEVEL_LABEL[a.rating] + '</span>' + (differs ? ' <span class="status-pill status-watch">Differs from system</span>' : '') : ' &nbsp; <span class="muted">No assessment yet</span>') + '</div>' +
      (a ? '<div class="muted" style="font-size:10.5px;margin-top:2px">' + a.reason + ' (' + a.by + ', ' + FMT.dateShort(a.date) + ')</div>' : '') + '</div>' +
      '<div style="display:flex;gap:6px"><button class="btn" id="reassessBtn">Reassess</button>' + (a ? '<button class="btn" id="clearAssessBtn">Clear</button>' : '') + '</div></div></div>';
  }

  function bindAssessment(site, risk, redraw) {
    var re = document.getElementById('reassessBtn'), clr = document.getElementById('clearAssessBtn');
    if (re) re.addEventListener('click', function () {
      var cur = STORE.get('notes', 'assess-' + site.id);
      global.RBQM_MODAL.open({
        title: 'Reassess Site ' + site.code, confirmLabel: 'Save', subtitle: 'System rating: ' + LEVEL_LABEL[risk.band] + '. Your assessment does not change the score.',
        bodyHtml: '<div class="field"><label>Your assessment</label><select class="select-input" id="asRating">' + ['low', 'medium', 'high'].map(function (l) { return '<option value="' + l + '"' + ((cur ? cur.rating : risk.band) === l ? ' selected' : '') + '>' + LEVEL_LABEL[l] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Reason</label><textarea class="text-input" id="asReason" rows="3">' + (cur ? cur.reason : '') + '</textarea><div class="error" id="asErr" hidden>Enter a reason for your assessment</div></div>',
        onConfirm: function (m) {
          var reason = m.querySelector('#asReason').value.trim();
          if (!reason) { m.querySelector('#asErr').hidden = false; return false; }
          var rating = m.querySelector('#asRating').value;
          STORE.patch('notes', 'assess-' + site.id, { rating: rating, reason: reason, by: 'A. Novak', date: G.iso(G.ASOF) });
          STORE.logAudit('Site', site.id, 'U-001', 'Assessment set to ' + LEVEL_LABEL[rating] + ' (system ' + LEVEL_LABEL[risk.band] + '): ' + reason);
          global.RBQM_TOAST.show('Assessment saved'); redraw(); return true;
        }
      });
    });
    if (clr) clr.addEventListener('click', function () {
      STORE.remove('notes', 'assess-' + site.id);
      STORE.logAudit('Site', site.id, 'U-001', 'Assessment cleared');
      global.RBQM_TOAST.show('Assessment cleared'); redraw();
    });
  }

  function cardTitle(t) { return '<div class="card"><div class="card-title">' + t + '</div>'; }

  function headerHtml(site, study, cro, risk, rank, periodHtml) {
    return '<div class="card"><div class="card-head">' +
      '<div><h2 style="font-size:17px">Site ' + site.code + ', ' + site.country + '</h2>' +
      '<p class="muted">PI ' + site.piInitials + ' &middot; ' + (cro ? cro.name : site.croId) + ' &middot; ' + study.id + ' - ' + study.title + ' &middot; enrollment ' + site.plannedEnrollment + (rank ? ' &middot; rank ' + rank.rank + ' of ' + rank.of + ' in ' + study.id : '') + '</p>' + (periodHtml || '') + '</div>' +
      (site.status === 'closed' ? '<span class="status-pill status-insufficient">Closed</span>' :
        risk && risk.score != null ? '<span><span class="risk-badge band-' + risk.band + '" style="font-size:20px">' + risk.score + '</span><div>' + global.RBQM_CALC.link('siterisk|' + site.id) + '</div></span>' : '<span class="status-pill status-insufficient">Insufficient data</span>') +
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

  function indicatorValuesCard(site, kriRows) {
    var rows = kriRows.filter(function (r) { return r.status !== 'insufficient' && KRI.byCode(r.kriCode) && KRI.byCode(r.kriCode).active; });
    return cardTitle('Indicator values') + (rows.length ? rows.map(function (r) {
      var def = KRI.byCode(r.kriCode);
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--c-border);font-size:11.5px">' +
        '<a href="kri-detail.html?kri=' + r.kriCode + '&site=' + site.id + '">' + def.name + '</a>' +
        '<span><span class="status-pill status-' + r.status + '">' + FMT.statusLabel(r.status) + '</span> ' + global.RBQM_CALC.link('kri|' + site.id + '|' + r.kriCode) + '</span></div>';
    }).join('') : '<p class="muted">No indicator values yet.</p>') + '</div>';
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
