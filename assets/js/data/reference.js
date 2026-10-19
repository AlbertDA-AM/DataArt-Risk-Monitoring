/* Reference data: countries, CROs, vendors, study shells, the country x study site matrix,
   and synthetic users. Configuration, not randomly generated - verified to sum to the
   portfolio totals in prep-docs/04-seeded-storylines.md (125 sites, 15 countries). */
(function (global) {
  'use strict';

  var COUNTRIES = [
    { iso: 'US', name: 'United States', region: 'North America', entryMult: 1.0, complianceMult: 1.0 },
    { iso: 'CA', name: 'Canada', region: 'North America', entryMult: 1.0, complianceMult: 1.0 },
    { iso: 'BR', name: 'Brazil', region: 'Latin America', entryMult: 1.1, complianceMult: 1.1 },
    { iso: 'AR', name: 'Argentina', region: 'Latin America', entryMult: 1.1, complianceMult: 1.0 },
    { iso: 'UK', name: 'United Kingdom', region: 'Europe', entryMult: 0.95, complianceMult: 0.95 },
    { iso: 'FR', name: 'France', region: 'Europe', entryMult: 1.0, complianceMult: 1.0 },
    { iso: 'DE', name: 'Germany', region: 'Europe', entryMult: 0.95, complianceMult: 0.95 },
    { iso: 'PL', name: 'Poland', region: 'Europe', entryMult: 1.5, complianceMult: 1.0 },
    { iso: 'ES', name: 'Spain', region: 'Europe', entryMult: 1.0, complianceMult: 1.0 },
    { iso: 'IT', name: 'Italy', region: 'Europe', entryMult: 1.05, complianceMult: 1.0 },
    { iso: 'ZA', name: 'South Africa', region: 'Africa', entryMult: 1.1, complianceMult: 1.05 },
    { iso: 'IN', name: 'India', region: 'Asia', entryMult: 1.6, complianceMult: 1.1 },
    { iso: 'JP', name: 'Japan', region: 'Asia', entryMult: 0.9, complianceMult: 0.3 },
    { iso: 'KR', name: 'South Korea', region: 'Asia', entryMult: 1.0, complianceMult: 0.9 },
    { iso: 'AU', name: 'Australia', region: 'Oceania', entryMult: 0.95, complianceMult: 0.95 }
  ];

  var CROS = [
    { id: 'CRO-A', name: 'CRO-A', type: 'CRO' },
    { id: 'CRO-B', name: 'CRO-B', type: 'CRO' },
    { id: 'CRO-C', name: 'CRO-C', type: 'CRO' }
  ];

  var VENDORS = [
    { id: 'LAB-1', name: 'Central lab 1', type: 'central lab' },
    { id: 'LAB-2', name: 'Central lab 2', type: 'central lab' },
    { id: 'ECG-1', name: 'ECG vendor', type: 'ECG vendor' }
  ];

  var USERS = [
    { id: 'U-001', name: 'A. Novak', title: 'Central monitoring lead' },
    { id: 'U-002', name: 'R. Dlamini', title: 'Clinical operations manager' },
    { id: 'U-003', name: 'M. Costa', title: 'Quality approver' },
    { id: 'U-004', name: 'S. Takahashi', title: 'Medical monitor' },
    { id: 'U-005', name: 'J. Kowalski', title: 'CRA, team B' },
    { id: 'U-006', name: 'P. Singh', title: 'Data manager' },
    { id: 'U-007', name: 'E. Fischer', title: 'Biostatistician' },
    { id: 'U-008', name: 'L. Moreau', title: 'CRA, team A' },
    { id: 'U-009', name: 'T. Okafor', title: 'Study lead, CV-5645' },
    { id: 'U-010', name: 'H. Garcia', title: 'Study lead, ONC-2217' }
  ];

  // Study shells. snapshotDates generated monthly ending at latestFinalizedSnapshot, plus a
  // draft snapshot kept for CV-5645 (25 Mar 2026).
  var STUDIES = [
    { id: 'CV-5645', title: 'Heart failure outcomes', indication: 'Cardiovascular', phase: 'III', sites: 60, countries: 12, subjects: 900, snapshots: 8, cro: 'CRO-A', craTeams: ['A', 'B', 'C'] },
    { id: 'ONC-2217', title: 'Diffuse large B-cell lymphoma', indication: 'Oncology', phase: 'II', sites: 25, countries: 8, subjects: 500, snapshots: 5, cro: 'CRO-B', craTeams: ['A', 'B'] },
    { id: 'MET-3120', title: 'Type 2 diabetes', indication: 'Metabolic', phase: 'III', sites: 40, countries: 10, subjects: 1400, snapshots: 5, cro: 'CRO-C', craTeams: ['A', 'B'] }
  ];

  // Country x study site-count matrix. Verified: row sums equal country totals below,
  // column sums equal study totals above, and distinct non-zero cells per study equal
  // the "countries" figure above. Total = 125.
  var SITE_MATRIX = {
    'CV-5645': { PL: 8, BR: 4, DE: 4, US: 10, ES: 6, IT: 7, FR: 6, KR: 5, ZA: 3, UK: 5, JP: 1, AU: 1 },
    'ONC-2217': { CA: 6, US: 9, DE: 3, ES: 1, ZA: 2, UK: 1, JP: 2, AU: 1 },
    'MET-3120': { AR: 7, IN: 10, PL: 1, BR: 4, DE: 3, US: 3, FR: 3, KR: 1, JP: 5, AU: 3 }
  };

  var COUNTRY_TOTALS = { PL: 9, BR: 8, DE: 10, US: 22, ES: 7, IT: 7, FR: 9, KR: 6, CA: 6, AR: 7, IN: 10, ZA: 5, UK: 6, JP: 8, AU: 5 };

  function countryByIso(iso) { return COUNTRIES.filter(function (c) { return c.iso === iso; })[0] || null; }

  global.RBQM_REFERENCE = {
    COUNTRIES: COUNTRIES,
    CROS: CROS,
    VENDORS: VENDORS,
    USERS: USERS,
    STUDIES: STUDIES,
    SITE_MATRIX: SITE_MATRIX,
    COUNTRY_TOTALS: COUNTRY_TOTALS,
    countryByIso: countryByIso
  };
})(window);
