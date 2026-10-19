/* Sites page: world map (approved look, components/map.js) + ranked site table. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;
  var KRI = global.RBQM_KRI_CATALOG;

  function latestSnapshotMap(data) {
    var map = {};
    data.studies.forEach(function (s) { map[s.id] = global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(data.snapshots, s.id); });
    return map;
  }

  function siteRows(data) {
    var snapMap = latestSnapshotMap(data);
    return data.sites.map(function (site) {
      var snap = snapMap[site.studyId];
      var risk = data.siteRisk.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; })[0];
      var kriRows = data.kriResults.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; });
      var worst = kriRows.filter(function (r) { return r.status === 'action'; })[0] || kriRows.filter(function (r) { return r.status === 'watch'; })[0];
      var topIssue = worst ? KRI.byCode(worst.kriCode).name : (site.status === 'closed' ? 'Site closed' : 'None');
      var status = global.RBQM_GENERATOR.overallStatusForSite(site, kriRows);
      var openSignals = data.signals.filter(function (s) { return s.siteId === site.id && global.RBQM_SIGNALS.isOpen(s.status); }).length;
      var lastVisitDate = global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.addDays(global.RBQM_GENERATOR.ASOF, -(10 + (site.code.charCodeAt(0) % 40))));
      return {
        site: site, risk: risk, status: status, topIssue: topIssue, openSignals: openSignals,
        enrollment: site.plannedEnrollment, lastVisitDate: lastVisitDate
      };
    });
  }

  function countryAggregation(data, rows) {
    var agg = {};
    rows.forEach(function (row) {
      if (row.site.status === 'closed') return;
      var iso = row.site.country;
      if (!agg[iso]) agg[iso] = { count: 0, action: 0, watch: 0, name: global.RBQM_REFERENCE.countryByIso(iso).name };
      agg[iso].count++;
      if (row.status === 'action') agg[iso].action++;
      else if (row.status === 'watch') agg[iso].watch++;
    });
    return agg;
  }

  function topCountriesHtml(data, rows, filters) {
    var agg = countryAggregation(data, rows);
    var ranked = Object.keys(agg).map(function (iso) { return Object.assign({ iso: iso }, agg[iso]); })
      .sort(function (a, b) { return (b.action - a.action) || (b.watch - a.watch) || (b.count - a.count); })
      .slice(0, 15);
    var rowsHtml = ranked.map(function (c) {
      var selected = filters.country === c.iso;
      return '<div class="card-head country-rank-row' + (selected ? ' selected' : '') + '" data-iso="' + c.iso + '" style="padding:6px 0;border-bottom:1px solid var(--c-border);cursor:pointer">' +
        '<div><b>' + c.name + '</b><div class="muted" style="font-size:10.5px">' + c.count + ' sites</div></div>' +
        '<div style="display:flex;gap:5px">' +
        (c.action ? '<span class="status-pill status-action">' + c.action + '</span>' : '') +
        (c.watch ? '<span class="status-pill status-watch">' + c.watch + '</span>' : '') +
        (!c.action && !c.watch ? '<span class="status-pill status-ok">' + c.count + '</span>' : '') +
        '</div></div>';
    }).join('');
    return '<div class="card"><div class="card-title">Countries</div><div class="card-subtitle">Ranked by sites needing attention. Click to filter.</div>' +
      '<div class="country-list-scroll">' + rowsHtml + '</div></div>';
  }

  var columns = [
    { key: 'code', label: 'Site', sortable: true, sortValue: function (r) { return r.site.code; }, render: function (r) { return '<a href="site-profile.html?site=' + r.site.id + '">Site ' + r.site.code + '</a>, ' + r.site.country; } },
    { key: 'status', label: 'Status', sortValue: function (r) { return r.status; }, render: function (r) { return '<span class="status-pill status-' + r.status + '"><span class="status-dot status-' + r.status + '"></span>' + FMT.statusLabel(r.status) + '</span>'; } },
    { key: 'risk', label: 'Risk score', sortValue: function (r) { return r.risk ? r.risk.score : -1; }, render: function (r) { return r.risk && r.risk.score != null ? '<span class="risk-badge band-' + r.risk.band + '">' + r.risk.score + '</span>' : '–'; } },
    { key: 'topIssue', label: 'Top KRI issue', sortValue: function (r) { return r.topIssue; } },
    { key: 'enrollment', label: 'Enrollment', sortValue: function (r) { return r.enrollment; } },
    { key: 'lastVisitDate', label: 'Last visit', sortValue: function (r) { return r.lastVisitDate; }, render: function (r) { return FMT.dateShort(r.lastVisitDate); } },
    { key: 'openSignals', label: 'Open signals', sortValue: function (r) { return r.openSignals; } },
    { key: 'cro', label: 'CRO', sortValue: function (r) { return r.site.croId; }, render: function (r) { return r.site.croId; } }
  ];

  function applyFilters(rows, filters) {
    return rows.filter(function (r) {
      if (filters.study && filters.study !== 'all' && r.site.studyId !== filters.study) return false;
      if (filters.country && r.site.country !== filters.country) return false;
      if (filters.band && filters.band !== 'all' && (!r.risk || r.risk.band !== filters.band)) return false;
      if (filters.search) {
        var q = filters.search.toLowerCase();
        if (('site ' + r.site.code + ' ' + r.site.country + ' ' + r.topIssue).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function render(contentEl, data) {
    var rows = siteRows(data);
    var filters = { study: ROUTER.get('study', 'all'), country: ROUTER.get('country', null), band: 'all', search: '' };
    var countryParam = ROUTER.get('country', null);
    if (countryParam && countryParam !== 'all') filters.country = countryParam;
    else filters.country = null;

    function draw() {
      var focus = global.RBQM_A11Y.captureFocus('siteSearch');
      var filtered = applyFilters(rows, filters);
      var highRiskCount = filtered.filter(function (r) { return r.risk && r.risk.band === 'high'; }).length;
      var topCountry = Object.entries(countryAggregation(data, rows)).sort(function (a, b) { return b[1].action - a[1].action; })[0];

      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div>' +
        '<b>' + highRiskCount + ' sites are high risk.</b> ' + (topCountry ? topCountry[1].name + ' has the most.' : '') + '</div></div>' +
        '<div style="height:10px"></div>' +
        '<div class="grid grid-map-side">' +
        '<div class="card"><div id="sitesMap"></div></div>' +
        topCountriesHtml(data, rows, filters) +
        '</div>' +
        '<div style="height:10px"></div>' +
        '<div class="card">' +
        '<div class="table-toolbar">' +
        '<input class="search-input" id="siteSearch" placeholder="Search sites" value="' + filters.search + '">' +
        '<select class="select-input" id="bandFilter"><option value="all">All risk bands</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>' +
        '<select class="select-input" id="studyFilterLocal"><option value="all">All studies</option>' + data.studies.map(function (s) { return '<option value="' + s.id + '"' + (filters.study === s.id ? ' selected' : '') + '>' + s.id + '</option>'; }).join('') + '</select>' +
        '<div class="spacer"></div>' +
        '<button class="btn" id="exportCsvBtn">Export CSV</button>' +
        '</div>' +
        '<div id="sitesTableWrap" class="table-scroll">' + global.RBQM_TABLE.render(columns, filtered, { onRowClick: true }) + '</div>' +
        '</div>';

      global.RBQM_MAP.render({
        containerId: 'sitesMap', countryData: countryAggregation(data, rows),
        onSelect: function (iso) { filters.country = iso; ROUTER.set({ country: iso || null }); draw(); }
      });

      document.querySelectorAll('.country-rank-row').forEach(function (row) {
        row.addEventListener('click', function () {
          var iso = row.dataset.iso;
          filters.country = filters.country === iso ? null : iso;
          ROUTER.set({ country: filters.country });
          draw();
        });
      });

      var tableWrap = document.getElementById('sitesTableWrap');
      global.RBQM_TABLE.bindSort(tableWrap, filtered, columns, function (sorted) {
        tableWrap.innerHTML = global.RBQM_TABLE.render(columns, sorted, { onRowClick: true });
        bindRows(sorted);
      });
      bindRows(filtered);

      document.getElementById('siteSearch').addEventListener('input', function (e) { filters.search = e.target.value; draw(); });
      document.getElementById('bandFilter').value = filters.band;
      document.getElementById('bandFilter').addEventListener('change', function (e) { filters.band = e.target.value; draw(); });
      document.getElementById('studyFilterLocal').addEventListener('change', function (e) { filters.study = e.target.value; ROUTER.set({ study: e.target.value === 'all' ? null : e.target.value }); draw(); });
      document.getElementById('exportCsvBtn').addEventListener('click', function () {
        global.RBQM_TABLE.downloadCsv('sites.csv', columns, filtered);
        global.RBQM_TOAST.show('Export ready: sites.csv');
      });
      global.RBQM_A11Y.restoreFocus(focus);
    }

    function bindRows(rowsNow) {
      global.RBQM_TABLE.bindRowClick(document.getElementById('sitesTableWrap'), rowsNow, function (row) {
        global.RBQM_ROUTER.navigate('site-profile.html', { site: row.site.id });
      });
    }

    draw();
  }

  global.RBQM_PAGE_SITES = { render: render };
})(window);
