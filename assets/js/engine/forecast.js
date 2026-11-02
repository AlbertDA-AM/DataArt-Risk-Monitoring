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
  /** Residual standard deviation of a fit, used for the uncertainty band. */
  function residualSd(points, fit) {
    if (points.length < 3) return 0;
    var ss = 0;
    points.forEach(function (p) { var e = p.y - (fit.intercept + fit.slope * p.x); ss += e * e; });
    return Math.sqrt(ss / (points.length - 2));
  }

  /**
   * history: array of {snapshotIndex, value} ascending by time, one point per ~30 days.
   * limit: the quality/KRI limit value. direction: 'high' (breach when value exceeds limit) or 'low'.
   * horizonDays: 30, 60 (default) or 90. At 60 the numbers are exactly the original model.
   * Returns { projectedValue, probability (0-1), direction, slope, band: {low, high}, horizonDays }.
   */
  function forecastBreach(history, limit, direction, horizonDays) {
    direction = direction || 'high';
    horizonDays = horizonDays || 60;
    if (!history || history.length === 0) return { projectedValue: null, probability: 0, band: null, horizonDays: horizonDays };
    var steps = horizonDays / 30;
    var points = history.map(function (h, i) { return { x: i, y: h.value }; });
    var fit = linearFit(points);
    var nextX = points.length; // one step ahead (~30 days out of a 60-day window uses 2 steps)
    var projected = fit.intercept + fit.slope * (nextX - 1 + steps); // steps = 2 -> ~60 days ahead if monthly cadence
    var last = points[points.length - 1].y;
    var gapToLimit = direction === 'high' ? (limit - last) : (last - limit);
    var momentum = (direction === 'high' ? fit.slope : -fit.slope) * (steps / 2);
    // Logistic-ish mapping: faster closing momentum relative to remaining gap -> higher probability.
    var raw = gapToLimit <= 0 ? 0.95 : momentum / (Math.abs(gapToLimit) + 0.0001);
    var probability = 1 / (1 + Math.exp(-6 * raw + 1.2));
    probability = Math.max(0.02, Math.min(0.97, probability));
    var sd = residualSd(points, fit);
    var half = 1.28 * sd * Math.sqrt(1 + steps) + Math.abs(fit.slope) * 0.15 * steps;
    return { projectedValue: projected, probability: probability, direction: direction, slope: fit.slope,
      band: { low: projected - half, high: projected + half }, horizonDays: horizonDays };
  }

  /**
   * Enrollment forecast. series: [{date, actual}] ascending (about one point per 30 days).
   * target: planned total subjects. plannedLsi: ISO date the last subject is planned in.
   * Returns { ratePer30d, projected, band: {low, high}, projectedLastSubjectIn (ISO or null),
   *   onTrackProbability, horizonDays }.
   */
  function forecastEnrollment(series, target, plannedLsi, horizonDays) {
    horizonDays = horizonDays || 60;
    var steps = horizonDays / 30;
    var recent = series.slice(-6);
    var points = recent.map(function (p, i) { return { x: i, y: p.actual }; });
    var fit = linearFit(points);
    var last = series[series.length - 1];
    var rate = Math.max(0, fit.slope);
    var projected = Math.min(target, last.actual + rate * steps);
    var sd = residualSd(points, fit);
    var half = 1.28 * sd * Math.sqrt(1 + steps);
    var lastDate = new Date(last.date);
    var lsi = null, onTrack = 0;
    if (last.actual >= target) { lsi = last.date; onTrack = 1; }
    else if (rate > 0) {
      var daysNeeded = Math.ceil((target - last.actual) / rate * 30);
      lsi = new Date(lastDate.getTime() + daysNeeded * 86400000).toISOString().slice(0, 10);
      var plannedDays = (new Date(plannedLsi).getTime() - lastDate.getTime()) / 86400000;
      onTrack = 1 / (1 + Math.exp(-(plannedDays - daysNeeded) / Math.max(15, daysNeeded * 0.2)));
    }
    return { ratePer30d: rate, projected: Math.round(projected), band: { low: Math.max(last.actual, Math.round(projected - half)), high: Math.min(target, Math.round(projected + half)) },
      projectedLastSubjectIn: lsi, onTrackProbability: Math.max(0.02, Math.min(0.98, onTrack)), horizonDays: horizonDays };
  }

  global.RBQM_FORECAST = { linearFit: linearFit, forecastBreach: forecastBreach, forecastEnrollment: forecastEnrollment };
})(window);
