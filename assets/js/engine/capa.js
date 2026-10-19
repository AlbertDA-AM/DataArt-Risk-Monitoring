/* CAPA state machine and effectiveness check (spec section 5). */
(function (global) {
  'use strict';

  var STATES = ['Draft', 'Submitted', 'Approved', 'Returned', 'In progress', 'Effectiveness check', 'Closed'];

  var TRANSITIONS = {
    'Draft': ['Submitted'],
    'Submitted': ['Approved', 'Returned'],
    'Returned': ['Submitted'],
    'Approved': ['In progress'],
    'In progress': ['Effectiveness check'],
    'Effectiveness check': ['Closed', 'In progress'], // reopen if not recovered
    'Closed': []
  };

  function canTransition(from, to) {
    return (TRANSITIONS[from] || []).indexOf(to) !== -1;
  }

  function isOverdue(capa, asOfDate) {
    if (!capa.due || capa.state === 'Closed') return false;
    return new Date(capa.due) < new Date(asOfDate);
  }

  function daysOverdue(capa, asOfDate) {
    if (!isOverdue(capa, asOfDate)) return 0;
    var ms = new Date(asOfDate) - new Date(capa.due);
    return Math.round(ms / 86400000);
  }

  /** Compare the metric in the 2 snapshots after the CAPA closed against baseline. */
  function effectivenessResult(baselineValue, followUpValues, limit, direction) {
    direction = direction || 'high';
    var recovered = followUpValues.every(function (v) {
      return direction === 'high' ? v <= limit : v >= limit;
    });
    return {
      recovered: recovered,
      baselineValue: baselineValue,
      followUpValues: followUpValues,
      summary: recovered
        ? 'Recovered: both follow-up snapshots are within limit.'
        : 'Not recovered: at least one follow-up snapshot is still outside limit.'
    };
  }

  global.RBQM_CAPA = { STATES: STATES, TRANSITIONS: TRANSITIONS, canTransition: canTransition, isOverdue: isOverdue, daysOverdue: daysOverdue, effectivenessResult: effectivenessResult };
})(window);
