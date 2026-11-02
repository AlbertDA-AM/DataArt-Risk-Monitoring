/* Risk library: indication templates for "Add from library" and mitigation text templates mapped to
   CtQ factors for "AI draft mitigation" (Risk register). Hand-written, synthetic. */
(function (global) {
  'use strict';

  var TEMPLATES = [
    { id: 'LIB-CV-1', indication: 'Cardiovascular', description: 'Late SAE reporting beyond the 24-hour rule', ctqId: 'ctq_safety', probability: 4, impact: 5, kriCodes: ['sae_reporting_timeliness', 'sae_rate'] },
    { id: 'LIB-CV-2', indication: 'Cardiovascular', description: 'ECG recordings not evaluable after a device change', ctqId: 'ctq_endpoint', probability: 3, impact: 3, kriCodes: ['ecg_quality'] },
    { id: 'LIB-CV-3', indication: 'Cardiovascular', description: 'Blood pressure measured outside the protocol method', ctqId: 'ctq_data', probability: 3, impact: 3, kriCodes: ['data_variability'] },
    { id: 'LIB-CV-4', indication: 'Cardiovascular', description: 'Missed primary assessment visits during peak enrollment', ctqId: 'ctq_endpoint', probability: 3, impact: 4, kriCodes: ['missed_visits'] },
    { id: 'LIB-MET-1', indication: 'Metabolic', description: 'Local lab non-compliance after a courier or lab change', ctqId: 'ctq_data', probability: 4, impact: 4, kriCodes: ['lab_noncompliance'] },
    { id: 'LIB-MET-2', indication: 'Metabolic', description: 'Slow data entry and query response at remote sites', ctqId: 'ctq_data', probability: 3, impact: 2, kriCodes: ['entry_timeliness', 'query_response_time'] },
    { id: 'LIB-MET-3', indication: 'Metabolic', description: 'Prohibited medication use not captured at visits', ctqId: 'ctq_compliance', probability: 3, impact: 3, kriCodes: ['protocol_deviations'] },
    { id: 'LIB-MET-4', indication: 'Metabolic', description: 'Dosing errors from self-administration diaries', ctqId: 'ctq_compliance', probability: 3, impact: 3, kriCodes: ['protocol_deviations'] },
    { id: 'LIB-ONC-1', indication: 'Oncology', description: 'Tumor assessments done outside the imaging window', ctqId: 'ctq_endpoint', probability: 3, impact: 4, kriCodes: ['missed_visits'] },
    { id: 'LIB-ONC-2', indication: 'Oncology', description: 'Late SAE reporting at high-enrollment sites', ctqId: 'ctq_safety', probability: 3, impact: 4, kriCodes: ['sae_reporting_timeliness'] },
    { id: 'LIB-ONC-3', indication: 'Oncology', description: 'Data variability suggesting possible fabrication at one site', ctqId: 'ctq_data', probability: 2, impact: 5, kriCodes: ['data_variability'] },
    { id: 'LIB-ONC-4', indication: 'Oncology', description: 'Informed consent version not updated after an amendment', ctqId: 'ctq_rights', probability: 2, impact: 4, kriCodes: [] }
  ];

  var MITIGATION_BY_CTQ = {
    ctq_safety: 'Remind sites of the reporting timelines, add a weekly SAE reconciliation with the safety database, and review late reports at each monitoring touchpoint.',
    ctq_data: 'Set an entry and query response target for the site, run a weekly aging report, and agree a catch-up plan with the monitor if the target is missed twice.',
    ctq_endpoint: 'Confirm assessment schedules with the site before each visit window opens, use central review of the primary assessment, and track missed assessments weekly.',
    ctq_compliance: 'Retrain the site on the requirement, add a checklist to the visit workflow, and review deviation categories monthly for repeat patterns.',
    ctq_rights: 'Verify the current consent version at every visit, track re-consent after each amendment, and sample consent forms during monitoring.',
    none: 'Agree an owner and a review date, track the risk in the monthly study review, and add an indicator if it escalates.'
  };

  global.RBQM_RISK_LIBRARY = {
    templates: TEMPLATES,
    mitigationByCtq: MITIGATION_BY_CTQ,
    indications: ['Cardiovascular', 'Metabolic', 'Oncology'],
    mitigationFor: function (ctqId) { return MITIGATION_BY_CTQ[ctqId] || MITIGATION_BY_CTQ.none; },
    /** Creates a Draft risk in the Risk register (overlay, persisted, audited). Shared by Protocol intelligence and the assistant. */
    createDraftRisk: function (fields) {
      var STORE = global.RBQM_STORE;
      var id = fields.id || ('R-D-' + Date.now().toString().slice(-6));
      var prob = Math.max(1, Math.min(5, fields.probability || 3)), impact = Math.max(1, Math.min(5, fields.impact || 3));
      var risk = { id: id, custom: true, studyId: fields.studyId, description: fields.description, probability: prob, impact: impact, detectability: 3, score: prob * impact,
        ctqId: fields.ctqId || null, kriCodes: fields.kriCodes || [], status: 'Draft', ownerId: 'U-001', mitigation: MITIGATION_BY_CTQ[fields.ctqId] || MITIGATION_BY_CTQ.none, libraryId: fields.libraryId || null };
      STORE.patch('risks', id, risk);
      STORE.logAudit('Risk', id, null, 'Draft risk created: ' + fields.description);
      return risk;
    }
  };
})(window);
