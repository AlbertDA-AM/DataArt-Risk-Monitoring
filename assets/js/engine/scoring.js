/* Composite site risk score (0-100) from KRI statuses, weights visible ("why this score"). */
(function (global) {
  'use strict';

  // Default weights: safety KRIs weighted highest. Sum does not need to be 1; we normalize.
  var DEFAULT_WEIGHTS = {
    sae_rate: 20,
    ae_rate: 10,
    entry_timeliness: 8,
    missed_visits: 10,
    manual_query_rate: 8,
    lab_noncompliance: 9,
    query_response_time: 8,
    open_queries_30d: 7,
    protocol_deviations: 14,
    ecg_quality: 6
  };

  var STATUS_POINTS = { ok: 0, watch: 55, action: 100, insufficient: null, inactive: null };

  function band(score) {
    if (score > 60) return 'high';
    if (score > 30) return 'medium';
    return 'low';
  }

  /**
   * kriStatuses: { kriCode: { status: 'ok'|'watch'|'action'|'insufficient'|'inactive' } }
   * Returns { score, band, drivers:[{kriCode, weight, points, contribution}] } sorted by contribution desc.
   */
  function compositeRiskScore(kriStatuses, weights) {
    weights = weights || DEFAULT_WEIGHTS;
    var totalWeight = 0;
    var weighted = 0;
    var drivers = [];
    Object.keys(weights).forEach(function (code) {
      var entry = kriStatuses[code];
      if (!entry || STATUS_POINTS[entry.status] == null) return; // skip insufficient/inactive
      var w = weights[code];
      var pts = STATUS_POINTS[entry.status];
      totalWeight += w;
      var contribution = w * pts;
      weighted += contribution;
      drivers.push({ kriCode: code, weight: w, points: pts, status: entry.status, contribution: contribution });
    });
    var score = totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
    drivers.sort(function (a, b) { return b.contribution - a.contribution; });
    return { score: score, band: band(score), drivers: drivers };
  }

  /** Risk register score. Detectability is off by default (score = likelihood x impact, 1 to 25). When included,
      score = round(L x I x D / 5), which keeps the same 1 to 25 scale; D is 1 (easy to detect) to 5 (hard to detect). */
  function riskScore(likelihood, impact, detectability, includeDetectability) {
    var base = likelihood * impact;
    return includeDetectability ? Math.round(base * detectability / 5) : base;
  }

  /** Risk bands on the 1 to 25 scale: High 15 and above, Medium 8 to 14, Low under 8. */
  function riskBand(score) { return score >= 15 ? 'high' : (score >= 8 ? 'medium' : 'low'); }

  /** Detection coverage (0 to 100). links: [{likelihoodPct}] = likelihood the risk is present if each indicator fires;
      undetectedPct = likelihood the risk is present and not detected by any of them. Detected presence combines the
      links (1 minus the product of the misses); coverage = detected / (detected + undetected). */
  function detectionCoverage(links, undetectedPct) {
    var miss = 1;
    (links || []).forEach(function (l) { miss *= (1 - Math.max(0, Math.min(100, l.likelihoodPct)) / 100); });
    var detected = 1 - miss, undetected = Math.max(0, Math.min(100, undetectedPct || 0)) / 100;
    return detected + undetected > 0 ? Math.round(detected / (detected + undetected) * 100) : 0;
  }

  /** Risk status shown in the register, derived from its mitigations: any Active -> Mitigating; else any Draft ->
      Action planned; else (all Inactive) -> Monitoring; no mitigations -> Accepted. */
  function deriveRiskStatus(mitigations) {
    if (!mitigations || !mitigations.length) return 'Accepted';
    if (mitigations.some(function (m) { return m.status === 'Active'; })) return 'Mitigating';
    if (mitigations.some(function (m) { return m.status === 'Draft'; })) return 'Action planned';
    return 'Monitoring';
  }

  global.RBQM_SCORING = {
    riskScore: riskScore, riskBand: riskBand, detectionCoverage: detectionCoverage, deriveRiskStatus: deriveRiskStatus,
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    band: band,
    compositeRiskScore: compositeRiskScore
  };
})(window);
