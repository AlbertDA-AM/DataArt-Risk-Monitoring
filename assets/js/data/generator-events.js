/* Individual protocol deviation records, derived to match the already-computed
   protocol_deviations KRIResult numerator per site (so the category/importance
   breakdown on the Protocol deviations page sums to the same count shown
   everywhere else) - consistent with the "single source of truth" rule in CLAUDE.md. */
(function (global) {
  'use strict';
  var G = global.RBQM_GENERATOR;

  var CATEGORIES = ['Eligibility', 'Informed consent', 'Visit window', 'Prohibited medication', 'Dosing', 'Procedure not followed'];
  var IMPORTANCE_WEIGHTS = [['Minor', 0.68], ['Major', 0.27], ['Critical', 0.05]];
  var STATUSES = ['Open', 'Classified', 'Linked to signal', 'Linked to CAPA'];

  function weightedPick(rng, weighted) {
    var r = rng(), acc = 0;
    for (var i = 0; i < weighted.length; i++) { acc += weighted[i][1]; if (r <= acc) return weighted[i][0]; }
    return weighted[weighted.length - 1][0];
  }

  function buildProtocolDeviations(rng, sites, subjects, kriResults, snapshots) {
    var records = [];
    var seq = 1;
    sites.forEach(function (site) {
      if (site.status === 'closed') return;
      var snap = G.latestFinalizedSnapshotForStudy(snapshots, site.studyId);
      var row = kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === 'protocol_deviations' && r.snapshotId === snap.id; })[0];
      if (!row || !row.numerator) return;
      var count = Math.round(row.numerator);
      var siteSubjects = subjects.filter(function (s) { return s.siteId === site.id; });
      if (!siteSubjects.length) return;
      for (var i = 0; i < count; i++) {
        var subj = siteSubjects[Math.floor(rng() * siteSubjects.length)];
        var importance = weightedPick(rng, IMPORTANCE_WEIGHTS);
        var daysAgo = Math.floor(rng() * 150);
        records.push({
          id: 'PD-' + String(seq++).padStart(4, '0'),
          subjectId: subj.id, siteId: site.id, studyId: site.studyId,
          category: CATEGORIES[Math.floor(rng() * CATEGORIES.length)],
          importance: importance,
          date: G.iso(G.addDays(G.ASOF, -daysAgo)),
          status: importance === 'Critical' ? 'Linked to CAPA' : (importance === 'Major' ? 'Linked to signal' : STATUSES[Math.floor(rng() * 2)])
        });
      }
    });
    return records;
  }

  var AE_TERMS = ['Headache', 'Nausea', 'Fatigue', 'Dizziness', 'Hypertension', 'Hypotension', 'Arrhythmia', 'Peripheral edema', 'Dyspnea', 'Rash'];
  var SAE_TERMS = ['Cardiac failure', 'Myocardial infarction', 'Arrhythmia', 'Stroke', 'Renal failure', 'Pneumonia', 'Sepsis', 'GI haemorrhage'];
  var RELATEDNESS = [['Unrelated', 0.45], ['Possibly related', 0.35], ['Related', 0.20]];
  var AE_SEVERITY = [['Mild', 0.55], ['Moderate', 0.35], ['Severe', 0.10]];
  var SAE_SEVERITY = [['Moderate', 0.3], ['Severe', 0.7]];

  /** Individual AE/SAE records, derived from the already-computed ae_rate/sae_rate numerators
      (same pattern as buildProtocolDeviations) for the Safety review page. */
  function buildAdverseEvents(rng, sites, subjects, kriResults, snapshots) {
    var records = [];
    var seq = 1;
    sites.forEach(function (site) {
      if (site.status === 'closed') return;
      var snap = G.latestFinalizedSnapshotForStudy(snapshots, site.studyId);
      var siteSubjects = subjects.filter(function (s) { return s.siteId === site.id; });
      if (!siteSubjects.length) return;
      [{ code: 'ae_rate', serious: false, terms: AE_TERMS, sevW: AE_SEVERITY }, { code: 'sae_rate', serious: true, terms: SAE_TERMS, sevW: SAE_SEVERITY }].forEach(function (kind) {
        var row = kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === kind.code && r.snapshotId === snap.id; })[0];
        if (!row || !row.numerator) return;
        var count = Math.round(row.numerator);
        // Site 422 storyline: SAE reporting within 24h is 61% (vs 90% study); other sites ~90% on time.
        var lateChance = site.code === '422' ? 0.39 : 0.1;
        for (var i = 0; i < count; i++) {
          var subj = siteSubjects[Math.floor(rng() * siteSubjects.length)];
          var onsetDaysAgo = Math.floor(rng() * 150);
          var isLate = kind.serious && rng() < lateChance;
          var reportDelayDays = isLate ? 2 : 0;
          records.push({
            id: (kind.serious ? 'SAE-' : 'AE-') + String(seq++).padStart(4, '0'),
            subjectId: subj.id, siteId: site.id, studyId: site.studyId, serious: kind.serious,
            term: kind.terms[Math.floor(rng() * kind.terms.length)],
            severity: weightedPick(rng, kind.sevW), relatedness: weightedPick(rng, RELATEDNESS),
            onset: G.iso(G.addDays(G.ASOF, -onsetDaysAgo)),
            reportedDate: kind.serious ? G.iso(G.addDays(G.ASOF, -onsetDaysAgo + reportDelayDays)) : null,
            withinReportingWindow: kind.serious ? !isLate : null
          });
        }
      });
    });
    return records;
  }

  global.RBQM_GENERATOR = Object.assign(G, {
    buildProtocolDeviations: buildProtocolDeviations, PD_CATEGORIES: CATEGORIES,
    buildAdverseEvents: buildAdverseEvents, AE_TERMS: AE_TERMS, SAE_TERMS: SAE_TERMS
  });
})(window);
