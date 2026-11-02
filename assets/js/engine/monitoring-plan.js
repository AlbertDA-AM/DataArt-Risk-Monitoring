/* Monitoring plan and visit planner logic (spec section 6). Configurable rules. */
(function (global) {
  'use strict';

  var DEFAULT_RULES = {
    low: { remoteWeeks: 8, onsiteWeeks: 26, sdvScope: 'Critical data only (consent, eligibility, primary endpoint, SAEs)' },
    medium: { remoteWeeks: 4, onsiteWeeks: 12, sdvScope: 'Critical data plus increased sample (30%)' },
    high: { remoteWeeks: 2, onsiteWeeks: 2, sdvScope: '100% of critical data, sample of rest' },
    newSite: { onsiteWeeks: 4, sdvScope: '100% of critical data' }
  };

  /**
   * site: { band, isNew, openCapaDueDate, redSafetyKri, insufficientData }
   * Returns { recommendedType, nextDueDate, sdvScope, rationale }.
   */
  function recommend(site, asOfDate, rules) {
    rules = rules || DEFAULT_RULES;
    var asOf = new Date(asOfDate);
    if (site.openCapaDueDate) {
      return { recommendedType: 'Follow-up visit', sdvScope: 'Focused on the CAPA topic', rationale: 'Open CAPA: visit scheduled around the due date', nextDueDate: site.openCapaDueDate };
    }
    if (site.isNew) {
      return { recommendedType: 'On-site visit', sdvScope: rules.newSite.sdvScope, rationale: 'New site: on-site visit within 4 weeks of first subject', nextDueDate: addDays(new Date(site.activationDate), rules.newSite.onsiteWeeks * 7) };
    }
    if (site.insufficientData) {
      return { recommendedType: 'Remote check', sdvScope: 'Critical data', rationale: 'Insufficient data: review at next snapshot', nextDueDate: addDays(asOf, 30) };
    }
    if (site.band === 'high' || site.redSafetyKri) {
      return { recommendedType: 'Targeted on-site visit', sdvScope: rules.high.sdvScope, rationale: 'High risk or red safety indicator: targeted visit within 2 weeks', nextDueDate: addDays(asOf, rules.high.onsiteWeeks * 7) };
    }
    if (site.band === 'medium') {
      return { recommendedType: 'On-site visit', sdvScope: rules.medium.sdvScope, rationale: 'Medium risk: on-site every 12 weeks, remote every 4', nextDueDate: addDays(asOf, rules.medium.onsiteWeeks * 7) };
    }
    return { recommendedType: 'Remote check', sdvScope: rules.low.sdvScope, rationale: 'Low risk, no open signals: remote check every 8 weeks', nextDueDate: addDays(asOf, rules.low.remoteWeeks * 7) };
  }

  function addDays(date, days) {
    var d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  global.RBQM_MONITORING_PLAN = { DEFAULT_RULES: DEFAULT_RULES, recommend: recommend };
})(window);
