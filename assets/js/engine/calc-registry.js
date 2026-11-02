/* Calculation registry (Addendum v0.4, item 3): maps a metric ID to its name, plain formula,
   inputs at the current snapshot, thresholds and data sources. Reads RBQM_DATA and the engines at
   call time, so values always match the pages. Pure: returns plain objects, no DOM.
   IDs: kri|<siteId>|<kriCode>[|<snapshotId>], siterisk|<siteId>, qtl|<qtlId>, health, roi|<field>. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var G = { latestFinalizedSnapshotForStudy: function (a, b) { return global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(a, b); }, HEALTH_WEIGHTS: null };

  var KRI_FORMULAS = {
    sae_rate: ['Serious adverse events divided by subject-weeks of exposure', ['Safety database', 'EDC exposure records']],
    ae_rate: ['Non-serious adverse events divided by subject-weeks of exposure', ['EDC adverse event forms', 'EDC exposure records']],
    entry_timeliness: ['Median days from visit date to data entry', ['EDC audit trail']],
    missed_visits: ['Missed visits divided by planned visits', ['EDC visit forms', 'Visit schedule']],
    manual_query_rate: ['Manual queries divided by eCRF pages entered', ['EDC query log']],
    lab_noncompliance: ['Non-compliant local lab samples divided by samples collected', ['Local lab feed']],
    query_response_time: ['Median days from query raised to answered', ['EDC query log']],
    open_queries_30d: ['Queries open longer than 30 days divided by all open queries', ['EDC query log']],
    protocol_deviations: ['Protocol deviations divided by subject-months of exposure', ['Deviation log', 'EDC exposure records']],
    ecg_quality: ['ECG recordings not evaluable divided by recordings received', ['Central ECG vendor feed']]
  };
  var STATUS_POINTS = { ok: 'On track = 0', watch: 'Watch = 55', action: 'Action needed = 100' };

  function data() { return global.RBQM_DATA; }
  function snapFor(d, studyId) { return G.latestFinalizedSnapshotForStudy(d.snapshots, studyId); }
  function siteById(d, id) { return d.sites.filter(function (s) { return s.id === id; })[0]; }

  function fmtKri(def, v) {
    if (v == null) return '–';
    var u = def.unit;
    if (u.indexOf('day') !== -1) return (Math.round(v * 10) / 10) + ' d';
    if (u.indexOf('%') !== -1) return FMT.pct(v, 1);
    return FMT.num(v, 3);
  }

  function kriCalc(parts) {
    var d = data();
    var site = siteById(d, parts[1]);
    var def = KRI.byCode(parts[2]);
    if (!site || !def) return null;
    var snap = parts[3] ? d.snapshots.filter(function (s) { return s.id === parts[3]; })[0] : snapFor(d, site.studyId);
    var row = d.kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === def.code && r.snapshotId === snap.id; })[0];
    var f = KRI_FORMULAS[def.code] || ['Defined in the indicator library', ['Study data']];
    var inputs = [];
    if (row && row.numerator != null) inputs.push({ label: 'Numerator', value: FMT.num(row.numerator, 2) });
    if (row && row.denominator != null) inputs.push({ label: 'Denominator', value: FMT.num(row.denominator, 2) });
    if (row && row.ciLow != null) inputs.push({ label: 'Confidence interval (95%)', value: fmtKri(def, row.ciLow) + ' to ' + fmtKri(def, row.ciHigh) });
    inputs.push({ label: 'Method', value: def.method.replace(/_/g, ' ') });
    return {
      id: parts.join('|'), title: def.name + ', Site ' + site.code, subtitle: 'Snapshot ' + snap.id,
      resultLabel: 'Value', resultValue: row ? fmtKri(def, row.value) : '–',
      status: row ? row.status : 'insufficient',
      formula: f[0], inputs: inputs,
      thresholds: [{ label: 'Watch from', value: fmtKri(def, def.amber) }, { label: 'Action needed from', value: fmtKri(def, def.red) }],
      sources: f[1]
    };
  }

  function siteRiskCalc(parts) {
    var d = data();
    var site = siteById(d, parts[1]);
    if (!site) return null;
    var snap = snapFor(d, site.studyId);
    var row = d.siteRisk.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; })[0];
    if (!row) return null;
    var tw = 0, sum = 0;
    var inputs = row.drivers.map(function (dr) {
      tw += dr.weight; sum += dr.contribution;
      var def = KRI.byCode(dr.kriCode);
      return { label: (def ? def.name : dr.kriCode) + ' (weight ' + dr.weight + ')', value: STATUS_POINTS[dr.status] || String(dr.points) };
    });
    var computed = tw ? Math.round(sum / tw) : 0;
    return {
      id: parts.join('|'), title: 'Risk score, Site ' + site.code, subtitle: 'Snapshot ' + snap.id,
      resultLabel: 'Score (0 to 100)', resultValue: row.score == null ? '–' : String(row.score), status: null,
      formula: 'Weighted average of indicator points (On track 0, Watch 55, Action needed 100), using the weights below. Indicators with insufficient data are left out.',
      inputs: inputs.concat(row.score != null && computed !== row.score ? [{ label: 'Weighted average of the drivers', value: String(computed) }] : []),
      thresholds: [{ label: 'Medium from', value: '31' }, { label: 'High from', value: '61' }],
      sources: ['Indicator results at this snapshot', 'Indicator weights'],
      note: row.score != null && computed !== row.score ? 'The headline score for this demo site is fixed by the storyline; the drivers show the computed contributions.' : null
    };
  }

  function qtlCalc(parts) {
    var d = data();
    var q = d.qtlDefs.filter(function (x) { return x.id === parts[1]; })[0];
    if (!q) return null;
    var runs = d.qtlRuns.filter(function (r) { return r.qtlId === q.id; });
    return {
      id: parts.join('|'), title: q.parameter + ', ' + q.studyId, subtitle: 'Quality limit ' + q.id,
      resultLabel: 'Current value', resultValue: FMT.pct(q.currentValue, 1), status: q.outcome === 'Breached' ? 'action' : (q.outcome === 'Near' ? 'watch' : 'ok'),
      formula: 'Study-level share of affected records. The limit is breached when the value goes above the limit; the early warning starts at 75% of it.',
      inputs: [{ label: 'Current value', value: FMT.pct(q.currentValue, 2) }, { label: 'Snapshots in trend', value: String(runs.length) },
        { label: 'Distance to limit', value: FMT.pct(q.limit - q.currentValue, 2) }],
      thresholds: [{ label: 'Early warning', value: FMT.pct(q.warning, 2) }, { label: 'Limit', value: FMT.pct(q.limit, 2) }],
      sources: ['Study-level indicator results', 'Quality limit definitions']
    };
  }

  function healthCalc() {
    var d = data(), s = d.summary, W = global.RBQM_GENERATOR.HEALTH_WEIGHTS;
    var hr = s.highRiskSites / s.totalSites * 100 * W.highRiskShare;
    var sg = s.openSignals / s.totalSites * 100 * W.openSignalShare;
    var cp = s.overdueCapas * W.perOverdueCapa, br = s.breachedQtls * W.perBreachedQtl, nr = s.nearQtls * W.perNearQtl;
    return {
      id: 'health', title: 'Portfolio health score', subtitle: 'Latest finalized snapshots',
      resultLabel: 'Score (0 to 100)', resultValue: String(s.healthScore), status: null,
      formula: '100 minus a penalty: share of high-risk sites (x' + W.highRiskShare + ') + share of sites with open signals (x' + W.openSignalShare + ') + ' + W.perOverdueCapa + ' per overdue CAPA + ' + W.perBreachedQtl + ' per breached quality limit + ' + W.perNearQtl + ' per quality limit near its limit.',
      inputs: [
        { label: s.highRiskSites + ' high-risk sites of ' + s.totalSites, value: '-' + FMT.num(hr, 1) },
        { label: s.openSignals + ' open signals across ' + s.totalSites + ' sites', value: '-' + FMT.num(sg, 1) },
        { label: s.overdueCapas + ' overdue CAPA' + (s.overdueCapas === 1 ? '' : 's'), value: '-' + FMT.num(cp, 1) },
        { label: s.breachedQtls + ' breached quality limit' + (s.breachedQtls === 1 ? '' : 's'), value: '-' + FMT.num(br, 1) },
        { label: s.nearQtls + ' quality limit' + (s.nearQtls === 1 ? '' : 's') + ' near the limit', value: '-' + FMT.num(nr, 1) }],
      thresholds: [{ label: 'Healthy from', value: '80' }, { label: 'Watch from', value: '60' }],
      sources: ['Site risk scores', 'Signals', 'CAPAs', 'Quality limits']
    };
  }

  function roiCalc(parts) {
    var d = data(), r = d.summary.roi, a = r.assumptions;
    var active = d.sites.filter(function (s) { return s.status === 'active'; }).length;
    var map = {
      visits: { title: 'On-site visits avoided', val: String(r.visitsAvoided), formula: 'Active sites multiplied by the remote-first share, rounded.',
        inputs: [{ label: 'Active sites', value: String(active) }, { label: 'Remote-first share', value: FMT.pct(a.remoteFirstShare, 1) }] },
      hours: { title: 'SDV hours saved', val: FMT.int(r.sdvHoursSaved) + ' h', formula: 'Visits avoided multiplied by the source data verification hours per visit, rounded.',
        inputs: [{ label: 'Visits avoided', value: String(r.visitsAvoided) }, { label: 'SDV hours per visit', value: FMT.num(a.sdvHoursPerVisit, 1) }] },
      cost: { title: 'Cost avoided', val: FMT.usd ? FMT.usd(r.costAvoidedUsd) : '$' + FMT.int(r.costAvoidedUsd), formula: 'Visits avoided x cost per visit + SDV hours saved x hourly rate.',
        inputs: [{ label: 'Visits avoided x cost per visit', value: r.visitsAvoided + ' x $' + FMT.int(a.visitCostUsd) }, { label: 'SDV hours x hourly rate', value: FMT.int(r.sdvHoursSaved) + ' x $' + a.sdvHourRateUsd }] },
      detect: { title: 'Earlier issue detection', val: r.earlierDetectionDays + ' days', formula: 'Median days between a signal being raised and the date a traditional schedule would have found it.',
        inputs: [{ label: 'Median days earlier', value: String(r.earlierDetectionDays) }] },
      sla: { title: 'Signals closed within SLA', val: String(r.signalsClosedWithinSla), formula: 'Signals closed inside the service-level window over the reporting period.',
        inputs: [{ label: 'Signals closed within SLA', value: String(r.signalsClosedWithinSla) }] }
    };
    var m = map[parts[1]];
    if (!m) return null;
    return { id: parts.join('|'), title: m.title, subtitle: 'Synthetic estimate', resultLabel: 'Result', resultValue: m.val, status: null, formula: m.formula, inputs: m.inputs,
      thresholds: [], sources: ['Monitoring plan', 'Site list', 'Signal log'] };
  }

  function resolve(id) {
    if (!data()) return null;
    var parts = String(id).split('|');
    if (parts[0] === 'kri') return kriCalc(parts);
    if (parts[0] === 'siterisk') return siteRiskCalc(parts);
    if (parts[0] === 'qtl') return qtlCalc(parts);
    if (parts[0] === 'health') return healthCalc();
    if (parts[0] === 'roi') return roiCalc(parts);
    return null;
  }

  function toText(c) {
    var lines = [c.title + ' (' + c.subtitle + ')', c.resultLabel + ': ' + c.resultValue, 'Formula: ' + c.formula, 'Inputs:'];
    c.inputs.forEach(function (i) { lines.push('- ' + i.label + ': ' + i.value); });
    if (c.thresholds.length) { lines.push('Thresholds:'); c.thresholds.forEach(function (t) { lines.push('- ' + t.label + ': ' + t.value); }); }
    lines.push('Sources: ' + c.sources.join(', '));
    if (c.note) lines.push(c.note);
    lines.push('Synthetic data. Not validated for regulated use.');
    return lines.join('\n');
  }

  /** Small "Show calculation" link; clicks are handled once, document-wide, by calc-drawer.js. */
  function link(id, label) {
    return '<a href="#" class="calc-link" data-calc="' + id + '" title="See how this number is calculated">' + (label || 'Show calculation') + '</a>';
  }

  /** Savings calculator (item 7). Same formulas as the ROI figures: at the default inputs it reproduces them exactly.
      Visits avoided scale with the SDV reduction; SDV hours per visit scale with the subject and visit workload. */
  function savings(inputs) {
    var d = data(), def = d.savingsDefaults, a = d.summary.roi.assumptions;
    var span = def.currentSdvPct - def.targetSdvPct || 1;
    var reduction = Math.max(0, (inputs.currentSdvPct - inputs.targetSdvPct) / span);
    var workload = (inputs.subjectsPerSite * inputs.visitsPerSubject) / (def.subjectsPerSite * def.visitsPerSubject);
    var visitsAvoided = Math.round(inputs.sites * a.remoteFirstShare * reduction);
    var sdvHoursSaved = Math.round(visitsAvoided * a.sdvHoursPerVisit * workload);
    return { visitsAvoided: visitsAvoided, sdvHoursSaved: sdvHoursSaved, costSavedUsd: visitsAvoided * inputs.costPerVisitUsd + sdvHoursSaved * a.sdvHourRateUsd };
  }

  global.RBQM_CALC = { fmtKri: fmtKri, resolve: resolve, toText: toText, link: link, savings: savings };
})(window);
