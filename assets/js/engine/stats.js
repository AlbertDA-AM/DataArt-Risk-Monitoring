/* Statistical engine: funnel limits (Poisson/binomial, overdispersion-adjusted), intervals, status.
   Pure functions, no state. Used by the generator and by live recompute (thresholds what-if). */
(function (global) {
  'use strict';

  // Standard normal quantiles for the two funnel levels used across the product.
  var Z = { moderate: 1.959964, high: 3.090232 }; // 95% and 99.8% two-sided

  /**
   * Poisson funnel limits for a rate (events / exposure), centered on the study rate,
   * widened for a given exposure and inflated by an overdispersion factor (phi >= 1)
   * so natural between-site variation does not over-flag.
   */
  function poissonFunnelLimits(studyRate, exposure, phi) {
    phi = phi || 1.6;
    if (!exposure || exposure <= 0) return { moderateLow: null, moderateHigh: null, highLow: null, highHigh: null };
    var se = Math.sqrt((studyRate * phi) / exposure);
    return {
      moderateLow: Math.max(0, studyRate - Z.moderate * se),
      moderateHigh: studyRate + Z.moderate * se,
      highLow: Math.max(0, studyRate - Z.high * se),
      highHigh: studyRate + Z.high * se
    };
  }

  /** Binomial funnel limits for a proportion, overdispersion-adjusted. */
  function binomialFunnelLimits(studyP, n, phi) {
    phi = phi || 1.5;
    if (!n || n <= 0) return { moderateLow: null, moderateHigh: null, highLow: null, highHigh: null };
    var se = Math.sqrt((studyP * (1 - studyP) * phi) / n);
    return {
      moderateLow: Math.max(0, studyP - Z.moderate * se),
      moderateHigh: Math.min(1, studyP + Z.moderate * se),
      highLow: Math.max(0, studyP - Z.high * se),
      highHigh: Math.min(1, studyP + Z.high * se)
    };
  }

  /** Approximate exact Poisson confidence interval (Byar's approximation), for small counts too. */
  function poissonCI(count, exposure, level) {
    level = level || 0.95;
    var z = level >= 0.998 ? Z.high : Z.moderate;
    if (!exposure || exposure <= 0) return { low: null, high: null };
    if (count === 0) {
      return { low: 0, high: (z * z) / (2 * exposure) };
    }
    var low = count * Math.pow(1 - 1 / (9 * count) - z / (3 * Math.sqrt(count)), 3) / exposure;
    var high = (count + 1) * Math.pow(1 - 1 / (9 * (count + 1)) + z / (3 * Math.sqrt(count + 1)), 3) / exposure;
    return { low: Math.max(0, low), high: high };
  }

  /** Wilson score interval for a binomial proportion. */
  function binomialCI(count, n, level) {
    level = level || 0.95;
    var z = level >= 0.998 ? Z.high : Z.moderate;
    if (!n || n <= 0) return { low: null, high: null };
    var p = count / n;
    var denom = 1 + (z * z) / n;
    var center = p + (z * z) / (2 * n);
    var spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
    return { low: Math.max(0, (center - spread) / denom), high: Math.min(1, (center + spread) / denom) };
  }

  /** Standardized ratio: observed / expected (expected = study rate * site exposure). */
  function standardizedRatio(observedCount, studyRate, exposure) {
    var expected = studyRate * exposure;
    if (!expected) return null;
    return observedCount / expected;
  }

  /**
   * Determine status from a value against funnel limits (relative) and a fixed absolute
   * threshold (amber/red), returning the worse of the two. flagDirection: 'high' or 'both'.
   */
  function statusFromLimits(value, funnel, absolute, flagDirection) {
    var relStatus = 'ok';
    if (funnel && funnel.highHigh != null) {
      if (value > funnel.highHigh || (flagDirection === 'both' && value < funnel.highLow)) relStatus = 'action';
      else if (value > funnel.moderateHigh || (flagDirection === 'both' && value < funnel.moderateLow)) relStatus = 'watch';
    }
    var absStatus = 'ok';
    if (absolute && absolute.red != null) {
      if (value > absolute.red) absStatus = 'action';
      else if (value > absolute.amber) absStatus = 'watch';
    }
    return worseOf(relStatus, absStatus);
  }

  var RANK = { ok: 0, watch: 1, action: 2, insufficient: -1, inactive: -1 };
  function worseOf(a, b) {
    if (RANK[a] < 0) return b;
    if (RANK[b] < 0) return a;
    return RANK[a] >= RANK[b] ? a : b;
  }

  global.RBQM_STATS = {
    Z: Z,
    poissonFunnelLimits: poissonFunnelLimits,
    binomialFunnelLimits: binomialFunnelLimits,
    poissonCI: poissonCI,
    binomialCI: binomialCI,
    standardizedRatio: standardizedRatio,
    statusFromLimits: statusFromLimits,
    worseOf: worseOf
  };
})(window);
