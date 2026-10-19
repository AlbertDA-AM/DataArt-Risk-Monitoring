/* Global config: single source of truth for product name, sponsor, demo clock, nav. */
(function (global) {
  'use strict';

  var CONFIG = {
    productName: 'DataArt RBQM Insight',
    sponsorLabel: 'Sponsor-0430',
    sponsorId: 'Sponsor-0430',
    asOfDate: '2026-07-24T06:00:00',
    asOfDateDisplay: '24 Jul, 06:00',
    latestFinalizedSnapshot: '2026-07-23',
    footerDisclaimer: 'Prototype with synthetic data. Not validated for regulated use.',
    storagePrefix: 'rbqm_',
    storageVersion: 1
  };

  // Sidebar navigation: group -> items. href is the page file. icon is a dot (status-free).
  // Sub-pages (Study detail, KRI detail, Site profile, Subject drill-down) are reached by drill-down only.
  var NAV = [
    {
      group: 'Monitor',
      items: [
        { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html' },
        { id: 'what-changed', label: 'What changed', href: 'what-changed.html' },
        { id: 'studies', label: 'Studies', href: 'studies.html' },
        { id: 'sites', label: 'Sites', href: 'sites.html' },
        { id: 'risk-indicators', label: 'Risk indicators', href: 'risk-indicators.html' },
        { id: 'signals', label: 'Signals', href: 'signals.html', badgeKey: 'openSignals' }
      ]
    },
    {
      group: 'Act',
      items: [
        { id: 'issues-capa', label: 'Issues and CAPA', href: 'issues-capa.html', badgeKey: 'overdueCapas' },
        { id: 'protocol-deviations', label: 'Protocol deviations', href: 'protocol-deviations.html' },
        { id: 'monitoring-plan', label: 'Monitoring plan', href: 'monitoring-plan.html' }
      ]
    },
    {
      group: 'Plan and prove',
      items: [
        { id: 'risk-register', label: 'Risk register', href: 'risk-register.html' },
        { id: 'quality-limits', label: 'Quality limits', href: 'quality-limits.html' },
        { id: 'reports-audit', label: 'Reports and audit', href: 'reports-audit.html' },
        { id: 'inspection-readiness', label: 'Inspection readiness', href: 'inspection-readiness.html' },
        { id: 'scenario-view', label: 'Scenario view', href: 'scenario-view.html' }
      ]
    },
    {
      group: 'Oversight',
      items: [
        { id: 'cro-oversight', label: 'CRO oversight', href: 'cro-oversight.html' },
        { id: 'benchmarking', label: 'Benchmarking', href: 'benchmarking.html' },
        { id: 'safety-review', label: 'Safety review', href: 'safety-review.html' }
      ]
    },
    {
      group: 'System',
      items: [
        { id: 'integrations', label: 'Integrations', href: 'integrations.html' },
        { id: 'glossary-help', label: 'Glossary and help', href: 'glossary-help.html' }
      ]
    }
  ];

  global.RBQM_CONFIG = CONFIG;
  global.RBQM_NAV = NAV;
})(window);
