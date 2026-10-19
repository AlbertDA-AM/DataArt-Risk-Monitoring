/* Seeded generator - part 2: KRI results, signals, CAPA, risk register, QTLs, monitoring plan,
   ROI, audit trail. Extends RBQM_GENERATOR. Named storyline numbers come from
   prep-docs/04-seeded-storylines.md; everything else is procedural with seeded noise. */
(function (global) {
  'use strict';

  var G = global.RBQM_GENERATOR;
  var REF = global.RBQM_REFERENCE;
  var KRI = global.RBQM_KRI_CATALOG;
  var STATS = global.RBQM_STATS;
  var SCORING = global.RBQM_SCORING;
  var CFG = global.RBQM_CONFIG;

  var BASE_RATES = {
    sae_rate: 0.045, ae_rate: 0.27, entry_timeliness: 4, missed_visits: 0.035,
    manual_query_rate: 0.035, lab_noncompliance: 0.03, query_response_time: 5.5,
    open_queries_30d: 0.04, protocol_deviations: 0.035, ecg_quality: 0.022
  };

  // Exact or near-exact numbers for named storyline sites, applied to the latest finalized
  // snapshot of their study. Fields not listed use the generic procedural path.
  var STORYLINE = {
    '114': {
      craTeam: 'B', riskScore: 86,
      kri: {
        ae_rate: { numerator: 47, denominator: 89.85, status: 'action' },
        sae_rate: { value: 0.09, status: 'watch' },
        entry_timeliness: { value: 11, status: 'action' },
        open_queries_30d: { value: 0.18, status: 'action' },
        manual_query_rate: { status: 'action' }
      },
      openQueries: 31
    },
    '207': {
      craTeam: 'B', riskScore: 79,
      kri: {
        ae_rate: { numerator: 9, denominator: 80, status: 'action', flagLow: true },
        protocol_deviations: { value: 0.03, status: 'watch' }
      }
    },
    '052': {
      craTeam: 'B', riskScore: 61,
      kri: {
        missed_visits: { value: 0.09, status: 'action' },
        entry_timeliness: { value: 6, status: 'watch' }
      }
    },
    '301': { riskScore: 68, kri: { lab_noncompliance: { value: 0.14, status: 'action' } } },
    '305': { riskScore: 71, kri: { lab_noncompliance: { value: 0.17, status: 'action' } } },
    '311': { riskScore: 65, kri: { lab_noncompliance: { value: 0.12, status: 'action' } } },
    '415': { riskScore: 74, kri: { data_variability: { value: 0.72, status: 'action' } } },
    '422': { riskScore: 72, kri: { sae_reporting_timeliness: { value: 0.61, status: 'action' } }, capaOverdueDays: 12 },
    '258': { riskScore: 63, kri: { entry_timeliness: { value: 14, status: 'action' }, query_response_time: { value: 15, status: 'action' } } },
    '331': { riskScore: 58, kri: { ecg_quality: { value: 0.09, status: 'action' } } },
    '089': { riskScore: 47, kri: { query_response_time: { value: 9, status: 'watch' } } },
    '018': { riskScore: 24, kri: { query_response_time: { value: 5, status: 'ok' } } },
    '143': { riskScore: 38, kri: { entry_timeliness: { value: 10, status: 'action' } } },
    '401': { insufficientData: true },
    '266': { closed: true }
  };

  function noiseFactor(rng, sigma) {
    sigma = sigma || 0.3;
    var f = Math.exp((rng() - 0.5) * 2 * sigma);
    return Math.max(0.35, Math.min(2.0, f));
  }

  function countryEffectFor(kriCode, country) {
    if (kriCode === 'entry_timeliness' || kriCode === 'query_response_time' || kriCode === 'manual_query_rate' || kriCode === 'open_queries_30d') return country.entryMult;
    if (kriCode === 'lab_noncompliance') return country.complianceMult;
    return 0.6 + 0.4 * ((country.entryMult + country.complianceMult) / 2);
  }

  function latestFinalizedSnapshotForStudy(snapshots, studyId) {
    var list = snapshots.filter(function (s) { return s.studyId === studyId && s.status === 'Finalized'; });
    return list.reduce(function (a, b) { return b.index > a.index ? b : a; });
  }

  function sampleKriSeries(rng, kriDef, site, exposureForSnapshot, override) {
    // exposureForSnapshot: fn(snapshotIndex) -> exposure basis (subject-weeks, visit count, etc.)
    var base = BASE_RATES[kriDef.code];
    var factor = noiseFactor(rng, 0.28);
    return factor;
  }

  function statusForValue(kriDef, value, flagLow) {
    var dir = kriDef.flagDirection;
    if (dir === 'low' || flagLow) {
      if (value < kriDef.red) return 'action';
      if (value < kriDef.amber) return 'watch';
      return 'ok';
    }
    if (value > kriDef.red) return 'action';
    if (value > kriDef.amber) return 'watch';
    return 'ok';
  }

  /** Build KRIResult rows for every active KRI, every site, every snapshot of its study. */
  function buildKriResults(rng, sites, subjects, visits, snapshots) {
    var results = []; // {snapshotId, siteId, kriCode, numerator, denominator, value, status, ciLow, ciHigh, peerRate}
    var activeKris = KRI.KRIS.filter(function (k) { return k.active; });

    sites.forEach(function (site) {
      var story = STORYLINE[site.code];
      if (story && story.closed) return;
      var country = REF.countryByIso(site.country);
      var studySnaps = snapshots.filter(function (s) { return s.studyId === site.studyId; }).sort(function (a, b) { return a.index - b.index; });
      var latest = studySnaps[studySnaps.length - 1];
      var siteVisits = visits.filter(function (v) { return v.siteId === site.id; });
      var siteSubjects = subjects.filter(function (s) { return s.siteId === site.id; });

      activeKris.forEach(function (kriDef) {
        if (BASE_RATES[kriDef.code] == null) {
          // Custom indicator created at runtime: no formula/history behind it yet.
          studySnaps.forEach(function (snap) {
            results.push({ snapshotId: snap.id, siteId: site.id, kriCode: kriDef.code, numerator: null, denominator: null, value: null, status: 'insufficient', ciLow: null, ciHigh: null });
          });
          return;
        }
        var override = story && story.kri && story.kri[kriDef.code];
        // Site-level smooth noise factor, stable per site+kri.
        var f = noiseFactor(rng, 0.3);

        studySnaps.forEach(function (snap) {
          if (story && story.insufficientData) {
            results.push({ snapshotId: snap.id, siteId: site.id, kriCode: kriDef.code, numerator: null, denominator: null, value: null, status: 'insufficient', ciLow: null, ciHigh: null });
            return;
          }
          var asOfDate = new Date(snap.date);
          var exposure = exposureBasis(kriDef.code, site, siteSubjects, siteVisits, asOfDate);
          var isLatest = snap.id === latest.id;
          var val, numerator, denominator, status;

          if (override && isLatest && override.numerator != null) {
            numerator = override.numerator; denominator = override.denominator; val = numerator / denominator;
            status = override.status;
          } else if (override && isLatest && override.value != null) {
            val = override.value; numerator = val; denominator = 1;
            status = override.status;
          } else {
            var driftShare = isLatest ? 1 : (snap.index + 1) / studySnaps.length;
            var targetFactor = override ? 1 + ((override.value != null ? 3 : 3) - 1) * driftShare : f;
            var effFactor = override ? (f * 0.3 + (1 + 2.2 * driftShare) * 0.7) : f;
            var ce = countryEffectFor(kriDef.code, country);
            var rate = BASE_RATES[kriDef.code] * ce * effFactor;
            if (kriDef.method === 'poisson_funnel' || kriDef.method === 'funnel') {
              numerator = poissonSample(rng, Math.max(0, rate * exposure));
              denominator = Math.round(exposure * 100) / 100;
              val = denominator > 0 ? numerator / denominator : 0;
            } else if (kriDef.method === 'binomial_funnel') {
              var n = Math.max(1, Math.round(exposure));
              var p = Math.max(0, Math.min(0.9, rate));
              numerator = binomialSample(rng, n, p);
              denominator = n;
              val = numerator / denominator;
            } else {
              val = Math.max(0, rate * (0.9 + rng() * 0.2));
              numerator = val; denominator = 1;
            }
            status = statusForValue(kriDef, val, kriDef.flagDirection === 'both' && false);
          }

          var ci = null;
          if (kriDef.method === 'poisson_funnel' || kriDef.method === 'funnel') ci = STATS.poissonCI(numerator, denominator || 1, 0.95);
          else if (kriDef.method === 'binomial_funnel') ci = STATS.binomialCI(numerator, denominator || 1, 0.95);

          results.push({
            snapshotId: snap.id, siteId: site.id, kriCode: kriDef.code,
            numerator: numerator, denominator: denominator, value: Math.round(val * 10000) / 10000,
            status: status, ciLow: ci ? Math.round(ci.low * 10000) / 10000 : null, ciHigh: ci ? Math.round(ci.high * 10000) / 10000 : null,
            peerRate: BASE_RATES[kriDef.code]
          });
        });
      });

      if (story && story.insufficientData) return;
    });

    return results;
  }

  function exposureBasis(kriCode, site, siteSubjects, siteVisits, asOfDate) {
    if (kriCode === 'ae_rate' || kriCode === 'sae_rate') {
      return siteSubjects.reduce(function (sum, s) {
        var end = s.discontinuationDate && new Date(s.discontinuationDate) < asOfDate ? new Date(s.discontinuationDate) : asOfDate;
        if (new Date(s.enrollDate) > asOfDate) return sum;
        return sum + Math.max(0, G.daysBetween(new Date(s.enrollDate), end) / 7);
      }, 0);
    }
    if (kriCode === 'protocol_deviations') {
      return siteSubjects.reduce(function (sum, s) {
        var end = s.discontinuationDate && new Date(s.discontinuationDate) < asOfDate ? new Date(s.discontinuationDate) : asOfDate;
        if (new Date(s.enrollDate) > asOfDate) return sum;
        return sum + Math.max(0, G.daysBetween(new Date(s.enrollDate), end) / 30.4);
      }, 0);
    }
    var dueVisits = siteVisits.filter(function (v) { return new Date(v.plannedDate) <= asOfDate; });
    if (kriCode === 'manual_query_rate') return dueVisits.length * 12;
    if (kriCode === 'lab_noncompliance') return Math.round(dueVisits.length * 0.8);
    if (kriCode === 'ecg_quality') return Math.round(dueVisits.length * 0.5);
    return dueVisits.length; // missed_visits, entry_timeliness, query_response_time, open_queries_30d
  }

  function poissonSample(rng, lambda) {
    if (lambda <= 0) return 0;
    if (lambda > 60) { // normal approx for large lambda, perf + stability
      var v = lambda + Math.sqrt(lambda) * normalSample(rng);
      return Math.max(0, Math.round(v));
    }
    var L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }

  function binomialSample(rng, n, p) {
    if (n > 200) { // normal approx
      var mean = n * p, sd = Math.sqrt(n * p * (1 - p));
      return Math.max(0, Math.min(n, Math.round(mean + sd * normalSample(rng))));
    }
    var count = 0;
    for (var i = 0; i < n; i++) if (rng() < p) count++;
    return count;
  }

  function normalSample(rng) {
    var u1 = Math.max(1e-9, rng()), u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  global.RBQM_GENERATOR = Object.assign(G, {
    BASE_RATES: BASE_RATES,
    STORYLINE: STORYLINE,
    buildKriResults: buildKriResults,
    poissonSample: poissonSample,
    binomialSample: binomialSample,
    latestFinalizedSnapshotForStudy: latestFinalizedSnapshotForStudy
  });
})(window);
