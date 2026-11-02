/* Inspection readiness: one-click assembled package, checklist of real gaps, print preview. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var CAPA_ENGINE = global.RBQM_CAPA;
  var CFG = global.RBQM_CONFIG;

  function buildChecklist(data) {
    var items = [];
    data.studies.forEach(function (s) {
      var hasApprovedRiskAssessment = data.risks.some(function (r) { return r.studyId === s.id; });
      if (!hasApprovedRiskAssessment) items.push({ text: 'Risk assessment sign-off for ' + s.id, href: 'risk-register.html' });
    });
    data.capas.filter(function (c) { return c.state === 'Submitted' || c.state === 'Draft'; }).slice(0, 3).forEach(function (c) {
      items.push({ text: 'Unsigned CAPA: ' + c.id, href: 'issues-capa.html' });
    });
    data.qtlDefs.filter(function (d) { return d.outcome !== 'Within limit'; }).forEach(function (d) {
      if (!STORE.get('notes', 'qtl-' + d.id)) items.push({ text: 'QTL excursion impact assessment: ' + d.parameter + ' (' + d.studyId + ')', href: 'quality-limits.html' });
    });
    data.capas.filter(function (c) { return CAPA_ENGINE.isOverdue(c, CFG.asOfDate); }).forEach(function (c) {
      items.push({ text: 'Overdue CAPA: ' + c.id, href: 'issues-capa.html' });
    });
    return items;
  }

  function render(contentEl, data) {
    var items = buildChecklist(data);
    contentEl.innerHTML =
      '<div class="banner ' + (items.length ? 'banner-watch' : 'banner-ok') + '"><span aria-hidden="true">' + (items.length ? '&#9888;' : '&#10003;') + '</span>' +
      '<div><b>' + (items.length ? items.length + ' items missing.' : 'No gaps found.') + '</b></div></div>' +
      '<div style="height:10px"></div><div class="grid grid-main-side">' +
      '<div class="card"><div class="card-title">Checklist</div>' +
      (items.length ? items.map(function (it) { return '<div class="card-head" style="padding:7px 0;border-bottom:1px solid var(--c-border)"><span>' + it.text + '</span><a class="btn btn-sm" href="' + it.href + '">Fix now</a></div>'; }).join('')
        : '<p class="muted">Everything needed for an inspection is in place.</p>') + '</div>' +
      '<div class="card"><div class="card-title">Package contents</div>' +
      ['Risk assessment', 'CtQ map', 'KRI and QTL configuration', 'Signals', 'Actions', 'Snapshots', 'Audit trail'].map(function (c) { return '<div style="padding:5px 0;border-bottom:1px solid var(--c-border);font-size:11.5px">' + c + '</div>'; }).join('') +
      '<button class="btn btn-primary" id="generatePackBtn" style="margin-top:10px">Generate inspection pack</button>' +
      '<button class="btn" id="fileEtmfBtn" style="margin-top:6px">File to eTMF</button></div>' +
      '</div>';

    document.getElementById('generatePackBtn').addEventListener('click', function () {
      STORE.logAudit('InspectionPack', 'pack-' + Date.now(), null, 'Inspection pack generated');
      global.print();
    });
    document.getElementById('fileEtmfBtn').addEventListener('click', function () {
      STORE.logAudit('InspectionPack', 'etmf-' + Date.now(), null, 'Filed to eTMF (simulated)');
      global.RBQM_TOAST.show('Filed to eTMF (simulated)');
    });
  }

  global.RBQM_PAGE_INSPECTION_READINESS = { render: render };
})(window);
