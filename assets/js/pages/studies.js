/* Studies: Table (default) and Cards views. Cards show a risk bubble map, risk/metric/mitigation numbers, the risk assessment
   version and quick links. Filters and the enrollment forecast horizon live in the URL. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;

  function studyStats(data, study) {
    var snap = global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(data.snapshots, study.id);
    var sites = data.sites.filter(function (s) { return s.studyId === study.id; });
    var highRisk = sites.filter(function (s) {
      var r = data.siteRisk.filter(function (x) { return x.siteId === s.id && x.snapshotId === snap.id; })[0];
      return r && r.band === 'high';
    }).length;
    var openSignals = data.signals.filter(function (s) { return s.studyId === study.id && global.RBQM_SIGNALS.isOpen(s.status); }).length;
    return { sites: sites.length, highRisk: highRisk, openSignals: openSignals, latestSnapshot: snap };
  }

  var ROUTER = global.RBQM_ROUTER;
  var FIELDS = [['indication', 'All indications', function (s) { return s.indication; }], ['cro', 'All CROs', function (s) { return s.cro; }],
    ['phase', 'All phases', function (s) { return 'Phase ' + s.phase; }], ['stage', 'All lifecycle stages', function (s) { return s.stage; }]];

  function horizon() { var h = parseInt(ROUTER.get('horizon', '60'), 10); return [30, 60, 90].indexOf(h) === -1 ? 60 : h; }

  /** Enrollment forecast line (actual, planned, forecast with band, projected last-subject-in date). */
  function enrollmentHtml(data, study) {
    var e = data.enrollment.filter(function (x) { return x.studyId === study.id; })[0];
    var f = global.RBQM_FORECAST.forecastEnrollment(e.series, e.target, e.plannedLastSubjectIn, horizon());
    return '<div class="banner banner-ai" style="margin-top:8px"><div><b>Enrollment:</b> ' + FMT.int(e.enrolled) + ' of ' + FMT.int(e.target) + ' enrolled (' + Math.round(e.enrolled / e.target * 100) + '%), planned last subject in ' + FMT.dateShort(e.plannedLastSubjectIn) + '. ' +
      'Forecast in ' + horizon() + ' days: ' + FMT.int(f.projected) + ' (range ' + FMT.int(f.band.low) + ' to ' + FMT.int(f.band.high) + '). ' +
      (f.projectedLastSubjectIn ? 'Projected last subject in ' + FMT.dateShort(f.projectedLastSubjectIn) + ', ' + Math.round(f.onTrackProbability * 100) + '% chance of meeting the plan.' : 'Enrollment has stalled, so no date can be projected.') + '</div></div>';
  }

  var RK = global.RBQM_RISKS;
  var CAT_ORDER = ['Participant safety', 'Data reliability', 'Endpoint integrity', 'Compliance', 'Participant rights', 'Not linked to a CtQ factor'];
  var miniTab = {};

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /** SVG bubble map: one circle per risk (this study plus "All studies"), clustered by category, coloured by level, sized by score. */
  function bubbleMap(list) {
    var cols = 3, w = 300, h = 150, cw = w / cols, ch = h / 2;
    var cats = CAT_ORDER.filter(function (c) { return list.some(function (r) { return r.category === c; }); });
    var svg = '<svg class="bubble-map" viewBox="0 0 ' + w + ' ' + h + '" role="group" aria-label="Risk bubble map">';
    CAT_ORDER.forEach(function (cat, ci) {
      var items = list.filter(function (r) { return r.category === cat; });
      if (!items.length) return;
      var cx = (ci % cols) * cw + cw / 2, cy = Math.floor(ci / cols) * ch + ch / 2 + 4;
      svg += '<text x="' + cx + '" y="' + (Math.floor(ci / cols) * ch + 10) + '" text-anchor="middle" font-size="8" fill="#707477">' + esc(cat.replace('Not linked to a CtQ factor', 'Not linked')) + '</text>';
      items.forEach(function (r, i) {
        var ang = i * 2.4, dist = i === 0 ? 0 : 11 * Math.sqrt(i), rad = 4 + r.score * 0.5;
        svg += '<circle class="bubble bubble-' + r.band + '" cx="' + (cx + Math.cos(ang) * dist).toFixed(1) + '" cy="' + (cy + Math.sin(ang) * dist).toFixed(1) + '" r="' + rad.toFixed(1) + '" tabindex="0" role="button" data-risk="' + r.id + '" aria-label="' + esc(r.id + ' ' + r.name + ', score ' + r.score) + '"><title>' + esc(r.id + ': ' + r.name + ' (score ' + r.score + ', ' + r.band + ')') + '</title></circle>';
      });
    });
    return svg + (cats.length ? '' : '<text x="150" y="80" text-anchor="middle" font-size="10" fill="#707477">No risks</text>') + '</svg>';
  }

  function studyRiskFigures(data, study) {
    var list = RK.risks(data).filter(function (r) { return r.studyId === study.id || r.studyId === 'All studies'; });
    var open = list.filter(function (r) { return r.status !== 'Accepted'; });
    var mits = list.reduce(function (acc, r) { return acc.concat(r.mitigations); }, []);
    var count = function (st) { return mits.filter(function (m) { return m.status === st; }).length; };
    return { list: list, open: open, high: open.filter(function (r) { return r.band === 'high'; }).length, noActive: open.filter(function (r) { return !r.mitigations.some(function (m) { return m.status === 'Active'; }); }).length,
      active: count('Active'), draft: count('Draft'), inactive: count('Inactive') };
  }

  function miniTabsHtml(data, study, stats, fig) {
    var cur = miniTab[study.id] || 'risks';
    var nums = { risks: [[fig.open.length, 'Open risks'], [fig.high, 'High'], [fig.noActive, 'No active mitigation']],
      metrics: [[KRI_ACTIVE(), 'Active indicators'], [stats.highRisk, 'High-risk sites'], [stats.openSignals, 'Open signals']],
      mitigations: [[fig.active, 'Active'], [fig.draft, 'Draft'], [fig.inactive, 'Inactive']] }[cur];
    return '<div class="mini-tabs" role="tablist">' + [['risks', 'Risks'], ['metrics', 'Metrics'], ['mitigations', 'Mitigations']].map(function (t) {
      return '<button role="tab" class="' + (cur === t[0] ? 'active' : '') + '" data-mini="' + study.id + '|' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="mini-nums">' + nums.map(function (n) { return '<div><b>' + n[0] + '</b><span class="muted" style="font-size:10.5px">' + n[1] + '</span></div>'; }).join('') + '</div>';
  }
  function KRI_ACTIVE() { return global.RBQM_KRI_CATALOG.KRIS.filter(function (k) { return k.active; }).length; }

  function cardHtml(data, study) {
    var stats = studyStats(data, study), fig = studyRiskFigures(data, study), cro = data.cros.filter(function (c) { return c.id === study.cro; })[0];
    var ra = data.riskAssessments.filter(function (a) { return a.studyId === study.id; })[0], q = '?study=' + study.id;
    return '<div class="card" style="margin-bottom:10px"><div class="card-head"><div><div class="card-title"><a href="study-detail.html?study=' + study.id + '">' + study.id + ' - ' + esc(study.title) + '</a></div>' +
      '<div class="card-subtitle">' + study.indication + ', Phase ' + study.phase + ' &middot; ' + (cro ? cro.name : study.cro) + ' &middot; ' + study.stage + '</div></div>' +
      '<span class="muted" style="font-size:11px">' + fig.open.length + ' open risks, ' + fig.high + ' high</span></div>' +
      '<div class="card-title" data-term="Risk bubble map" data-help="One circle per risk, grouped by category. Bigger and redder means a higher score. Click a circle for its detail." style="font-size:11px;margin:4px 0">Risk bubble map</div>' + bubbleMap(fig.list) +
      miniTabsHtml(data, study, stats, fig) +
      '<p class="muted" style="font-size:11px;margin:8px 0 0"><span data-term="Risk assessment version">Risk assessment</span> ' + ra.version + ', released ' + FMT.dateShort(ra.released) + ' <a href="#" data-history="' + study.id + '">History</a></p>' +
      '<div class="quick-links"><a href="risk-register.html' + q + '">Risk assessment</a><a href="risk-indicators.html">Indicators</a><a href="risk-register.html' + q + '&mit=Active">Mitigations</a><a href="sites.html' + q + '">Sites</a><a href="dashboard.html' + q + '">Dashboard</a></div>' +
      enrollmentHtml(data, study) + '</div>';
  }

  function tableHtml(data, shown) {
    var rows = shown.map(function (study) {
      var stats = studyStats(data, study), fig = studyRiskFigures(data, study), e = data.enrollment.filter(function (x) { return x.studyId === study.id; })[0];
      var f = global.RBQM_FORECAST.forecastEnrollment(e.series, e.target, e.plannedLastSubjectIn, horizon());
      return { study: study, stats: stats, fig: fig, e: e, f: f, cro: (data.cros.filter(function (c) { return c.id === study.cro; })[0] || {}).name || study.cro };
    });
    var cols = [
      { key: 'study', label: 'Study', render: function (r) { return '<a href="study-detail.html?study=' + r.study.id + '"><b>' + r.study.id + '</b></a> <span class="muted">' + esc(r.study.title) + '</span>'; } },
      { key: 'ind', label: 'Indication', render: function (r) { return r.study.indication; } },
      { key: 'phase', label: 'Phase', render: function (r) { return r.study.phase; } },
      { key: 'cro', label: 'CRO', render: function (r) { return r.cro; } },
      { key: 'stage', label: 'Stage', render: function (r) { return r.study.stage; } },
      { key: 'sites', label: 'Sites', render: function (r) { return r.stats.sites; } },
      { key: 'high', label: 'High-risk sites', render: function (r) { return r.stats.highRisk; } },
      { key: 'sig', label: 'Open signals', render: function (r) { return r.stats.openSignals; } },
      { key: 'risks', label: 'Open risks', render: function (r) { return r.fig.open.length + ' (' + r.fig.high + ' high)'; } },
      { key: 'enr', label: 'Enrollment', render: function (r) { return FMT.int(r.e.enrolled) + ' of ' + FMT.int(r.e.target) + (r.f.projectedLastSubjectIn ? ', last in ' + FMT.dateShort(r.f.projectedLastSubjectIn) : ''); } }
    ];
    return '<div class="card">' + global.RBQM_TABLE.render(cols, rows) + '</div>';
  }

  function render(contentEl, data) {
    draw();
    function draw() {
    var filters = {}, view = ROUTER.get('view', 'table') === 'cards' ? 'cards' : 'table';
    FIELDS.forEach(function (f) { filters[f[0]] = ROUTER.get('s_' + f[0], 'all'); });
    var shown = data.studies.filter(function (st) { return FIELDS.every(function (f) { return filters[f[0]] === 'all' || f[2](st) === filters[f[0]]; }); });
    var toolbar = '<div class="table-toolbar" style="margin-bottom:8px"><div class="seg" id="viewSeg" title="Table or cards view">' +
      [['table', 'Table'], ['cards', 'Cards']].map(function (v) { return '<button class="btn btn-sm' + (view === v[0] ? ' btn-primary' : '') + '" data-view="' + v[0] + '">' + v[1] + '</button>'; }).join('') + '</div>' + FIELDS.map(function (f) {
      var opts = Array.from(new Set(data.studies.map(f[2])));
      return '<select class="select-input" data-filter="' + f[0] + '" aria-label="' + f[1] + '"><option value="all">' + f[1] + '</option>' + opts.map(function (o) { return '<option value="' + o + '"' + (filters[f[0]] === o ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>';
    }).join('') + '<div class="spacer"></div><span class="muted" style="font-size:10.5px">Forecast</span><div class="seg" id="horizonSeg" title="How far ahead the enrollment forecast looks">' +
      [30, 60, 90].map(function (d) { return '<button class="btn btn-sm' + (d === horizon() ? ' btn-primary' : '') + '" data-horizon="' + d + '">' + d + ' days</button>'; }).join('') + '</div></div>';
    var body = shown.length ? (view === 'cards' ? shown.map(function (st) { return cardHtml(data, st); }).join('') : tableHtml(data, shown)) :
      '<div class="card"><div class="empty-state"><h3>Nothing matches these filters</h3><p>Try another indication, CRO, phase or stage.</p></div></div>';
    contentEl.innerHTML = '<div class="card-subtitle" style="margin-bottom:8px">' + shown.length + ' of ' + data.studies.length + ' studies. Click a study for its detail.</div>' + toolbar + body;
    contentEl.querySelectorAll('[data-filter]').forEach(function (sel) {
      sel.addEventListener('change', function () { var p = {}; p['s_' + sel.getAttribute('data-filter')] = sel.value === 'all' ? null : sel.value; ROUTER.set(p); draw(); });
    });
    contentEl.querySelectorAll('[data-horizon]').forEach(function (b) {
      b.addEventListener('click', function () { ROUTER.set({ horizon: b.getAttribute('data-horizon') }); draw(); });
    });
    contentEl.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { ROUTER.set({ view: b.getAttribute('data-view') === 'table' ? null : b.getAttribute('data-view') }); draw(); });
    });
    contentEl.querySelectorAll('[data-mini]').forEach(function (b) {
      b.addEventListener('click', function () { var p = b.getAttribute('data-mini').split('|'); miniTab[p[0]] = p[1]; draw(); });
    });
    contentEl.querySelectorAll('.bubble').forEach(function (c) {
      var open = function () { RK.openDetail(data, c.getAttribute('data-risk'), draw); };
      c.addEventListener('click', open);
      c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    contentEl.querySelectorAll('[data-history]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var ra = data.riskAssessments.filter(function (x) { return x.studyId === a.getAttribute('data-history'); })[0];
        global.RBQM_MODAL.open({ title: 'Risk assessment history, ' + ra.studyId, cancelLabel: false, confirmLabel: 'Close',
          bodyHtml: ra.history.map(function (h) { return '<div style="padding:6px 0;border-bottom:1px solid var(--c-border);font-size:12px"><b>' + h.version + '</b> <span class="muted">released ' + FMT.dateShort(h.released) + '</span><div>' + esc(h.note) + '</div></div>'; }).join('') });
      });
    });
    }
  }

  global.RBQM_PAGE_STUDIES = { render: render };
})(window);
