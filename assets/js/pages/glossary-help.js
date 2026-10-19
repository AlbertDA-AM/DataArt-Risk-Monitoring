/* Glossary and help: searchable glossary (prep-docs/03-glossary-and-microcopy.md), plus a
   short "how this product works" section. */
(function (global) {
  'use strict';

  var GLOSSARY = [
    ['RBQM', 'Risk-based quality management. Focusing oversight effort on the risks that matter most to patient safety and reliable results.'],
    ['KRI (key risk indicator)', 'A measure that shows how a site or country is performing on one risk, such as late data entry or missed visits.'],
    ['QTL (quality tolerance limit)', 'A study-level limit for a critical parameter. Going beyond it may signal a systemic problem and needs documented review.'],
    ['Early-warning level', 'A level below the limit (for example 75% of it) that warns you before a limit is reached.'],
    ['CtQ (critical to quality) factor', 'Something that must go right for patients to be protected and results to be trustworthy.'],
    ['Signal', 'An alert created when a KRI crosses a threshold or a forecast predicts a breach. It stays open until reviewed.'],
    ['Snapshot', 'A saved analysis of the data on a given date. Finalized snapshots cannot change, which makes them reliable evidence.'],
    ['CAPA', 'Corrective and preventive action. A documented plan to fix a problem and stop it coming back.'],
    ['Effectiveness check', 'Checking after a CAPA whether the problem actually improved in the following snapshots.'],
    ['Funnel plot', 'A chart that compares each site to the study average. The funnel shows the range expected from normal variation, so sites outside it are unusual.'],
    ['Moderate and high limit', 'Outer lines of the funnel at 95% and 99.8%. Outside moderate means worth a look. Outside high means act.'],
    ['Standardized ratio', 'A site’s observed events divided by the events expected from the study rate. 1.0 means as expected.'],
    ['Confidence interval', 'The range in which a site’s true rate likely lies. A wide range means little data.'],
    ['Subject-week', 'One subject on study for one week. Used to compare rates fairly between sites.'],
    ['Risk score', 'A 0 to 100 score combining a site’s indicators. Higher means higher risk. Weights are shown on the site page.'],
    ['Relative score', 'How a site compares with other sites.'],
    ['Absolute score', 'How a site compares with a fixed threshold.'],
    ['SDV (source data verification)', 'Checking entered data against original records.'],
    ['Targeted visit', 'An on-site visit triggered by a specific risk rather than a fixed schedule.'],
    ['Centralized monitoring', 'Reviewing data remotely, from one place, to find problems early.'],
    ['Protocol deviation', 'A departure from the study plan. Major ones can affect safety or data reliability.'],
    ['SAE (serious adverse event)', 'A serious unwanted medical event in a participant. Must be reported within strict timelines.'],
    ['Query', 'A question raised on entered data that the site must answer or correct.'],
    ['Overdispersion', 'More variation between sites than pure chance would give. The funnel limits allow for it.'],
    ['Illustrative default', 'A starting value for a threshold. Each study should set its own.'],
    ['AI-assisted', 'Produced by simulated AI on synthetic data. A person confirms any action.']
  ];

  function render(contentEl, data) {
    draw('');
    function draw(query) {
      var focus = global.RBQM_A11Y.captureFocus('glossarySearch');
      var filtered = GLOSSARY.filter(function (g) { return !query || g[0].toLowerCase().indexOf(query) !== -1 || g[1].toLowerCase().indexOf(query) !== -1; });
      contentEl.innerHTML =
        '<div class="card"><input class="search-input" id="glossarySearch" placeholder="Search the glossary" style="width:100%;max-width:400px" value="' + query + '"></div>' +
        '<div style="height:10px"></div><div class="card">' +
        (filtered.length ? filtered.map(function (g) {
          return '<div style="padding:8px 0;border-bottom:1px solid var(--c-border)"><b>' + g[0] + '</b><p class="muted" style="font-size:12px;margin-top:2px">' + g[1] + '</p></div>';
        }).join('') : '<div class="empty-state"><h3>Nothing matches these filters</h3><p>Try a different term.</p></div>') +
        '</div>';
      document.getElementById('glossarySearch').addEventListener('input', function (e) { draw(e.target.value.toLowerCase()); });
      global.RBQM_A11Y.restoreFocus(focus);
    }
  }

  global.RBQM_PAGE_GLOSSARY_HELP = { render: render };
})(window);
