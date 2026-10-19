/* Seeded generator - part 3: site risk, signals, CAPA, risk register, QTLs, monitoring plan,
   integrations, ROI, health score, audit trail, and the top-level generate() orchestrator. */
(function (global) {
  'use strict';

  var G = global.RBQM_GENERATOR;
  var REF = global.RBQM_REFERENCE;
  var KRI = global.RBQM_KRI_CATALOG;
  var SCORING = global.RBQM_SCORING;
  var SIGNALS_ENGINE = global.RBQM_SIGNALS;
  var MONITORING = global.RBQM_MONITORING_PLAN;
  var CAPA_ENGINE = global.RBQM_CAPA;
  var CFG = global.RBQM_CONFIG;
  var STORYLINE = G.STORYLINE;

  function buildSiteRisk(sites, kriResults, snapshots) {
    var out = [];
    sites.forEach(function (site) {
      var story = STORYLINE[site.code];
      if (story && story.closed) return;
      var studySnaps = snapshots.filter(function (s) { return s.studyId === site.studyId; });
      studySnaps.forEach(function (snap) {
        var rows = kriResults.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; });
        if (story && story.insufficientData) {
          out.push({ snapshotId: snap.id, siteId: site.id, score: null, band: 'insufficient', drivers: [] });
          return;
        }
        var statusMap = {};
        rows.forEach(function (r) { statusMap[r.kriCode] = { status: r.status }; });
        var composite = SCORING.compositeRiskScore(statusMap, SCORING.DEFAULT_WEIGHTS);
        var isLatest = snap.index === studySnaps.length - 1;
        var score = composite.score;
        if (story && story.riskScore != null && isLatest) score = story.riskScore;
        else if (story && story.riskScore != null) score = Math.round(story.riskScore * (0.6 + 0.4 * (snap.index + 1) / studySnaps.length));
        out.push({ snapshotId: snap.id, siteId: site.id, score: score, band: SCORING.band(score), drivers: composite.drivers });
      });
    });
    return out;
  }

  function overallStatusForSite(site, latestKriRows) {
    var story = STORYLINE[site.code];
    if (story && story.closed) return 'closed';
    if (story && story.insufficientData) return 'insufficient';
    var worst = 'ok';
    latestKriRows.forEach(function (r) { if (r.status === 'action') worst = 'action'; else if (r.status === 'watch' && worst !== 'action') worst = 'watch'; });
    return worst;
  }

  var OPEN_ROTATION = ['New', 'In review', 'Watch', 'Action planned', 'In progress'];
  var NAMED_OPEN_SIGNALS = [
    { id: 'SIG-0412', code: '114', kri: 'ae_rate', status: 'New', history: 2 },
    { id: 'SIG-0409', code: '207', kri: 'ae_rate', status: 'In review', history: 3 },
    { id: 'SIG-0431', code: '052', kri: 'missed_visits', status: 'Watch', history: 2 },
    { id: 'SIG-0440', code: null, countryLevel: 'AR', study: 'MET-3120', kri: 'lab_noncompliance', status: 'Action planned', history: 0 },
    { id: 'SIG-0441', code: '301', kri: 'lab_noncompliance', status: 'New', history: 0 },
    { id: 'SIG-0442', code: '305', kri: 'lab_noncompliance', status: 'New', history: 0 },
    { id: 'SIG-0443', code: '311', kri: 'lab_noncompliance', status: 'New', history: 0 },
    { id: 'SIG-0450', code: '415', kri: 'data_variability', status: 'In review', history: 0 },
    { id: 'SIG-0451', code: '422', kri: 'sae_reporting_timeliness', status: 'Action planned', history: 1 },
    { id: 'SIG-0452', code: '258', kri: 'entry_timeliness', status: 'In progress', history: 1 },
    { id: 'SIG-0453', code: '331', kri: 'ecg_quality', status: 'New', history: 0 },
    { id: 'SIG-0454', code: '089', kri: 'query_response_time', status: 'Watch', history: 1 },
    { id: 'SIG-0455', code: '143', kri: 'entry_timeliness', status: 'In progress', history: 2 }
  ];
  var OPEN_SIGNAL_TARGET = 23;

  function buildSignals(rng, sites, kriResults, snapshots) {
    var signals = [];
    var usedKeys = {};
    var siteByCode = {}; sites.forEach(function (s) { siteByCode[s.code] = s; });

    function latestSnapFor(studyId) { return G.latestFinalizedSnapshotForStudy(snapshots, studyId); }

    NAMED_OPEN_SIGNALS.forEach(function (spec, idx) {
      var site = spec.code ? siteByCode[spec.code] : null;
      var studyId = site ? site.studyId : spec.study;
      var snap = latestSnapFor(studyId);
      usedKeys[(site ? site.id : 'AR') + '|' + spec.kri] = true;
      signals.push({
        id: spec.id, studyId: studyId, siteId: site ? site.id : null, countryLevel: spec.countryLevel || null,
        kriCode: spec.kri, snapshotId: snap.id, severity: spec.status === 'New' ? 'action' : 'watch',
        status: spec.status, description: describeSignal(site, spec.kri, spec.status),
        ownerId: idx % 3 === 0 ? null : 'U-00' + (1 + (idx % 8)),
        created: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 2, 40))), updated: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 0, 3))),
        history: buildSignalHistory(spec.history)
      });
    });

    // Fill remaining open slots from ordinary (non-storyline) flagged KRIs, deterministically.
    var needed = OPEN_SIGNAL_TARGET - signals.length;
    var latestOrdinary = kriResults.filter(function (r) {
      var site = sites.filter(function (s) { return s.id === r.siteId; })[0];
      if (!site) return false;
      if (STORYLINE[site.code]) return false;
      var snap = latestSnapFor(site.studyId);
      return r.snapshotId === snap.id && !usedKeys[r.siteId + '|' + r.kriCode];
    });
    latestOrdinary.sort(function (a, b) {
      var rank = { action: 2, watch: 1, ok: 0 };
      return (rank[b.status] - rank[a.status]) || (b.value - a.value);
    });
    var fillCandidates = latestOrdinary.slice(0, needed);
    // Guarantee exact count even if fewer naturally flagged candidates exist.
    if (fillCandidates.length < needed) {
      var pool = kriResults.filter(function (r) {
        var site = sites.filter(function (s) { return s.id === r.siteId; })[0];
        return site && !STORYLINE[site.code] && r.snapshotId === latestSnapFor(site.studyId).id && !usedKeys[r.siteId + '|' + r.kriCode];
      }).sort(function (a, b) { return b.value - a.value; });
      fillCandidates = pool.slice(0, needed);
    }
    fillCandidates.forEach(function (r, idx) {
      usedKeys[r.siteId + '|' + r.kriCode] = true;
      var site = sites.filter(function (s) { return s.id === r.siteId; })[0];
      var status = OPEN_ROTATION[idx % OPEN_ROTATION.length];
      signals.push({
        id: 'SIG-05' + String(idx + 1).padStart(2, '0'), studyId: site.studyId, siteId: site.id, countryLevel: null,
        kriCode: r.kriCode, snapshotId: r.snapshotId, severity: r.status === 'action' ? 'action' : 'watch',
        status: status, description: describeSignal(site, r.kriCode, status),
        ownerId: idx % 2 === 0 ? 'U-00' + (1 + (idx % 8)) : null,
        created: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 1, 25))), updated: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 0, 4))),
        history: []
      });
    });

    // Closed signals for history/scale: other flagged (site,kri) combos across snapshots.
    var closedPool = kriResults.filter(function (r) {
      var site = sites.filter(function (s) { return s.id === r.siteId; })[0];
      if (!site) return false;
      if (usedKeys[r.siteId + '|' + r.kriCode]) return false;
      return r.status !== 'ok' && r.status !== 'insufficient';
    });
    var seen = {};
    var closedCount = 0;
    for (var i = 0; i < closedPool.length && closedCount < 95; i++) {
      var r2 = closedPool[i];
      var key = r2.siteId + '|' + r2.kriCode;
      if (seen[key]) continue;
      seen[key] = true;
      var site2 = sites.filter(function (s) { return s.id === r2.siteId; })[0];
      var dismissed = rng() < 0.12;
      var slaCompliant = closedCount < Math.round(95 * 0.87 * 0.6); // ~87% of a representative subset
      signals.push({
        id: 'SIG-06' + String(closedCount + 1).padStart(2, '0'), studyId: site2.studyId, siteId: site2.id, countryLevel: null,
        kriCode: r2.kriCode, snapshotId: r2.snapshotId, severity: r2.status,
        status: dismissed ? 'Dismissed' : 'Resolved',
        description: describeSignal(site2, r2.kriCode, 'Resolved'),
        ownerId: 'U-00' + (1 + (closedCount % 8)),
        created: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 40, 300))),
        updated: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 10, 39))),
        dismissReason: dismissed ? 'Investigated: within expected site-to-site variation.' : null,
        slaCompliant: slaCompliant,
        history: []
      });
      closedCount++;
    }
    return signals;
  }

  function buildSignalHistory(n) {
    var h = [];
    for (var i = 0; i < (n || 0); i++) h.push({ status: 'Resolved', note: 'Earlier signal, resolved.', date: G.iso(G.addDays(G.ASOF, -(60 + i * 45))) });
    return h;
  }

  function describeSignal(site, kriCode, status) {
    var kriDef = KRI.byCode(kriCode);
    var name = kriDef ? kriDef.name : kriCode;
    if (!site) return name + ' is elevated across Argentina sites (local lab non-compliance after a courier change).';
    return 'Site ' + site.code + ' (' + site.country + '): ' + name.toLowerCase() + ' is outside expected range.';
  }

  function randIntLocal(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

  var NAMED_CAPAS = [
    { id: 'CAPA-2026-014', code: '114', signalId: 'SIG-0412', state: 'Draft', due: null, rootCause: 'Site staff unaware of the 24-hour SAE reporting rule after staff turnover.' },
    { id: 'CAPA-2026-022', code: '422', signalId: 'SIG-0451', state: 'In progress', overdueDays: 12, rootCause: 'CRA vacancy delayed SAE reconciliation; reporting rule retraining incomplete.' },
    { id: 'CAPA-2026-005', code: '018', signalId: null, state: 'Closed', effective: true, rootCause: 'Query response delays traced to a single data manager; retrained and backfilled.' },
    { id: 'CAPA-2026-009', code: '143', signalId: 'SIG-0455', state: 'In progress', reopened: true, effective: false, rootCause: 'Entry timeliness CAPA from a prior cycle did not hold; escalated to Quality.' },
    { id: 'CAPA-2026-017', code: '258', signalId: 'SIG-0452', state: 'Submitted', returned: true, rootCause: 'Local data entry resourcing gap; corrective plan resubmitted after Quality return.' }
  ];

  function buildCapasAndActions(rng, sites, signals) {
    var capas = [];
    var actions = [];
    var siteByCode = {}; sites.forEach(function (s) { siteByCode[s.code] = s; });
    var overdueCount = 0;

    NAMED_CAPAS.forEach(function (spec) {
      var site = siteByCode[spec.code];
      var due = spec.overdueDays != null ? G.iso(G.addDays(G.ASOF, -spec.overdueDays)) : G.iso(G.addDays(G.ASOF, 18));
      if (spec.overdueDays != null) overdueCount++;
      capas.push({
        id: spec.id, signalId: spec.signalId, studyId: site.studyId, siteId: site.id,
        rootCause: spec.rootCause, corrective: 'Retrain site staff and add a monitoring check.', preventive: 'Add the check to the next monitoring visit template.',
        ownerId: 'U-001', approverId: 'U-003', due: due, state: spec.state,
        effectivenessResult: spec.effective != null ? { recovered: spec.effective, summary: spec.effective ? 'Recovered: both follow-up snapshots are within limit.' : 'Not recovered: at least one follow-up snapshot is still outside limit.' } : null,
        signatures: spec.state === 'Approved' || spec.state === 'Closed' || spec.state === 'In progress' ? [{ userId: 'U-003', action: 'Approved', date: G.iso(G.addDays(G.ASOF, -20)) }] : []
      });
    });

    // Three more overdue CAPAs (to reach the documented 4 overdue total) plus general filler.
    var extraOverdueSites = sites.filter(function (s) { return !STORYLINE[s.code] && s.status === 'active'; }).slice(0, 3);
    extraOverdueSites.forEach(function (site, idx) {
      var dueOffset = -(randIntLocal(rng, 2, 9));
      capas.push({
        id: 'CAPA-2026-0' + (30 + idx), signalId: null, studyId: site.studyId, siteId: site.id,
        rootCause: 'Recurring query backlog beyond the agreed SLA.', corrective: 'Add a dedicated data review cadence.', preventive: 'Weekly backlog check for 2 cycles.',
        ownerId: 'U-00' + (2 + idx), approverId: 'U-003', due: G.iso(G.addDays(G.ASOF, dueOffset)), state: 'In progress',
        effectivenessResult: null, signatures: [{ userId: 'U-003', action: 'Approved', date: G.iso(G.addDays(G.ASOF, -25)) }]
      });
      overdueCount++;
    });

    // General filler CAPAs from closed signals, to reach roughly the documented portfolio scale.
    var closedSignalsForCapa = signals.filter(function (s) { return (s.status === 'Resolved' || s.status === 'Dismissed') && s.severity === 'action'; }).slice(0, 30);
    closedSignalsForCapa.forEach(function (sig, idx) {
      var site = sites.filter(function (s) { return s.id === sig.siteId; })[0];
      if (!site) return;
      var states = ['Closed', 'Closed', 'Closed', 'In progress', 'Effectiveness check'];
      var state = states[idx % states.length];
      var due = state === 'Closed'
        ? G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 30, 200)))
        : G.iso(G.addDays(G.ASOF, randIntLocal(rng, 5, 30))); // not closed: due date still ahead, not overdue
      capas.push({
        id: 'CAPA-2025-' + String(100 + idx), signalId: sig.id, studyId: site.studyId, siteId: site.id,
        rootCause: 'Root cause investigated and documented for ' + sig.kriCode.replace(/_/g, ' ') + '.',
        corrective: 'Site-level corrective action completed.', preventive: 'Preventive check added to monitoring plan.',
        ownerId: 'U-00' + (1 + (idx % 8)), approverId: 'U-003', due: due,
        state: state,
        effectivenessResult: idx % 3 === 0 ? { recovered: true, summary: 'Recovered: both follow-up snapshots are within limit.' } : null,
        signatures: [{ userId: 'U-003', action: 'Approved', date: G.iso(G.addDays(G.ASOF, -randIntLocal(rng, 40, 210))) }]
      });
    });

    return { capas: capas, actions: actions, overdueCount: overdueCount };
  }

  function buildRiskRegister() {
    var defs = [
      { id: 'R-01', studyId: 'CV-5645', description: 'Late SAE reporting beyond the 24-hour rule', probability: 4, impact: 5, detectability: 1, ctqId: 'ctq_safety', kriCodes: ['sae_reporting_timeliness', 'sae_rate'], status: 'Action planned' },
      { id: 'R-02', studyId: 'MET-3120', description: 'Local lab non-compliance after a courier change', probability: 4, impact: 4, detectability: 1, ctqId: 'ctq_data', kriCodes: ['lab_noncompliance'], status: 'Mitigating' },
      { id: 'R-03', studyId: 'CV-5645', description: 'CRO monitoring visit delays during peak enrollment', probability: 3, impact: 3, detectability: 2, ctqId: 'ctq_compliance', kriCodes: ['missed_visits'], status: 'Monitoring' },
      { id: 'R-04', studyId: 'CV-5645', description: 'AE under-reporting at Site 207', probability: 3, impact: 5, detectability: 1, ctqId: 'ctq_safety', kriCodes: ['ae_rate'], status: 'Action planned' },
      { id: 'R-05', studyId: 'ONC-2217', description: 'Data variability suggesting possible fabrication at one site', probability: 2, impact: 5, detectability: 1, ctqId: 'ctq_data', kriCodes: ['data_variability'], status: 'Mitigating' },
      { id: 'R-06', studyId: 'CV-5645', description: 'ECG device change affecting evaluability', probability: 3, impact: 3, detectability: 2, ctqId: 'ctq_endpoint', kriCodes: ['ecg_quality'], status: 'Monitoring' },
      { id: 'R-07', studyId: 'MET-3120', description: 'Slow data entry and query response in India', probability: 3, impact: 2, detectability: 3, ctqId: 'ctq_data', kriCodes: ['entry_timeliness', 'query_response_time'], status: 'Monitoring' },
      { id: 'R-08', studyId: 'ONC-2217', description: 'Overdue CAPA for late SAE reporting at Site 422', probability: 3, impact: 4, detectability: 1, ctqId: 'ctq_safety', kriCodes: ['sae_reporting_timeliness'], status: 'Action planned' },
      { id: 'R-09', studyId: 'CV-5645', description: 'CRO staffing turnover delaying monitoring visits', probability: 2, impact: 3, detectability: 3, ctqId: null, kriCodes: [], status: 'Accepted' },
      { id: 'R-10', studyId: 'MET-3120', description: 'Protocol deviations clustering by category at a subset of sites', probability: 2, impact: 3, detectability: 2, ctqId: 'ctq_compliance', kriCodes: ['protocol_deviations'], status: 'Monitoring' },
      { id: 'R-11', studyId: 'CV-5645', description: 'Informed consent documentation gaps (no indicator in place)', probability: 2, impact: 4, detectability: 4, ctqId: 'ctq_rights', kriCodes: [], status: 'Accepted' },
      { id: 'R-12', studyId: 'ONC-2217', description: 'Database lock timeline risk from CRO delivery delays', probability: 2, impact: 2, detectability: 3, ctqId: null, kriCodes: [], status: 'Accepted' }
    ];
    defs.forEach(function (r) { r.score = r.probability * r.impact; r.ownerId = 'U-001'; r.mitigation = 'See linked CAPA / monitoring action.'; });
    return defs;
  }

  function buildQtls(snapshots) {
    var defs = [
      { id: 'QTL-SAE24', studyId: 'CV-5645', parameter: 'Late SAE reporting beyond 24h', limit: 0.07, warning: 0.0525, direction: 'high', currentValue: 0.074 },
      { id: 'QTL-PD', studyId: 'CV-5645', parameter: 'Major protocol deviations', limit: 0.10, warning: 0.075, direction: 'high', currentValue: 0.081 },
      { id: 'QTL-VISIT', studyId: 'CV-5645', parameter: 'Missed primary assessments', limit: 0.08, warning: 0.06, direction: 'high', currentValue: 0.042 },
      { id: 'QTL-IE', studyId: 'CV-5645', parameter: 'Subjects violating I/E criteria', limit: 0.05, warning: 0.0375, direction: 'high', currentValue: 0.028 },
      { id: 'QTL-SAE24-ONC', studyId: 'ONC-2217', parameter: 'Late SAE reporting beyond 24h', limit: 0.07, warning: 0.0525, direction: 'high', currentValue: 0.031 },
      { id: 'QTL-PD-ONC', studyId: 'ONC-2217', parameter: 'Major protocol deviations', limit: 0.10, warning: 0.075, direction: 'high', currentValue: 0.045 },
      { id: 'QTL-SAE24-MET', studyId: 'MET-3120', parameter: 'Late SAE reporting beyond 24h', limit: 0.07, warning: 0.0525, direction: 'high', currentValue: 0.028 },
      { id: 'QTL-PD-MET', studyId: 'MET-3120', parameter: 'Major protocol deviations', limit: 0.10, warning: 0.075, direction: 'high', currentValue: 0.052 }
    ];
    defs.forEach(function (d) {
      d.outcome = d.currentValue > d.limit ? 'Breached' : (d.currentValue >= d.warning ? 'Near' : 'Within limit');
    });
    var runs = [];
    defs.forEach(function (d) {
      var snaps = snapshots.filter(function (s) { return s.studyId === d.studyId; }).sort(function (a, b) { return a.index - b.index; });
      snaps.forEach(function (s, idx) {
        var drift = (idx + 1) / snaps.length;
        runs.push({ qtlId: d.id, snapshotId: s.id, value: Math.round(d.currentValue * drift * 10000) / 10000, outcome: idx === snaps.length - 1 ? d.outcome : 'Within limit' });
      });
    });
    return { defs: defs, runs: runs };
  }

  function buildMonitoringPlan(sites, siteRiskLatestBySite, signalsOpenBySite, capasBySite) {
    var items = [];
    sites.forEach(function (site) {
      if (site.status === 'closed') return;
      var risk = siteRiskLatestBySite[site.id];
      var story = STORYLINE[site.code];
      var openCapa = (capasBySite[site.id] || []).filter(function (c) { return c.state !== 'Closed'; })[0];
      var rec = MONITORING.recommend({
        band: risk ? risk.band : 'low',
        insufficientData: story && story.insufficientData,
        isNew: site.isNew,
        activationDate: site.activationDate,
        openCapaDueDate: openCapa ? openCapa.due : null,
        redSafetyKri: false
      }, CFG.asOfDate);
      items.push({
        siteId: site.id, recommendedType: rec.recommendedType, due: rec.nextDueDate, sdvScope: rec.sdvScope,
        rationale: rec.rationale, overrideReason: null, status: 'Recommended'
      });
    });
    return items;
  }

  function buildIntegrations() {
    var cats = [
      { name: 'Medidata Rave EDC', type: 'EDC' }, { name: 'Veeva Vault CTMS', type: 'CTMS' },
      { name: 'Veeva Vault eTMF', type: 'eTMF' }, { name: 'Oracle Argus Safety', type: 'Safety database' },
      { name: 'Suvoda', type: 'IRT / RTSM' }, { name: 'Medidata Patient Cloud', type: 'ePRO / eCOA' },
      { name: 'Labcorp Drug Development', type: 'Central lab' }, { name: 'Q2 Solutions', type: 'Central lab' },
      { name: 'Clario', type: 'ECG and cardiac safety' }, { name: 'MedDRA', type: 'Medical coding' },
      { name: 'WHODrug', type: 'Medical coding' }, { name: 'Veeva Vault QMS', type: 'QMS' }
    ];
    return cats.map(function (c, idx) {
      return { id: 'INT-' + (idx + 1), name: c.name, type: c.type, status: 'Connected', lastSync: G.iso(G.addDays(G.ASOF, -Math.floor(idx / 3))), recordCount: 1000 + idx * 733 };
    });
  }

  function computeHealthScore(highRisk, totalSites, openSignals, overdueCapas, breachedQtls, nearBreachQtls) {
    var penalty = (highRisk / totalSites) * 100 * 1.0
      + (openSignals / totalSites) * 100 * 0.6
      + overdueCapas * 1.7
      + breachedQtls * 2
      + nearBreachQtls * 1;
    return Math.max(0, Math.min(100, Math.round(100 - penalty)));
  }

  function computeROI(totalActiveSites) {
    var visitsAvoided = Math.round(totalActiveSites * 0.304);
    var sdvHourRate = 32.6316;
    var sdvHoursSaved = Math.round(visitsAvoided * sdvHourRate);
    var earlierDetectionDays = 9;
    var signalsClosedWithinSla = 87;
    var costAvoided = visitsAvoided * 33000 + sdvHoursSaved * 120;
    return {
      visitsAvoided: visitsAvoided, sdvHoursSaved: sdvHoursSaved, earlierDetectionDays: earlierDetectionDays,
      signalsClosedWithinSla: signalsClosedWithinSla, costAvoidedUsd: costAvoided,
      assumptions: { visitCostUsd: 33000, sdvHourRateUsd: 120, remoteFirstShare: 0.304 }
    };
  }

  function buildAuditEvents(rng, signals, capas) {
    var events = [];
    var seqNum = 1;
    signals.slice(0, 40).forEach(function (s) {
      events.push({ id: 'AUD-' + (seqNum++), entity: 'Signal', entityId: s.id, userId: s.ownerId || 'U-001', action: 'Status set to ' + s.status, before: null, after: s.status, timestamp: s.updated + 'T09:00:00' });
    });
    capas.forEach(function (c) {
      events.push({ id: 'AUD-' + (seqNum++), entity: 'CAPA', entityId: c.id, userId: c.ownerId, action: 'State set to ' + c.state, before: null, after: c.state, timestamp: G.iso(G.addDays(G.ASOF, -5)) + 'T10:00:00' });
    });
    return events;
  }

  function generate() {
    if (global.RBQM_STORE) KRI.applyOverlay(global.RBQM_STORE);
    var rng = G.mulberry32(42424242);
    var sites = G.buildSites(rng);
    var snapshots = G.buildSnapshots();
    var sv = G.buildSubjectsAndVisits(rng, sites);
    var subjects = sv.subjects, visits = sv.visits;
    var kriResults = G.buildKriResults(rng, sites, subjects, visits, snapshots);
    var siteRisk = buildSiteRisk(sites, kriResults, snapshots);
    var deviations = G.buildProtocolDeviations(rng, sites, subjects, kriResults, snapshots);
    var adverseEvents = G.buildAdverseEvents(rng, sites, subjects, kriResults, snapshots);

    var siteRiskLatestBySite = {};
    sites.forEach(function (site) {
      var snap = G.latestFinalizedSnapshotForStudy(snapshots, site.studyId);
      var row = siteRisk.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; })[0];
      if (row) siteRiskLatestBySite[site.id] = row;
    });

    var signals = buildSignals(rng, sites, kriResults, snapshots);
    var capaResult = buildCapasAndActions(rng, sites, signals);
    var capas = capaResult.capas;
    var capasBySite = {};
    capas.forEach(function (c) { (capasBySite[c.siteId] = capasBySite[c.siteId] || []).push(c); });

    var risks = buildRiskRegister();
    var qtl = buildQtls(snapshots);
    var monitoringPlan = buildMonitoringPlan(sites, siteRiskLatestBySite, null, capasBySite);
    var integrations = buildIntegrations();

    var highRiskSites = Object.keys(siteRiskLatestBySite).filter(function (id) { return siteRiskLatestBySite[id].band === 'high'; }).length;
    var openSignalsCount = signals.filter(function (s) { return SIGNALS_isOpen(s.status); }).length;
    var overdueCapas = capas.filter(function (c) { return CAPA_ENGINE.isOverdue(c, CFG.asOfDate); }).length;
    var breachedQtls = qtl.defs.filter(function (d) { return d.outcome === 'Breached'; }).length;
    var nearQtls = qtl.defs.filter(function (d) { return d.outcome === 'Near'; }).length;
    var activeSitesCount = sites.filter(function (s) { return s.status === 'active'; }).length;
    var portfolioSitesCount = sites.length; // 125, including the one closed site - matches the documented "9 of 125"
    var healthScore = computeHealthScore(highRiskSites, portfolioSitesCount, openSignalsCount, overdueCapas, breachedQtls, nearQtls);
    var roi = computeROI(activeSitesCount);

    var audit = buildAuditEvents(rng, signals, capas);

    return {
      meta: { generatedAt: CFG.asOfDate, seed: 42424242 },
      sponsor: { id: CFG.sponsorId, name: CFG.sponsorLabel },
      cros: REF.CROS, vendors: REF.VENDORS, countries: REF.COUNTRIES, users: REF.USERS, studies: REF.STUDIES,
      sites: sites, subjects: subjects, visits: visits,
      snapshots: snapshots, kriResults: kriResults, siteRisk: siteRisk, deviations: deviations, adverseEvents: adverseEvents,
      signals: signals, capas: capas, risks: risks, ctqFactors: KRI.CTQ_FACTORS,
      qtlDefs: qtl.defs, qtlRuns: qtl.runs, monitoringPlan: monitoringPlan, integrations: integrations,
      auditEvents: audit,
      summary: {
        healthScore: healthScore, highRiskSites: highRiskSites, totalSites: portfolioSitesCount,
        openSignals: openSignalsCount, overdueCapas: overdueCapas, breachedQtls: breachedQtls, nearQtls: nearQtls,
        qtlsAtRisk: breachedQtls + nearQtls, roi: roi
      }
    };
  }

  function SIGNALS_isOpen(status) { return global.RBQM_SIGNALS.isOpen(status); }

  global.RBQM_GENERATOR = Object.assign(G, { generate: generate, buildSiteRisk: buildSiteRisk, overallStatusForSite: overallStatusForSite });
})(window);
