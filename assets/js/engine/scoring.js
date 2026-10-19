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

  global.RBQM_SCORING = {
    DEFAULT_WEIGHTS: DEFAULT_WEIGHTS,
    band: band,
    compositeRiskScore: compositeRiskScore
  };
})(window);
