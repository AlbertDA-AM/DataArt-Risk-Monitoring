/* Seeded, reproducible synthetic data generator - part 1: sites, subjects, visits, exposure,
   KRI results. Follows prep-docs/04-seeded-storylines.md. Output consumed by seed.js and
   cached there; never hand-edit the output. Part 2 (signals/CAPA/risk register/QTL/ROI) is
   in generator-workflow.js and extends the same RBQM_GENERATOR namespace. */
(function (global) {
  'use strict';

  var REF = global.RBQM_REFERENCE;
  var KRI = global.RBQM_KRI_CATALOG;
  var STATS = global.RBQM_STATS;
  var SCORING = global.RBQM_SCORING;
  var CFG = global.RBQM_CONFIG;

  // ---------- seeded PRNG (mulberry32) ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var ASOF = new Date(CFG.asOfDate);

  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function addDays(date, n) { var d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function iso(date) { return date.toISOString().slice(0, 10); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function randInt(rng, min, max) { return min + Math.floor(rng() * (max - min + 1)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Reserved 3-digit site codes used by named storylines - never reused for filler sites.
  var RESERVED_CODES = ['114', '207', '052', '301', '305', '311', '415', '422', '258', '331', '089', '018', '143', '401', '266'];

  // Named site placements: code -> { study, country }. Everything else is filled proceduraly.
  var NAMED_PLACEMENTS = {
    '114': { study: 'CV-5645', country: 'PL' },
    '207': { study: 'CV-5645', country: 'BR' },
    '052': { study: 'CV-5645', country: 'DE' },
    '331': { study: 'CV-5645', country: 'US' },
    '018': { study: 'CV-5645', country: 'ES' },
    '076': { study: 'CV-5645', country: 'IT' },
    '143': { study: 'CV-5645', country: 'FR' },
    '089': { study: 'CV-5645', country: 'KR' },
    '401': { study: 'CV-5645', country: 'US' },
    '301': { study: 'MET-3120', country: 'AR' },
    '305': { study: 'MET-3120', country: 'AR' },
    '311': { study: 'MET-3120', country: 'AR' },
    '258': { study: 'MET-3120', country: 'IN' },
    '266': { study: 'MET-3120', country: 'BR' },
    '415': { study: 'ONC-2217', country: 'US' },
    '422': { study: 'ONC-2217', country: 'CA' }
  };

  function buildSites(rng) {
    var sites = [];
    var usedCodes = {};
    RESERVED_CODES.forEach(function (c) { usedCodes[c] = true; });
    var nextAuto = 2;
    function nextCode() {
      while (usedCodes[String(nextAuto).padStart(3, '0')]) nextAuto++;
      var code = String(nextAuto).padStart(3, '0');
      usedCodes[code] = true;
      nextAuto++;
      return code;
    }

    REF.STUDIES.forEach(function (study) {
      var matrix = REF.SITE_MATRIX[study.id];
      var studyStartDays = study.id === 'CV-5645' ? 420 : (study.id === 'ONC-2217' ? 300 : 360); // days before asOf fpi happened
      Object.keys(matrix).forEach(function (iso2) {
        var count = matrix[iso2];
        for (var i = 0; i < count; i++) {
          // Does a named site belong in this (study,country) cell and not yet placed?
          // (find the first match only - do not mark every candidate as placed)
          var namedCode = null;
          var candidateCodes = Object.keys(NAMED_PLACEMENTS);
          for (var ci = 0; ci < candidateCodes.length; ci++) {
            var cCode = candidateCodes[ci];
            var p = NAMED_PLACEMENTS[cCode];
            if (p.study === study.id && p.country === iso2 && !p.placed) {
              namedCode = cCode;
              p.placed = true;
              break;
            }
          }
          var code = namedCode || nextCode();
          var isNewSite = code === '401';
          var isClosed = code === '266';
          var activationDaysAgo = isNewSite ? 21 : randInt(rng, 60, studyStartDays);
          var activationDate = addDays(ASOF, -activationDaysAgo);
          var plannedEnrollment = Math.max(4, Math.round((study.subjects / study.sites) * (0.7 + rng() * 0.6)));
          var craTeam = (code === '114' || code === '207' || code === '052') ? 'B' : pick(rng, study.craTeams);
          sites.push({
            id: 'Site-' + code,
            code: code,
            studyId: study.id,
            country: iso2,
            city: REF.countryByIso(iso2).name + ' site ' + code,
            status: isClosed ? 'closed' : 'active',
            isNew: isNewSite,
            activationDate: iso(activationDate),
            piInitials: pick(rng, 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')) + '.' + pick(rng, 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('')) + '.',
            plannedEnrollment: plannedEnrollment,
            croId: study.cro,
            craTeam: craTeam
          });
        }
      });
    });
    return sites;
  }

  function buildSnapshots() {
    var snapshots = [];
    REF.STUDIES.forEach(function (study) {
      var dates = [];
      var n = study.snapshots;
      for (var i = 0; i < n; i++) {
        var monthsAgo = n - 1 - i;
        dates.push(addDays(new Date('2026-07-23'), -monthsAgo * 30));
      }
      dates.forEach(function (d, idx) {
        var isLatest = idx === dates.length - 1;
        var isDraftExample = study.id === 'CV-5645' && iso(d) === '2026-03-25';
        snapshots.push({
          id: study.id + '-SNAP-' + iso(d),
          studyId: study.id,
          date: iso(d),
          index: idx,
          status: isLatest ? 'Finalized' : 'Finalized',
          createdBy: 'U-001'
        });
      });
      // Replace the snapshot nearest 25 Mar 2026 with an explicit draft to show that state.
      var draftTarget = addDays(new Date('2026-03-25'), 0);
      if (study.id === 'CV-5645') {
        var nearest = snapshots.filter(function (s) { return s.studyId === study.id; })
          .reduce(function (a, b) { return Math.abs(new Date(a.date) - draftTarget) < Math.abs(new Date(b.date) - draftTarget) ? a : b; });
        nearest.status = 'Draft';
        nearest.date = '2026-03-25';
      }
    });
    return snapshots;
  }

  function subjectWeeksAsOf(enrollDate, discontinuationDate) {
    var end = discontinuationDate ? new Date(discontinuationDate) : ASOF;
    var weeks = daysBetween(new Date(enrollDate), end) / 7;
    return Math.max(0, weeks);
  }

  function buildSubjectsAndVisits(rng, sites) {
    var subjects = [];
    var visits = [];
    var subjSeq = 1;
    sites.forEach(function (site) {
      if (site.status === 'closed') return; // closed sites excluded from active rosters
      var country = REF.countryByIso(site.country);
      var n = site.isNew ? randInt(rng, 2, 3) : site.plannedEnrollment;
      var siteStart = new Date(site.activationDate);
      var spanDays = Math.max(14, daysBetween(siteStart, ASOF));
      for (var i = 0; i < n; i++) {
        var enrollOffset = Math.floor(rng() * spanDays * 0.85);
        var enrollDate = addDays(siteStart, enrollOffset);
        if (enrollDate > ASOF) enrollDate = ASOF;
        var discontinued = rng() < 0.08;
        var discDate = discontinued ? addDays(enrollDate, randInt(rng, 30, Math.max(31, daysBetween(enrollDate, ASOF)))) : null;
        if (discDate && discDate > ASOF) discDate = null, discontinued = false;
        var subj = {
          id: 'SUBJ-' + site.code + '-' + String(i + 1).padStart(3, '0'),
          siteId: site.id,
          enrollDate: iso(enrollDate),
          status: discontinued ? 'discontinued' : 'ongoing',
          arm: rng() < 0.5 ? 'A' : 'B',
          discontinuationDate: discDate ? iso(discDate) : null
        };
        subjects.push(subj);
        subjSeq++;

        var weeksOnStudy = subjectWeeksAsOf(subj.enrollDate, subj.discontinuationDate);
        var visitCount = Math.max(1, Math.round(weeksOnStudy / 4.3));
        for (var v = 0; v < visitCount; v++) {
          var plannedDate = addDays(enrollDate, v * 30);
          if (plannedDate > ASOF) break;
          var entryLagBase = 2.5 * country.entryMult;
          var missed = rng() < 0.03;
          var actualDate = missed ? null : addDays(plannedDate, randInt(rng, -2, 4));
          var entryDate = missed ? null : addDays(actualDate, Math.max(0, Math.round(entryLagBase + (rng() - 0.3) * 4)));
          visits.push({
            id: 'VISIT-' + subj.id + '-' + v,
            subjectId: subj.id,
            siteId: site.id,
            name: v === 0 ? 'Baseline' : 'Visit ' + (v + 1),
            plannedDate: iso(plannedDate),
            actualDate: actualDate ? iso(actualDate) : null,
            entryDate: entryDate ? iso(entryDate) : null,
            missed: missed,
            windowStatus: missed ? 'missed' : 'on-time'
          });
        }
      }
    });
    return { subjects: subjects, visits: visits };
  }

  function siteExposure(site, subjects) {
    var siteSubjects = subjects.filter(function (s) { return s.siteId === site.id; });
    var weeks = siteSubjects.reduce(function (sum, s) { return sum + subjectWeeksAsOf(s.enrollDate, s.discontinuationDate); }, 0);
    return { subjectCount: siteSubjects.length, subjectWeeks: Math.round(weeks * 100) / 100 };
  }

  global.RBQM_GENERATOR = {
    mulberry32: mulberry32, ASOF: ASOF, daysBetween: daysBetween, addDays: addDays, iso: iso,
    pick: pick, randInt: randInt, clamp: clamp,
    buildSites: buildSites, buildSnapshots: buildSnapshots, buildSubjectsAndVisits: buildSubjectsAndVisits,
    siteExposure: siteExposure, subjectWeeksAsOf: subjectWeeksAsOf
  };
})(window);
