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

  global.RBQM_SIGNALS = {
    shouldTrigger: shouldTrigger,
    severityFromStatus: severityFromStatus,
    suggestResponseType: suggestResponseType,
    SIGNAL_STATES: SIGNAL_STATES,
    OPEN_STATES: OPEN_STATES,
    isOpen: isOpen
  };
})(window);
