/* Addendum v0.5 data: risk statements, indicator links, mitigations, risk assessment versions, weekly site
   heartbeat (indicator history and key figures), enrollment indicator results and seeded data anomalies.
   Additive only: own seeded stream (so no existing random draw moves) and nothing here feeds a score,
   signal or count until the user acts. */
(function (global) {
  'use strict';
  var G = global.RBQM_GENERATOR;
  var REF = global.RBQM_REFERENCE;
  var KRI = global.RBQM_KRI_CATALOG;
  var STATS = global.RBQM_STATS;

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function r4(v) { return Math.round(v * 10000) / 10000; }

  // Written as noun phrases so "If {event} occurs due to {driver}, then {consequence} may result." reads naturally.
  var STATEMENTS = {
    'R-01': ['late reporting of a serious adverse event', 'site staff missing the 24-hour rule during busy visits', 'delayed safety follow-up and regulatory reporting'],
    'R-02': ['local lab samples collected or shipped outside the lab manual', 'a courier change that broke the shipping routine', 'unusable lab results and weaker data reliability'],
    'R-03': ['delayed monitoring visits', 'peak enrollment stretching CRO monitoring capacity', 'data problems staying undetected for longer'],
    'R-04': ['under-reporting of adverse events at Site 207', 'a reporting practice that differs from other sites', 'missed safety signals and a misjudged safety profile'],
    'R-05': ['unusually low variation in one site\'s data', 'possible copying or fabrication of values', 'questioned data integrity and excluded results'],
    'R-06': ['ECG recordings that cannot be evaluated', 'a device change that altered recording settings', 'lost evaluable assessments for the primary endpoint'],
    'R-07': ['late data entry and query answers in India', 'limited site staffing and time-zone gaps', 'slipping database lock and interim analyses'],
    'R-08': ['an overdue CAPA for late SAE reporting at Site 422', 'competing priorities and unclear ownership', 'a repeat of the late reporting pattern and inspection findings'],
    'R-09': ['loss of CRO monitoring staff', 'high staff turnover at the CRO', 'delayed monitoring visits and lost site knowledge'],
    'R-10': ['protocol deviations clustering in one category', 'unclear protocol wording or missing training', 'risks to participant safety and data quality'],
    'R-11': ['incomplete informed consent documentation', 'no indicator watching consent, only manual checks', 'risks to participant rights and excluded data'],
    'R-12': ['late data delivery from the CRO', 'delays in query clean-up before database lock', 'a slipped database lock timeline']
  };


  // Likelihood (%) this risk is present if the indicator fires, per linked indicator; undetected = present and not detected by any of them.
  var LINKS = {
    'R-01': [['sae_reporting_timeliness', 80], ['sae_rate', 45]], 'R-02': [['lab_noncompliance', 75]], 'R-03': [['missed_visits', 60], ['overdue_monitoring_visits', 50]],
    'R-04': [['ae_rate', 70]], 'R-05': [['data_variability', 85], ['entry_timeliness', 20]], 'R-06': [['ecg_quality', 70]], 'R-07': [['entry_timeliness', 65], ['query_response_time', 55]],
    'R-08': [['sae_reporting_timeliness', 75]], 'R-09': [['missed_visits', 40]], 'R-10': [['protocol_deviations', 65], ['missed_visits', 25]], 'R-11': [['informed_consent_issues', 55]],
    'R-12': [['query_response_time', 50], ['entry_timeliness', 35]]
  };
  var UNDETECTED = { 'R-01': 10, 'R-02': 20, 'R-03': 30, 'R-04': 25, 'R-05': 15, 'R-06': 25, 'R-07': 30, 'R-08': 15, 'R-09': 55, 'R-10': 25, 'R-11': 60, 'R-12': 45 };

  // [riskId, title, ownerId, role, schedule, goal, status, createdDaysAgo, updatedDaysAgo]
  var MITIGATIONS = [
    ['R-01', 'Weekly SAE reconciliation with the safety database', 'U-004', 'Safety lead', 'Each snapshot', 'Every SAE is in the safety database within 24 hours of site awareness.', 'Draft', 40, 12],
    ['R-01', 'Retrain Site 422 staff on the 24-hour rule', 'U-005', 'CRAs', 'Once at study start', 'All site staff confirm the reporting rule and escalation steps.', 'Draft', 33, 33],
    ['R-02', 'Agree a courier service level with the local lab', 'U-002', 'Study manager', 'Monthly', 'Samples arrive within 48 hours with temperature logs.', 'Active', 75, 20],
    ['R-02', 'Add lab sample tracking to the weekly review', 'U-006', 'Quality', 'Each snapshot', 'No sample goes untracked between site and lab.', 'Draft', 21, 21],
    ['R-03', 'Pool CRA capacity across teams during peak enrollment', 'U-002', 'Study manager', 'Monthly', 'No monitoring visit is more than 2 weeks late.', 'Inactive', 120, 60],
    ['R-03', 'Switch low-risk visits to remote checks', 'U-001', 'CRAs', 'Each snapshot', 'Free up on-site time for the highest-risk sites.', 'Inactive', 100, 45],
    ['R-04', 'Targeted visit to Site 207 for adverse event source review', 'U-005', 'CRAs', 'Once at study start', 'Compare source records with reported adverse events.', 'Draft', 28, 10],
    ['R-04', 'Medical monitor review of the adverse event listing', 'U-004', 'Safety lead', 'Monthly', 'Confirm the site rate is explained by the population.', 'Inactive', 90, 55],
    ['R-05', 'Central statistical review of data variability', 'U-003', 'Quality', 'Monthly', 'Variability indicators reviewed for every site each month.', 'Active', 110, 15],
    ['R-05', 'Source data verification at the flagged site', 'U-005', 'CRAs', 'Once at study start', 'Verify a sample of flagged values against source.', 'Active', 50, 8],
    ['R-06', 'Central review of all recordings after the device change', 'U-004', 'Safety lead', 'Each snapshot', 'Every post-change ECG is rated evaluable or not.', 'Inactive', 85, 40],
    ['R-06', 'Confirm device settings at each site', 'U-005', 'CRAs', 'Once at study start', 'All sites use the agreed recording settings.', 'Inactive', 80, 40],
    ['R-07', 'Weekly query ageing report for India sites', 'U-006', 'Study manager', 'Monthly', 'No query older than 14 days.', 'Inactive', 70, 30],
    ['R-07', 'Data entry refresher for site coordinators', 'U-005', 'CRAs', 'Once at study start', 'Median entry time under 5 days.', 'Inactive', 65, 30],
    ['R-08', 'Complete the CAPA for Site 422 SAE reporting', 'U-001', 'Quality', 'Each snapshot', 'CAPA closed with an effectiveness check.', 'Draft', 45, 5],
    ['R-08', 'Effectiveness check after two snapshots', 'U-003', 'Quality', 'Each snapshot', 'Late reports fall below 10%.', 'Draft', 45, 5],
    ['R-10', 'Monthly deviation category review', 'U-001', 'Study manager', 'Monthly', 'Repeat categories are caught within one month.', 'Inactive', 95, 50],
    ['R-10', 'Protocol clarification note to sites', 'U-002', 'Study manager', 'Once at study start', 'One agreed reading of the unclear criteria.', 'Inactive', 90, 50]
  ];

  function buildRiskDetail(risks) {
    var statements = {}, links = [], undetected = {};
    risks.forEach(function (r) {
      var s = STATEMENTS[r.id];
      if (s) statements[r.id] = { event: s[0], driver: s[1], consequence: s[2] };
      (LINKS[r.id] || []).forEach(function (l) { links.push({ riskId: r.id, kriCode: l[0], likelihoodPct: l[1] }); });
      undetected[r.id] = UNDETECTED[r.id] != null ? UNDETECTED[r.id] : 30;
    });
    var mitigations = MITIGATIONS.map(function (m, i) {
      var users = REF.USERS;
      var by = function (id) { return id; };
      return { id: 'MIT-' + String(i + 1).padStart(3, '0'), riskId: m[0], title: m[1], ownerId: m[2], role: m[3], schedule: m[4], goal: m[5], status: m[6],
        created: { by: by(m[2]), date: G.iso(G.addDays(G.ASOF, -m[7])) }, updated: { by: by(m[2]), date: G.iso(G.addDays(G.ASOF, -m[8])) } };
    });
    return { statements: statements, links: links, undetected: undetected, mitigations: mitigations, responsibleRoles: ['CRAs', 'Study manager', 'Safety lead', 'Quality'], schedules: ['Once at study start', 'Monthly', 'Each snapshot'] };
  }

  function buildRiskAssessments() {
    return [
      { studyId: 'CV-5645', version: 'v1.3', released: '2026-06-02', history: [
        { version: 'v1.3', released: '2026-06-02', note: 'Added the late SAE reporting risk and the ECG device change risk; tightened the visit window controls.' },
        { version: 'v1.2', released: '2026-02-10', note: 'Re-scored likelihood for CRO monitoring delays after the enrollment peak.' },
        { version: 'v1.0', released: '2025-11-05', note: 'First release with the five critical to quality factors.' }] },
      { studyId: 'ONC-2217', version: 'v1.1', released: '2026-05-12', history: [
        { version: 'v1.1', released: '2026-05-12', note: 'Added the data variability risk for one site.' },
        { version: 'v1.0', released: '2026-01-20', note: 'First release.' },
        { version: 'v0.9', released: '2025-12-04', note: 'Draft for steering committee review.' }] },
      { studyId: 'MET-3120', version: 'v1.2', released: '2026-04-15', history: [
        { version: 'v1.2', released: '2026-04-15', note: 'Added the local lab non-compliance risk after the courier change.' },
        { version: 'v1.1', released: '2026-01-08', note: 'Reviewed the deviation clustering risk.' },
        { version: 'v1.0', released: '2025-10-22', note: 'First release.' }] }
    ];
  }

  // ---- Enrollment indicator results (library indicators, inactive by default) -------------------
  function buildEnrollmentIndicators(rng, sites, subjects, snapshots) {
    var rows = [], bySite = {};
    subjects.forEach(function (s) { (bySite[s.siteId] = bySite[s.siteId] || []).push(s); });
    var sfDef = KRI.byCode('screen_failure_rate'), drDef = KRI.byCode('early_termination_rate');
    sites.forEach(function (site) {
      if (site.status === 'closed') return;
      var subs = bySite[site.id] || [];
      var mult = rng() < 0.07 ? 1.9 : (0.7 + rng() * 0.6);        // a few sites screen out noticeably more
      var dropMult = rng() < 0.07 ? 2.2 : (0.6 + rng() * 0.8);
      snapshots.filter(function (s) { return s.studyId === site.studyId; }).forEach(function (snap) {
        var enrolled = subs.filter(function (s) { return s.enrollDate <= snap.date; }).length;
        var dropped = subs.filter(function (s) { return s.enrollDate <= snap.date && s.discontinuationDate && s.discontinuationDate <= snap.date; }).length;
        var q = Math.min(0.6, 0.2 * mult), failures = G.binomialSample(rng, Math.max(1, enrolled), q / (1 - q) > 0.9 ? 0.9 : q / (1 - q));
        var screened = enrolled + failures;
        [[sfDef, failures, screened], [drDef, Math.min(enrolled, Math.round(dropped * dropMult)), enrolled]].forEach(function (x) {
          var def = x[0], num = x[1], den = x[2];
          if (den < 5) { rows.push({ snapshotId: snap.id, siteId: site.id, kriCode: def.code, numerator: null, denominator: null, value: null, status: 'insufficient', ciLow: null, ciHigh: null }); return; }
          var v = num / den, ci = STATS.binomialCI(num, den, 0.95);
          rows.push({ snapshotId: snap.id, siteId: site.id, kriCode: def.code, numerator: num, denominator: den, value: r4(v), status: G.statusForValue(def, v, false), ciLow: r4(ci.low), ciHigh: r4(ci.high) });
        });
      });
    });
    return rows;
  }

  // ---- Weekly heartbeat for 9 high-risk and 6 other sites ----------------------------------------
  var HEARTBEAT_CODES = ['sae_rate', 'ae_rate', 'entry_timeliness', 'query_response_time', 'manual_query_rate', 'open_queries_30d', 'protocol_deviations', 'missed_visits',
    'screen_failure_rate', 'early_termination_rate', 'lab_noncompliance', 'ecg_quality'];

  function weekDates() {
    var out = [];
    for (var i = 11; i >= 0; i--) out.push(G.iso(G.addDays(G.ASOF, -7 * i)));
    return out;
  }

  function cumulative(dates, weeks) {
    return weeks.map(function (w) { return dates.filter(function (d) { return d <= w; }).length; });
  }

  function buildHeartbeat(rng, base, enrollRows) {
    var latest = {};
    base.siteRisk.forEach(function (r) { if (r.score != null) { var c = latest[r.siteId]; if (!c || r.snapshotId > c.snapshotId) latest[r.siteId] = r; } });
    var ids = Object.keys(latest);
    var high = ids.filter(function (id) { return latest[id].band === 'high'; }).sort(function (a, b) { return latest[b].score - latest[a].score || (a < b ? -1 : 1); });
    var others = ids.filter(function (id) { return latest[id].band !== 'high'; }).sort(function (a, b) { return latest[b].score - latest[a].score || (a < b ? -1 : 1); }).slice(0, 6);
    var siteIds = high.concat(others), weeks = weekDates(), out = {};
    var rowsBy = function (list, siteId, code) { return list.filter(function (r) { return r.siteId === siteId && r.kriCode === code; }); };

    siteIds.forEach(function (siteId) {
      var site = base.sites.filter(function (s) { return s.id === siteId; })[0];
      var snaps = base.snapshots.filter(function (s) { return s.studyId === site.studyId; }).sort(function (a, b) { return a.index - b.index; });
      var finals = snaps.filter(function (s) { return s.status === 'Finalized'; });
      var latestSnap = finals[finals.length - 1];
      var nearest = function (w) { var c = finals.filter(function (s) { return s.date <= w; }); return (c.length ? c[c.length - 1] : finals[0]).id; };
      var indicators = {};
      HEARTBEAT_CODES.forEach(function (code) {
        var def = KRI.byCode(code);
        var src = (code === 'screen_failure_rate' || code === 'early_termination_rate') ? enrollRows : base.kriResults;
        var fin = rowsBy(src, siteId, code).filter(function (r) { return r.snapshotId === latestSnap.id; })[0];
        if (!def || !fin) { indicators[code] = weeks.map(function (w) { return { date: w, value: null, status: 'insufficient', snapshotId: nearest(w) }; }); return; }
        var rising = fin.status === 'action' ? 0.45 : (fin.status === 'watch' ? 0.25 : 0.05), dir = def.flagDirection === 'low' ? -1 : 1;
        indicators[code] = weeks.map(function (w, i) {
          var cell = { date: w, snapshotId: nearest(w) };
          if (fin.status === 'insufficient' || fin.value == null || (site.isNew && i < 4)) { cell.value = null; cell.status = 'insufficient'; return cell; }
          if (i === 11) { cell.value = fin.value; cell.status = fin.status; cell.numerator = fin.numerator; cell.denominator = fin.denominator; return cell; }
          var v = fin.value * (1 - dir * rising * (11 - i) / 11) * (0.92 + rng() * 0.16);
          cell.value = r4(Math.max(0, v)); cell.status = G.statusForValue(def, cell.value, false);
          return cell;
        });
      });

      var subs = base.subjects.filter(function (s) { return s.siteId === siteId; });
      var enrolledSeries = cumulative(subs.map(function (s) { return s.enrollDate; }), weeks);
      var aeDates = base.adverseEvents.filter(function (e) { return e.siteId === siteId && !e.serious; }).map(function (e) { return e.onset; });
      var saeDates = base.adverseEvents.filter(function (e) { return e.siteId === siteId && e.serious; }).map(function (e) { return e.onset; });
      var devDates = base.deviations.filter(function (d) { return d.siteId === siteId; }).map(function (d) { return d.detectedDate || d.date; });
      var sfFin = rowsBy(enrollRows, siteId, 'screen_failure_rate').filter(function (r) { return r.snapshotId === latestSnap.id; })[0];
      var sfTotal = sfFin && sfFin.numerator != null ? sfFin.numerator : 0, lastEnrolled = enrolledSeries[11] || 1;
      var oq = rowsBy(base.kriResults, siteId, 'open_queries_30d').filter(function (r) { return r.snapshotId === latestSnap.id; })[0];
      var overdue = oq && oq.value != null ? Math.round(oq.value * 170) : 0;
      var oqRise = oq && oq.status === 'action' ? 0.5 : 0.15;
      var kf = {
        aes: cumulative(aeDates, weeks), saes: cumulative(saeDates, weeks), deviations: cumulative(devDates, weeks), enrolled: enrolledSeries,
        screeningFailures: enrolledSeries.map(function (e) { return Math.round(sfTotal * e / lastEnrolled); }),
        overdueQueries: weeks.map(function (w, i) { return i === 11 ? overdue : Math.max(0, Math.round(overdue * (1 - oqRise * (11 - i) / 11) * (0.9 + rng() * 0.2))); })
      };
      out[siteId] = { indicators: indicators, keyFigures: kf };
    });
    return { weeks: weeks, siteIds: siteIds, highRiskSiteIds: high, bySite: out, indicatorCodes: HEARTBEAT_CODES };
  }

  // ---- Data anomalies ------------------------------------------------------------------------------
  // [siteCode, type, variable, evidence, score, status, daysAgo]
  var ANOMALIES = [
    ['415', 'Too little variation', 'Temperature', '14 temperature readings with no variation across 6 subjects.', 91, 'Under review', 6],
    ['422', 'Digit preference', 'Systolic blood pressure', '68% of readings end in 0 or 5, against about 20% expected.', 78, 'New', 4],
    ['052', 'Duplicate values', 'ALT', '9 pairs of subjects with identical lab values on the same day.', 71, 'New', 9],
    ['207', 'Round-number bias', 'Weight', '41% of weights recorded as whole kilograms ending in 0, against about 10% expected.', 64, 'New', 11],
    ['301', 'Unusual recruitment speed', 'Enrollment', '7 subjects enrolled in 3 days, about 4 times the site average.', 58, 'Under review', 15],
    ['143', 'Too little variation', 'Heart rate', '11 heart rate readings with a spread under 1 beat per minute.', 52, 'New', 3],
    ['089', 'Digit preference', 'Diastolic blood pressure', '49% of readings end in 0, against about 10% expected.', 44, 'Dismissed', 22],
    ['018', 'Duplicate values', 'Weight', '5 subjects with the same weight on consecutive visits.', 38, 'New', 8]
  ];

  function buildAnomalies(base) {
    var rows = [];
    ANOMALIES.forEach(function (a, i) {
      var site = base.sites.filter(function (s) { return s.code === a[0]; })[0];
      if (!site) return;
      rows.push({ id: 'ANOM-' + (i + 1), siteId: site.id, studyId: site.studyId, type: a[1], variable: a[2], evidence: a[3], score: a[4], status: a[5],
        detected: G.iso(G.addDays(G.ASOF, -a[6])), dismissReason: a[5] === 'Dismissed' ? 'Explained by a known rounding convention at this site.' : null });
    });
    // Visibility gaps: sites with the least recent data, too little to run the tests (Insufficient data, not a pass).
    var cutoff = G.iso(G.addDays(G.ASOF, -84)), counts = {};
    base.visits.forEach(function (v) { if (v.plannedDate >= cutoff) counts[v.siteId] = (counts[v.siteId] || 0) + 1; });
    var gaps = base.sites.filter(function (s) { return s.status === 'active'; }).map(function (s) { return { siteId: s.id, visits: counts[s.id] || 0 }; })
      .sort(function (a, b) { return a.visits - b.visits || (a.siteId < b.siteId ? -1 : 1); }).slice(0, 3)
      .map(function (g) { return { siteId: g.siteId, reason: 'Only ' + g.visits + ' visit' + (g.visits === 1 ? '' : 's') + ' in the last 12 weeks' + (g.visits < 10 ? ', too few to test.' : ', among the lowest data volumes, so the tests are not reliable.') }; });
    return { rows: rows, types: ['Too little variation', 'Digit preference', 'Duplicate values', 'Unusual recruitment speed', 'Round-number bias'], visibilityGaps: gaps };
  }

  function buildAddendum2(base) {
    var rng = G.mulberry32(20260801);
    var enrollmentIndicatorRows = buildEnrollmentIndicators(rng, base.sites, base.subjects, base.snapshots);
    return {
      riskDetail: buildRiskDetail(base.risks),
      riskAssessments: buildRiskAssessments(),
      enrollmentIndicatorRows: enrollmentIndicatorRows,
      heartbeat: buildHeartbeat(rng, base, enrollmentIndicatorRows),
      anomalies: buildAnomalies(base)
    };
  }

  global.RBQM_GENERATOR = Object.assign(G, { buildAddendum2: buildAddendum2 });
})(window);
