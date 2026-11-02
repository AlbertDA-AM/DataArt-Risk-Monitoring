/* Signal trigger rule and lifecycle helpers (spec section 4, 5). */
(function (global) {
  'use strict';

  /**
   * statusHistory: array of KRI statuses for a site/KRI, most recent last (e.g. last 3 snapshots).
   * forecastProbability: 0-1 chance of breach within 60 days (from engine/forecast.js).
   * Returns true if a signal should be (re)triggered.
   */
  function shouldTrigger(statusHistory, forecastProbability) {
    var last = statusHistory[statusHistory.length - 1];
    if (last === 'action') return true;
    if (last === 'watch' && statusHistory.length >= 2 && statusHistory[statusHistory.length - 2] === 'watch') return true;
    if ((forecastProbability || 0) >= 0.6) return true;
    return false;
  }

  var SEVERITY_ORDER = { action: 2, watch: 1, ok: 0 };

  function severityFromStatus(status) { return SEVERITY_ORDER[status] != null ? SEVERITY_ORDER[status] : 0; }

  /** Suggest a response type from severity, repetition and QTL impact (spec section 5). */
  function suggestResponseType(opts) {
    opts = opts || {};
    if (opts.qtlImpact || opts.repeatCount >= 3) return 'capa';
    if (opts.severity === 'action' || opts.repeatCount >= 2) return 'plan';
    return 'quick';
  }

  var SIGNAL_STATES = ['New', 'In review', 'Watch', 'Action planned', 'In progress', 'Resolved', 'Dismissed'];
  var OPEN_STATES = ['New', 'In review', 'Watch', 'Action planned', 'In progress'];

  function isOpen(status) { return OPEN_STATES.indexOf(status) !== -1; }

  /** Signals the user created from data anomalies (Addendum v0.5) live in the overlay with custom: true. This adds them to
      data.signals and the open-signal count (idempotent: each signal is added once), so every page (dashboard, sidebar, assistant) agrees.
      Nothing is added until the user creates one; Reset demo data removes them. */
  function applyCustom(data, store) {
    if (!data || !store) return;
    var ov = store.get('signals') || {}, added = 0;
    Object.keys(ov).forEach(function (id) {
      var s = ov[id];
      if (!s || !s.custom || data.signals.some(function (x) { return x.id === id; })) return;
      data.signals.push(Object.assign({ id: id }, s));
      if (isOpen(s.status)) added++;
    });
    if (added) {
      var g = global.RBQM_GENERATOR, sm = data.summary;
      sm.openSignals += added;
      sm.healthScore = g.computeHealthScore(sm.highRiskSites, sm.totalSites, sm.openSignals, sm.overdueCapas, sm.breachedQtls, sm.nearQtls);
    }
  }

  /** An anomaly with the user's changes (status, dismiss reason, created signal) applied from the notes overlay. */
  function effectiveAnomaly(a, store) {
    return Object.assign({}, a, store && store.get('notes', 'anom-' + a.id));
  }

  global.RBQM_SIGNALS = {
    applyCustom: applyCustom,
    effectiveAnomaly: effectiveAnomaly,
    shouldTrigger: shouldTrigger,
    severityFromStatus: severityFromStatus,
    suggestResponseType: suggestResponseType,
    SIGNAL_STATES: SIGNAL_STATES,
    OPEN_STATES: OPEN_STATES,
    isOpen: isOpen
  };
})(window);
