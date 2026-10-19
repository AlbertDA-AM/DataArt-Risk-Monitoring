/* Trend extrapolation with a prediction band, used for the 60-day breach forecast. */
(function (global) {
  'use strict';

  /** Simple linear regression over {x,y} points, x in snapshot index, y in metric value. */
  function linearFit(points) {
    var n = points.length;
    if (n < 2) return { slope: 0, intercept: points.length ? points[0].y : 0 };
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    points.forEach(function (p) { sx += p.x; sy += p.y; sxy += p.x * p.y; sxx += p.x * p.x; });
    var denom = (n * sxx - sx * sx) || 1;
    var slope = (n * sxy - sx * sy) / denom;
    var intercept = (sy - slope * sx) / n;
    return { slope: slope, intercept: intercept };
  }

  /**
   * history: array of {snapshotIndex, value} ascending by time, one point per ~30 days.
   * limit: the quality/KRI limit value. direction: 'high' (breach when value exceeds limit) or 'low'.
   * Returns { projectedValue, probability (0-1), direction }.
   */
  function forecastBreach(history, limit, direction) {
    direction = direction || 'high';
    if (!history || history.length === 0) return { projectedValue: null, probability: 0 };
    var points = history.map(function (h, i) { return { x: i, y: h.value }; });
    var fit = linearFit(points);
    var nextX = points.length; // one step ahead (~30 days out of a 60-day window uses 2 steps)
    var projected = fit.intercept + fit.slope * (nextX + 1); // ~60 days ahead if monthly cadence
    var last = points[points.length - 1].y;
    var gapToLimit = direction === 'high' ? (limit - last) : (last - limit);
    var momentum = direction === 'high' ? fit.slope : -fit.slope;
    // Logistic-ish mapping: faster closing momentum relative to remaining gap -> higher probability.
    var raw = gapToLimit <= 0 ? 0.95 : momentum / (Math.abs(gapToLimit) + 0.0001);
    var probability = 1 / (1 + Math.exp(-6 * raw + 1.2));
    probability = Math.max(0.02, Math.min(0.97, probability));
    return { projectedValue: projected, probability: probability, direction: direction, slope: fit.slope };
  }

  global.RBQM_FORECAST = { linearFit: linearFit, forecastBreach: forecastBreach };
})(window);
