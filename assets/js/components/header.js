/* Header: title/breadcrumb, Sponsor chip, global filters (study, country, snapshot, date range),
   data freshness, notifications, Ask AI. Filters read/write URL params (core/router.js) and
   persist across navigation; pages read window.RBQM_FILTERS to apply them. */
(function (global) {
  'use strict';
  var CFG = global.RBQM_CONFIG;
  var ROUTER = global.RBQM_ROUTER;

  function currentFilters(data) {
    var defaultSnapshot = data.snapshots.filter(function (s) { return s.status === 'Finalized'; })
      .sort(function (a, b) { return b.date < a.date ? -1 : 1; })[0];
    return {
      study: ROUTER.get('study', 'all'),
      country: ROUTER.get('country', 'all'),
      snapshot: ROUTER.get('snapshot', defaultSnapshot ? defaultSnapshot.date : ''),
      range: ROUTER.get('range', '90')
    };
  }

  function render(opts, data) {
    opts = opts || {};
    var f = currentFilters(data);
    var countries = data.countries.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    var studyOptions = '<option value="all"' + (f.study === 'all' ? ' selected' : '') + '>All studies</option>' +
      data.studies.map(function (s) { return '<option value="' + s.id + '"' + (f.study === s.id ? ' selected' : '') + '>' + s.id + '</option>'; }).join('');
    var countryOptions = '<option value="all"' + (f.country === 'all' ? ' selected' : '') + '>All countries</option>' +
      countries.map(function (c) { return '<option value="' + c.iso + '"' + (f.country === c.iso ? ' selected' : '') + '>' + c.name + '</option>'; }).join('');
    var snapshotDates = Array.from(new Set(data.snapshots.filter(function (s) { return s.status === 'Finalized'; }).map(function (s) { return s.date; })))
      .sort(function (a, b) { return b < a ? -1 : 1; });
    var snapshotOptions = snapshotDates.map(function (d) {
      return '<option value="' + d + '"' + (f.snapshot === d ? ' selected' : '') + '>Snapshot: ' + global.RBQM_FORMAT.dateShort(d) + '</option>';
    }).join('');
    var rangeOptions = ['30', '90', '180', '365'].map(function (r) {
      return '<option value="' + r + '"' + (f.range === r ? ' selected' : '') + '>Last ' + r + ' days</option>';
    }).join('');

    var crumbParts = [];
    if (opts.crumb) crumbParts.push(opts.crumb);
    if (opts.subtitle) crumbParts.push(opts.subtitle);
    var crumbHtml = crumbParts.length ? '<div class="crumb">' + crumbParts.join(' / ') + '</div>' : '';

    var html = '';
    html += '<div class="app-header-titles"><h1>' + (opts.title || '') + '</h1>' + crumbHtml + '</div>';
    html += '<button class="sponsor-chip" id="sponsorChip" type="button">' + CFG.sponsorLabel + '</button>';
    html += '<select class="filter-select" id="filterStudy" aria-label="Study filter">' + studyOptions + '</select>';
    html += '<select class="filter-select" id="filterCountry" aria-label="Country filter">' + countryOptions + '</select>';
    html += '<select class="filter-select" id="filterSnapshot" aria-label="Snapshot filter">' + snapshotOptions + '</select>';
    html += '<select class="filter-select" id="filterRange" aria-label="Date range filter">' + rangeOptions + '</select>';
    html += '<div class="header-spacer"></div>';
    html += '<div class="header-meta">Data as of ' + CFG.asOfDateDisplay + '</div>';
    html += '<button class="icon-btn" id="resetDemoBtn" aria-label="Reset demo data" type="button" title="Reset demo data">&#8635;</button>';
    html += '<button class="icon-btn" id="notifBtn" aria-label="Notifications" type="button">&#128276;<span class="dot-badge" id="notifDot" hidden></span></button>';
    html += '<button class="btn-ask-ai" id="askAiBtn" type="button"><span aria-hidden="true">&#10022;</span> Ask AI</button>';
    return html;
  }

  function bind() {
    ['filterStudy', 'filterCountry', 'filterSnapshot', 'filterRange'].forEach(function (id) {
      var paramKey = { filterStudy: 'study', filterCountry: 'country', filterSnapshot: 'snapshot', filterRange: 'range' }[id];
      var el = global.document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', function () {
        ROUTER.set({ study: paramKey === 'study' ? el.value : undefined });
        var patch = {}; patch[paramKey] = el.value;
        ROUTER.set(patch);
        global.location.reload();
      });
    });
    var resetBtn = global.document.getElementById('resetDemoBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      global.RBQM_MODAL.open({
        title: 'Reset demo data', confirmLabel: 'Reset', subtitle: 'This clears every change you made (signals, CAPAs, thresholds, chat) and returns to the seed data.',
        onConfirm: function () {
          global.RBQM_STORE.reset();
          global.RBQM_TOAST.show('Demo data reset');
          setTimeout(function () { global.location.href = 'dashboard.html'; }, 300);
          return true;
        }
      });
    });
    var notifBtn = global.document.getElementById('notifBtn');
    if (notifBtn) notifBtn.addEventListener('click', function () {
      global.RBQM_TOAST && global.RBQM_TOAST.show('Notifications: no new notifications since you last checked.');
    });
    var askAiBtn = global.document.getElementById('askAiBtn');
    if (askAiBtn && global.RBQM_AI_PANEL) askAiBtn.addEventListener('click', function () { global.RBQM_AI_PANEL.open(); });
    var sponsorChip = global.document.getElementById('sponsorChip');
    if (sponsorChip) sponsorChip.addEventListener('click', function () {
      global.RBQM_TOAST && global.RBQM_TOAST.show('Single-sponsor prototype: Sponsor-0430 has access to everything.');
    });
  }

  global.RBQM_HEADER = { render: render, bind: bind, currentFilters: currentFilters };
})(window);
