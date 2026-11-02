/* Addendum v0.4 data: protocol analysis, subject medical depth (Site 114 + three Safety review
   subjects only), enrollment series, deviation root causes and detection latency, QA audit rows,
   savings calculator defaults. Additive only: uses its OWN seeded stream so the main generator's
   random sequence (and every headline number) is untouched. */
(function (global) {
  'use strict';
  var G = global.RBQM_GENERATOR;
  var REF = global.RBQM_REFERENCE;

  var ROOT_CAUSE_GROUPS = [
    { id: 'training', name: 'Training gap', hint: 'Staff were not trained or retrained on the requirement.' },
    { id: 'process', name: 'Process gap', hint: 'The site workflow does not cover the requirement.' },
    { id: 'equipment', name: 'Equipment', hint: 'A device, supply or system problem caused the miss.' },
    { id: 'ambiguity', name: 'Protocol ambiguity', hint: 'The protocol wording allowed more than one reading.' }
  ];
  // Primary group per deviation category; 30% of records fall into another group.
  var CATEGORY_GROUP = {
    'Eligibility': 'ambiguity', 'Informed consent': 'training', 'Visit window': 'process',
    'Prohibited medication': 'training', 'Dosing': 'equipment', 'Procedure not followed': 'process'
  };

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function round(v, d) { var m = Math.pow(10, d); return Math.round(v * m) / m; }

  /** Deviations: add occurredDate, detectedDate (existing `date` is the detection date) and rootCause. */
  function extendDeviations(rng, deviations) {
    deviations.forEach(function (d) {
      var slow = d.siteId === 'Site-422' || d.siteId === 'Site-114';
      var latency = Math.max(0, Math.round(2 + rng() * 9 + (slow ? 7 + rng() * 10 : 0) + (d.importance === 'Critical' ? 3 : 0)));
      d.detectedDate = d.date;
      d.occurredDate = G.iso(G.addDays(new Date(d.date), -latency));
      d.rootCause = rng() < 0.7 ? CATEGORY_GROUP[d.category] : pick(rng, ROOT_CAUSE_GROUPS).id;
    });
  }

  // ---- Medical depth ----------------------------------------------------------------------
  var VITAL_DEFS = {
    weight: { label: 'Weight', unit: 'kg', base: [58, 96], noise: 0.6, low: null, high: null },
    temp: { label: 'Temperature', unit: '°C', base: [36.4, 36.8], noise: 0.25, low: 35.5, high: 37.8 },
    sbp: { label: 'Systolic BP', unit: 'mmHg', base: [112, 142], noise: 7, low: 90, high: 160 },
    alt: { label: 'ALT', unit: 'U/L', base: [18, 34], noise: 5, low: null, high: 40 }
  };
  var CONMEDS = [['Atorvastatin', 'Cholesterol'], ['Metformin', 'Type 2 diabetes'], ['Lisinopril', 'Hypertension'], ['Aspirin', 'Cardioprotection'],
    ['Omeprazole', 'Reflux'], ['Amlodipine', 'Hypertension'], ['Paracetamol', 'Headache'], ['Levothyroxine', 'Thyroid']];

  function buildVitals(rng, subj, hot) {
    var start = new Date(subj.enrollDate);
    var end = subj.discontinuationDate ? new Date(subj.discontinuationDate) : G.ASOF;
    var weeks = Math.min(52, Math.max(4, Math.floor(G.daysBetween(start, end) / 7)));
    var out = {};
    Object.keys(VITAL_DEFS).forEach(function (k) {
      var def = VITAL_DEFS[k];
      var base = def.base[0] + rng() * (def.base[1] - def.base[0]);
      var series = [];
      for (var w = 0; w <= weeks; w++) {
        var v = base + (rng() - 0.5) * 2 * def.noise;
        // Hot subjects drift upward near the end so abnormal readings cluster recently.
        if (hot && (k === 'alt' || k === 'sbp') && w > weeks - 6) v += (w - (weeks - 6)) * (k === 'alt' ? 5 : 6);
        if (k === 'weight') v -= w * 0.03;
        v = k === 'temp' ? round(v, 1) : round(v, k === 'weight' ? 1 : 0);
        var abnormal = (def.high != null && v > def.high) || (def.low != null && v < def.low);
        series.push({ date: G.iso(G.addDays(start, w * 7)), value: v, abnormal: abnormal });
      }
      out[k] = series;
    });
    return out;
  }

  var AE_REASONS = {
    related: 'Onset follows a dose within 72 hours and the term is consistent with the known profile.',
    possibly: 'Timing is compatible with the study drug, but a concomitant medication could also explain it.',
    unrelated: 'No temporal link to dosing; a pre-existing condition is the more likely cause.'
  };

  function reviewFor(rng, ae, vitals) {
    var grade = ae.serious ? (ae.severity === 'Severe' ? 4 : 3) : (ae.severity === 'Severe' ? 3 : (ae.severity === 'Moderate' ? 2 : 1));
    var key = ae.relatedness === 'Related' ? 'related' : (ae.relatedness === 'Possibly related' ? 'possibly' : 'unrelated');
    var steps = ['Clarify with site'];
    if (key !== 'unrelated') steps.push('Verify dosing');
    if (ae.serious || vitals.alt.some(function (p) { return p.abnormal; })) steps.push('Request follow-up labs');
    return { aeId: ae.id, grade: grade, reasoning: AE_REASONS[key], steps: steps, confidence: round(0.62 + rng() * 0.3, 2) };
  }

  function buildMedical(rng, sites, subjects, adverseEvents) {
    var ids = {};
    subjects.filter(function (s) { return s.siteId === 'Site-114'; }).forEach(function (s) { ids[s.id] = true; });
    var listed = [];
    for (var i = 0; i < adverseEvents.length && listed.length < 3; i++) {
      var sid = adverseEvents[i].subjectId;
      if (!ids[sid] && listed.indexOf(sid) < 0) listed.push(sid);
    }
    listed.forEach(function (s) { ids[s] = true; });
    var bySubject = {};
    subjects.forEach(function (subj) {
      if (!ids[subj.id]) return;
      var hot = subj.siteId === 'Site-114' && rng() < 0.3 || listed.indexOf(subj.id) >= 0;
      var vitals = buildVitals(rng, subj, hot);
      var dosing = [];
      var d0 = new Date(subj.enrollDate);
      var end = subj.discontinuationDate ? new Date(subj.discontinuationDate) : G.ASOF;
      for (var d = 0; d0 && G.addDays(d0, d * 28) <= end && d < 14; d++) {
        var r = rng();
        dosing.push({ date: G.iso(G.addDays(d0, d * 28)), doseMg: r < 0.08 ? 5 : 10, status: r < 0.05 ? 'Missed' : (r < 0.08 ? 'Dose reduced' : 'Administered') });
      }
      var conmeds = [];
      var n = 2 + Math.floor(rng() * 3);
      for (var c = 0; c < n; c++) {
        var cm = pick(rng, CONMEDS);
        var st = G.addDays(d0, Math.floor(rng() * 40) - 20);
        conmeds.push({ drug: cm[0], indication: cm[1], start: G.iso(st), end: rng() < 0.25 ? G.iso(G.addDays(st, 40 + Math.floor(rng() * 80))) : null });
      }
      var aes = adverseEvents.filter(function (e) { return e.subjectId === subj.id; });
      bySubject[subj.id] = { subjectId: subj.id, dosing: dosing, conmeds: conmeds, vitals: vitals, reviews: aes.map(function (ae) { return reviewFor(rng, ae, vitals); }) };
    });
    // Subjects needing review: simple priority score (open SAEs x3, recent abnormal readings x1, late reports x2).
    var cutoff = G.iso(G.addDays(G.ASOF, -30));
    var ranked = Object.keys(bySubject).map(function (id) {
      var m = bySubject[id];
      var saes = adverseEvents.filter(function (e) { return e.subjectId === id && e.serious; });
      var abnormal = 0;
      Object.keys(m.vitals).forEach(function (k) { abnormal += m.vitals[k].filter(function (p) { return p.abnormal && p.date >= cutoff; }).length; });
      var late = saes.filter(function (e) { return e.withinReportingWindow === false; }).length;
      var siteCode = id.split('-')[1];
      return { subjectId: id, siteId: 'Site-' + siteCode, openSaes: saes.length, abnormalReadings: abnormal, lateReports: late, priority: saes.length * 3 + abnormal + late * 2 };
    }).sort(function (a, b) { return b.priority - a.priority || (a.subjectId < b.subjectId ? -1 : 1); });
    return { subjectIds: Object.keys(bySubject), listedSubjectIds: listed, bySubject: bySubject, ranked: ranked, vitalDefs: VITAL_DEFS };
  }

  // ---- Enrollment --------------------------------------------------------------------------
  var PLANNED_LSI_DAYS = { 'CV-5645': 120, 'ONC-2217': 150, 'MET-3120': 90 };

  function buildEnrollment(subjects, sites, studies) {
    var siteStudy = {};
    sites.forEach(function (s) { siteStudy[s.id] = s.studyId; });
    return studies.map(function (st) {
      var dates = subjects.filter(function (s) { return siteStudy[s.siteId] === st.id; }).map(function (s) { return s.enrollDate; }).sort();
      var first = dates.length ? new Date(dates[0]) : G.ASOF;
      var buckets = Math.min(12, Math.max(3, Math.ceil(G.daysBetween(first, G.ASOF) / 30)));
      var plannedLsi = G.addDays(G.ASOF, PLANNED_LSI_DAYS[st.id] || 120);
      var spanDays = Math.max(30, G.daysBetween(first, plannedLsi));
      var series = [];
      for (var b = buckets; b >= 0; b--) {
        var day = G.addDays(G.ASOF, -b * 30);
        var iso = G.iso(day);
        series.push({
          date: iso,
          actual: dates.filter(function (d) { return d <= iso; }).length,
          planned: Math.round(st.subjects * Math.min(1, Math.max(0, G.daysBetween(first, day) / spanDays)))
        });
      }
      return { studyId: st.id, target: st.subjects, enrolled: dates.length, plannedLastSubjectIn: G.iso(plannedLsi), series: series };
    });
  }

  // ---- Protocol intelligence (CV-5645, deterministic, hand-set) ---------------------------------
  function buildProtocolAnalysis() {
    var drivers = [
      { id: 'visits', label: 'Visit count', detail: '14 scheduled visits over 78 weeks', points: 12, max: 20 },
      { id: 'procedures', label: 'Procedures per visit', detail: 'Average of 9 procedures, 6 at the baseline visit', points: 14, max: 20 },
      { id: 'eligibility', label: 'Eligibility criteria count', detail: '31 inclusion and exclusion criteria', points: 11, max: 15 },
      { id: 'endpoints', label: 'Endpoints', detail: '1 primary, 5 secondary, 8 exploratory', points: 10, max: 15 },
      { id: 'windows', label: 'Visit window tightness', detail: '9 of 14 visits have a window of 3 days or less', points: 10, max: 15 },
      { id: 'local', label: 'Local lab and ECG demands', detail: 'Local lab at 8 visits, central ECG at 6', points: 9, max: 15 }
    ];
    var score = drivers.reduce(function (s, d) { return s + d.points; }, 0);
    return {
      studyId: 'CV-5645', protocolVersion: 'v3.0 (synthetic)', complexityScore: score, portfolioMedian: 52,
      drivers: drivers,
      ctq: [
        { ctqId: 'ctq_safety', section: 'Section 8.3, Adverse event reporting', note: 'SAE reporting within 24 hours drives the safety indicators.' },
        { ctqId: 'ctq_data', section: 'Section 9.2, Data collection and timelines', note: 'Entry timeliness and query response protect data reliability.' },
        { ctqId: 'ctq_endpoint', section: 'Section 6.1, Primary endpoint assessment', note: 'The ECG-based primary endpoint needs evaluable recordings at every visit.' },
        { ctqId: 'ctq_compliance', section: 'Section 7, Visit schedule and windows', note: 'Tight windows make visit timing the main compliance exposure.' },
        { ctqId: 'ctq_rights', section: 'Section 10.1, Informed consent', note: 'Re-consent is required at each protocol amendment.' }
      ],
      hotSpots: [
        { id: 'HS-1', title: 'Out-of-window visits at weeks 12 and 24', probability: 0.71, reason: 'Windows of plus or minus 2 days at the two primary assessment visits.', kriCode: 'missed_visits', ctqId: 'ctq_endpoint' },
        { id: 'HS-2', title: 'Late SAE reporting at high-enrollment sites', probability: 0.64, reason: 'A 24-hour rule combined with a complex cardiac event definition.', kriCode: 'sae_reporting_timeliness', ctqId: 'ctq_safety' },
        { id: 'HS-3', title: 'Eligibility misreads on the cardiac history criteria', probability: 0.58, reason: 'Three criteria use overlapping ejection fraction thresholds.', kriCode: 'protocol_deviations', ctqId: 'ctq_compliance' },
        { id: 'HS-4', title: 'Unevaluable ECGs after a device change', probability: 0.49, reason: 'Central ECG at 6 visits with a strict quality standard.', kriCode: 'ecg_quality', ctqId: 'ctq_endpoint' },
        { id: 'HS-5', title: 'Local lab results entered late', probability: 0.42, reason: 'Local lab at 8 visits with manual transcription.', kriCode: 'entry_timeliness', ctqId: 'ctq_data' }
      ],
      aiNote: 'CV-5645 sits above the portfolio median because of visit window tightness and the number of procedures per visit. The two highest-probability hot spots are already watched by active indicators, so the main gap is a control for eligibility misreads.'
    };
  }

  // ---- QA audits -----------------------------------------------------------------------------
  function buildQaAudits(rng, sites, siteRisk, vendors) {
    var latest = {};
    siteRisk.forEach(function (r) { if (r.score != null) { var c = latest[r.siteId]; if (!c || r.snapshotId > c.snapshotId) latest[r.siteId] = r; } });
    var top = Object.keys(latest).map(function (id) { return latest[id]; }).sort(function (a, b) { return b.score - a.score || (a.siteId < b.siteId ? -1 : 1); }).slice(0, 6);
    var auditors = ['M. Costa', 'L. Fischer', 'K. Adeyemi'];
    var rows = top.map(function (r, i) {
      var site = sites.filter(function (s) { return s.id === r.siteId; })[0];
      return {
        id: 'QA-' + (i + 1), targetType: 'Site', targetId: site.id, targetName: 'Site ' + site.code, studyId: site.studyId,
        reason: 'Risk score ' + r.score + ' (high). Open safety and data quality findings.',
        lastAuditDate: G.iso(G.addDays(G.ASOF, -(300 + Math.floor(rng() * 400)))),
        proposedWindow: 'Within ' + (4 + i * 2) + ' weeks', auditor: auditors[i % auditors.length]
      };
    });
    vendors.slice(0, 2).forEach(function (v, i) {
      rows.push({
        id: 'QA-' + (rows.length + 1), targetType: 'Vendor', targetId: v.id, targetName: v.name, studyId: i === 0 ? 'CV-5645' : 'MET-3120',
        reason: i === 0 ? 'Courier change with rising local lab non-compliance.' : 'No audit in more than 24 months.',
        lastAuditDate: G.iso(G.addDays(G.ASOF, -(520 + i * 120))), proposedWindow: 'Within ' + (10 + i * 4) + ' weeks', auditor: auditors[(i + 1) % auditors.length]
      });
    });
    return { rows: rows, fixedScheduleCount: Math.ceil(sites.length * 0.1) + 2 };
  }

  function buildAddendum(base) {
    var rng = G.mulberry32(20260724);
    extendDeviations(rng, base.deviations);
    return {
      rootCauseGroups: ROOT_CAUSE_GROUPS,
      medical: buildMedical(rng, base.sites, base.subjects, base.adverseEvents),
      enrollment: buildEnrollment(base.subjects, base.sites, REF.STUDIES),
      protocolAnalysis: buildProtocolAnalysis(),
      qaAudits: buildQaAudits(rng, base.sites, base.siteRisk, REF.VENDORS),
      savingsDefaults: { sites: base.activeSites, subjectsPerSite: 18, visitsPerSubject: 10, costPerVisitUsd: 33000, currentSdvPct: 100, targetSdvPct: 30 }
    };
  }

  global.RBQM_GENERATOR = Object.assign(G, { buildAddendum: buildAddendum, ROOT_CAUSE_GROUPS: ROOT_CAUSE_GROUPS });
})(window);
