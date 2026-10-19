/* KRI catalogue: defaults, all configurable (spec section 4). Single source of truth for
   formula, method, flag direction, illustrative thresholds, weights and validation status. */
(function (global) {
  'use strict';

  var KRIS = [
    { code: 'sae_rate', name: 'Serious AE rate', shortName: 'SAE', unit: 'per subject-week', method: 'poisson_funnel', flagDirection: 'both', amber: 0.09, red: 0.14, active: true, validation: 'Verified', ctqIds: ['ctq_safety'] },
    { code: 'ae_rate', name: 'Non-serious AE rate', shortName: 'AE', unit: 'per subject-week', method: 'poisson_funnel', flagDirection: 'both', amber: 0.35, red: 0.45, active: true, validation: 'Verified', ctqIds: ['ctq_data'] },
    { code: 'entry_timeliness', name: 'Data entry timeliness', shortName: 'Entry', unit: 'median days', method: 'discrete', flagDirection: 'high', amber: 5, red: 10, active: true, validation: 'Verified', ctqIds: ['ctq_data'] },
    { code: 'missed_visits', name: 'Missed visits', shortName: 'Visits', unit: '% of planned', method: 'binomial_funnel', flagDirection: 'high', amber: 0.05, red: 0.10, active: true, validation: 'Verified', ctqIds: ['ctq_endpoint'] },
    { code: 'manual_query_rate', name: 'Manual query rate', shortName: 'Query', unit: 'per eCRF page', method: 'funnel', flagDirection: 'both', amber: 0.06, red: 0.09, active: true, validation: 'Verified', ctqIds: ['ctq_data'] },
    { code: 'lab_noncompliance', name: 'Local lab non-compliance', shortName: 'Lab', unit: '% of samples', method: 'binomial_funnel', flagDirection: 'high', amber: 0.05, red: 0.10, active: true, validation: 'Sponsor-defined', ctqIds: ['ctq_data'] },
    { code: 'query_response_time', name: 'Query response time', shortName: 'Resp', unit: 'median days', method: 'discrete_peer', flagDirection: 'high', amber: 7, red: 14, active: true, validation: 'Verified', ctqIds: ['ctq_data'] },
    { code: 'open_queries_30d', name: 'Open queries over 30 days', shortName: '>30d', unit: '% open', method: 'discrete', flagDirection: 'high', amber: 0.05, red: 0.15, active: true, validation: 'Plausible', ctqIds: ['ctq_data'] },
    { code: 'protocol_deviations', name: 'Protocol deviations', shortName: 'Dev', unit: 'per subject-month', method: 'poisson_funnel', flagDirection: 'high', amber: 0.05, red: 0.10, active: true, validation: 'Verified', ctqIds: ['ctq_compliance'] },
    { code: 'ecg_quality', name: 'ECG quality', shortName: 'ECG', unit: '% not evaluable', method: 'binomial_funnel', flagDirection: 'high', amber: 0.03, red: 0.06, active: true, validation: 'Sponsor-defined', ctqIds: ['ctq_endpoint'] },
    // Library extras, inactive by default (two activated in MET-3120 per spec section 4).
    { code: 'enrollment_rate', name: 'Enrollment rate', shortName: 'Enroll', unit: 'subjects / month', method: 'discrete', flagDirection: 'low', amber: 1, red: 0.5, active: false, validation: 'Plausible', ctqIds: [] },
    { code: 'screen_failure_rate', name: 'Screen failure rate', shortName: 'ScrFail', unit: '% of screened', method: 'binomial_funnel', flagDirection: 'high', amber: 0.25, red: 0.35, active: false, validation: 'Verified', ctqIds: [] },
    { code: 'early_termination_rate', name: 'Early termination rate', shortName: 'EarlyTerm', unit: '% of enrolled', method: 'binomial_funnel', flagDirection: 'high', amber: 0.12, red: 0.20, active: false, validation: 'Verified', ctqIds: [] },
    { code: 'off_schedule_visit_rate', name: 'Off-schedule visit rate', shortName: 'OffSched', unit: '% of visits', method: 'binomial_funnel', flagDirection: 'high', amber: 0.10, red: 0.18, active: false, validation: 'Verified', ctqIds: [] },
    { code: 'informed_consent_issues', name: 'Informed consent issues', shortName: 'ICF', unit: 'count', method: 'discrete', flagDirection: 'high', amber: 1, red: 3, active: false, validation: 'Sponsor-defined', ctqIds: ['ctq_rights'] },
    { code: 'sae_reporting_timeliness', name: 'SAE reporting timeliness', shortName: 'SAE-24h', unit: '% within 24h', method: 'binomial_funnel', flagDirection: 'low', amber: 0.85, red: 0.75, active: false, validation: 'Verified', ctqIds: ['ctq_safety'] },
    { code: 'overdue_monitoring_visits', name: 'Overdue monitoring visits', shortName: 'OverdueVisit', unit: 'count', method: 'discrete', flagDirection: 'high', amber: 1, red: 3, active: false, validation: 'Plausible', ctqIds: [] },
    { code: 'data_variability', name: 'Data variability and digit preference', shortName: 'Variability', unit: 'percentile', method: 'discrete', flagDirection: 'low', amber: 0.10, red: 0.03, active: false, validation: 'Sponsor-defined', ctqIds: ['ctq_data'] }
  ];

  var METABOLIC_ACTIVE_EXTRAS = ['screen_failure_rate', 'early_termination_rate'];

  var CTQ_FACTORS = [
    { id: 'ctq_safety', name: 'Participant safety', description: 'Serious events are detected and reported on time.' },
    { id: 'ctq_data', name: 'Data reliability', description: 'Entered data is timely, complete and queried appropriately.' },
    { id: 'ctq_endpoint', name: 'Endpoint integrity', description: 'Primary assessments and visits happen as planned.' },
    { id: 'ctq_compliance', name: 'Compliance', description: 'The study is run within protocol and regulatory bounds.' },
    { id: 'ctq_rights', name: 'Participant rights', description: 'Consent is valid and participants understand the study.' }
  ];

  function byCode(code) { return KRIS.filter(function (k) { return k.code === code; })[0] || null; }

  /** Applies any user threshold/active edits (RBQM_STORE overlay) over the catalog defaults,
      in place, once per page load, before the generator computes KRI statuses from them -
      this is the single place "effective" thresholds are resolved. */
  function applyOverlay(store) {
    var overlay = store.get('kriThresholds') || {};
    KRIS.forEach(function (k) {
      var patch = overlay[k.code];
      if (!patch) return;
      if (patch.amber != null) k.amber = patch.amber;
      if (patch.red != null) k.red = patch.red;
      if (patch.active != null) k.active = patch.active;
    });
    // Custom indicators created at runtime (Risk indicators page) aren't in the static
    // catalog - add them so they show up in lists, with no computed data (insufficient).
    Object.keys(overlay).forEach(function (code) {
      var patch = overlay[code];
      if (patch.custom && !byCode(code)) {
        KRIS.push({
          code: code, name: patch.name, shortName: patch.name.slice(0, 10), unit: patch.unit || 'count',
          method: patch.method || 'discrete', flagDirection: patch.flagDirection || 'high',
          amber: patch.amber, red: patch.red, active: patch.active !== false, validation: patch.validation || 'Sponsor-defined',
          ctqIds: [], custom: true, noData: true
        });
      }
    });
  }

  global.RBQM_KRI_CATALOG = {
    KRIS: KRIS,
    CTQ_FACTORS: CTQ_FACTORS,
    METABOLIC_ACTIVE_EXTRAS: METABOLIC_ACTIVE_EXTRAS,
    byCode: byCode,
    applyOverlay: applyOverlay
  };
})(window);
