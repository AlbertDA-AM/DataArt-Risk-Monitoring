/* Studies: profile cards for the 3 studies, each linking to its Study detail sub-page. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;

  function studyStats(data, study) {
    var snap = global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(data.snapshots, study.id);
    var sites = data.sites.filter(function (s) { return s.studyId === study.id; });
    var highRisk = sites.filter(function (s) {
      var r = data.siteRisk.filter(function (x) { return x.siteId === s.id && x.snapshotId === snap.id; })[0];
      return r && r.band === 'high';
    }).length;
    var openSignals = data.signals.filter(function (s) { return s.studyId === study.id && global.RBQM_SIGNALS.isOpen(s.status); }).length;
    return { sites: sites.length, highRisk: highRisk, openSignals: openSignals, latestSnapshot: snap };
  }

  function render(contentEl, data) {
    var cards = data.studies.map(function (study) {
      var stats = studyStats(data, study);
      var cro = data.cros.filter(function (c) { return c.id === study.cro; })[0];
      return '<a href="study-detail.html?study=' + study.id + '" style="color:inherit;text-decoration:none">' +
        '<div class="card" style="margin-bottom:10px">' +
        '<div class="card-head"><div><div class="card-title">' + study.id + ' - ' + study.title + '</div>' +
        '<div class="card-subtitle">' + study.indication + ', Phase ' + study.phase + '</div></div>' +
        '<span class="muted" style="font-size:11px">Data as of ' + FMT.dateShort(stats.latestSnapshot.date) + '</span></div>' +
        '<div class="grid grid-6">' +
        statTile(study.sites, 'Sites') + statTile(study.countries, 'Countries') + statTile(FMT.int(study.subjects), 'Subjects') +
        statTile(stats.highRisk, 'High risk') + statTile(stats.openSignals, 'Open signals') + statTile(cro ? cro.name : study.cro, 'CRO') +
        '</div></div></a>';
    }).join('');
    contentEl.innerHTML = '<div class="card-subtitle" style="margin-bottom:8px">3 studies in the portfolio. Click a study for its detail.</div>' + cards;
  }

  function statTile(value, label) {
    return '<div><div style="font-size:17px;font-weight:700">' + value + '</div><div class="muted" style="font-size:10.5px">' + label + '</div></div>';
  }

  global.RBQM_PAGE_STUDIES = { render: render };
})(window);
