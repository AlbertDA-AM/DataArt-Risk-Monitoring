/* Protocol deviations: Overview (trend, category heatmap) and Listing tabs. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;

  function render(contentEl, data) {
    var filters = { category: 'all', importance: 'all', study: 'all' };
    var tab = 'overview';
    var LATE_DAYS = 14;

    function draw() {
      var rows = data.deviations.filter(function (d) {
        if (filters.category !== 'all' && d.category !== filters.category) return false;
        if (filters.importance !== 'all' && d.importance !== filters.importance) return false;
        if (filters.study !== 'all' && d.studyId !== filters.study) return false;
        return true;
      });
      var critical = data.deviations.filter(function (d) { return d.importance === 'Critical'; }).length;
      var major = data.deviations.filter(function (d) { return d.importance === 'Major'; }).length;

      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div>' +
        '<b>' + data.deviations.length + ' protocol deviations.</b> ' + critical + ' critical, ' + major + ' major.</div></div>' +
        '<div style="height:10px"></div>' +
        '<div class="tabs" id="pdTabs">' + [['overview', 'Overview'], ['causes', 'Root cause groups'], ['listing', 'Listing']].map(function (t) {
          return '<button class="tab' + (tab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
        '<div data-tab-panel="overview">' + overviewHtml(data) + latencyHtml() + '</div>' +
        '<div data-tab-panel="causes" hidden>' + causesHtml() + '</div>' +
        '<div data-tab-panel="listing" hidden>' + listingHtml(rows) + '</div>';

      global.RBQM_TABS.init(document.getElementById('pdTabs'), function (name) { tab = name; });

      var catSel = document.getElementById('categoryFilter'), impSel = document.getElementById('importanceFilter'), studySel = document.getElementById('studyFilterLocal');
      if (catSel) catSel.addEventListener('change', function (e) { filters.category = e.target.value; draw(); });
      if (impSel) impSel.addEventListener('change', function (e) { filters.importance = e.target.value; draw(); });
      if (studySel) studySel.addEventListener('change', function (e) { filters.study = e.target.value; draw(); });
      var exportBtn = document.getElementById('pdExportBtn');
      if (exportBtn) exportBtn.addEventListener('click', function () {
        global.RBQM_TABLE.downloadCsv('protocol-deviations.csv', listingColumns, rows);
        global.RBQM_TOAST.show('Export ready: protocol-deviations.csv');
      });
      document.querySelectorAll('.pd-classify-btn').forEach(function (b) {
        b.addEventListener('click', function () { classify(data.deviations.filter(function (d) { return d.id === b.dataset.id; })[0]); });
      });
    }

    function classify(dev) {
      global.RBQM_MODAL.open({
        title: 'Classify deviation ' + dev.id, confirmLabel: 'Save',
        bodyHtml: '<div class="field"><label>Link to</label><select class="select-input" id="pdLink"><option value="signal">Signal</option><option value="capa">CAPA</option><option value="none">No link</option></select></div>',
        onConfirm: function (modalEl) {
          STORE.logAudit('ProtocolDeviation', dev.id, null, 'Linked to ' + modalEl.querySelector('#pdLink').value);
          global.RBQM_TOAST.show('Deviation ' + dev.id + ' classified');
          return true;
        }
      });
    }

    var listingColumns = [
      { key: 'id', label: 'ID' },
      { key: 'site', label: 'Site', render: function (r) { var s = data.sites.filter(function (x) { return x.id === r.siteId; })[0]; return s ? 'Site ' + s.code + ', ' + s.country : r.siteId; } },
      { key: 'category', label: 'Category' },
      { key: 'importance', label: 'Importance', render: function (r) { return '<span class="status-pill status-' + (r.importance === 'Critical' ? 'action' : r.importance === 'Major' ? 'watch' : 'ok') + '">' + r.importance + '</span>'; } },
      { key: 'date', label: 'Detected', render: function (r) { return FMT.dateShort(r.detectedDate); } },
      { key: 'latency', label: 'Latency (days)', sortValue: function (r) { return latency(r); }, render: function (r) { return latency(r) > LATE_DAYS ? '<span class="status-pill status-watch">' + latency(r) + '</span>' : String(latency(r)); } },
      { key: 'rootCause', label: 'Root cause', render: function (r) { return groupName(r.rootCause); } },
      { key: 'status', label: 'Status' },
      { key: 'actions', label: '', sortable: false, render: function (r) { return '<button class="btn btn-sm pd-classify-btn" data-id="' + r.id + '">Classify</button>'; } }
    ];

    function listingHtml(rows) {
      return '<div class="card">' +
        '<div class="table-toolbar">' +
        '<select class="select-input" id="categoryFilter"><option value="all">All categories</option>' + global.RBQM_GENERATOR.PD_CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') + '</select>' +
        '<select class="select-input" id="importanceFilter"><option value="all">All importance</option><option value="Minor">Minor</option><option value="Major">Major</option><option value="Critical">Critical</option></select>' +
        '<select class="select-input" id="studyFilterLocal"><option value="all">All studies</option>' + data.studies.map(function (s) { return '<option value="' + s.id + '">' + s.id + '</option>'; }).join('') + '</select>' +
        '<div class="spacer"></div><button class="btn" id="pdExportBtn">Export CSV</button></div>' +
        global.RBQM_TABLE.render(listingColumns, rows) + '</div>';
    }

    function latency(d) { return Math.round((new Date(d.detectedDate) - new Date(d.occurredDate)) / 86400000); }
    function groupName(id) { var g = data.rootCauseGroups.filter(function (x) { return x.id === id; })[0]; return g ? g.name : id; }
    function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }), m = Math.floor(b.length / 2); return b.length ? (b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2) : 0; }
    function siteLabel(id) { var s = data.sites.filter(function (x) { return x.id === id; })[0]; return s ? 'Site ' + s.code : id; }

    function causesHtml() {
      var total = data.deviations.length || 1;
      return '<div class="grid grid-2">' + data.rootCauseGroups.map(function (g) {
        var rows = data.deviations.filter(function (d) { return d.rootCause === g.id; });
        var bySite = {}, byCat = {};
        rows.forEach(function (d) { bySite[d.siteId] = (bySite[d.siteId] || 0) + 1; byCat[d.category] = (byCat[d.category] || 0) + 1; });
        var top = Object.keys(bySite).sort(function (a, b) { return bySite[b] - bySite[a] || (a < b ? -1 : 1); }).slice(0, 5);
        return '<div class="card"><div class="card-head"><div><div class="card-title">' + g.name + '</div><div class="card-subtitle">' + g.hint + '</div></div>' +
          '<div style="text-align:right"><div style="font-size:19px;font-weight:700">' + rows.length + '</div><div class="muted" style="font-size:10.5px">' + Math.round(rows.length / total * 100) + '% of deviations</div></div></div>' +
          '<div style="font-size:11.5px"><b>Sites with most:</b> ' + (top.map(function (id) { return siteLabel(id) + ' (' + bySite[id] + ')'; }).join(', ') || 'none') + '</div>' +
          '<div class="muted" style="font-size:11px;margin-top:4px">Categories: ' + Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (c) { return c + ' ' + byCat[c]; }).join(', ') + '</div></div>';
      }).join('') + '</div>';
    }

    function latencyHtml() {
      var cats = global.RBQM_GENERATOR.PD_CATEGORIES.map(function (c) {
        var l = data.deviations.filter(function (d) { return d.category === c; }).map(latency);
        return { name: c, n: l.length, med: median(l), late: l.filter(function (x) { return x > LATE_DAYS; }).length };
      });
      var bySite = {};
      data.deviations.forEach(function (d) { (bySite[d.siteId] = bySite[d.siteId] || []).push(latency(d)); });
      var sites = Object.keys(bySite).filter(function (id) { return bySite[id].length >= 3; }).map(function (id) { return { id: id, n: bySite[id].length, med: median(bySite[id]), late: bySite[id].filter(function (x) { return x > LATE_DAYS; }).length }; })
        .sort(function (a, b) { return b.med - a.med || (a.id < b.id ? -1 : 1); }).slice(0, 8);
      var overall = median(data.deviations.map(latency));
      function row(name, n, med, late) { return '<tr><td>' + name + '</td><td>' + n + '</td><td>' + (late ? '<span class="status-pill status-watch">' + late + '</span>' : '0') + '</td><td>' + (med > LATE_DAYS ? '<span class="status-pill status-watch">' + med + ' days, late</span>' : med + ' days') + '</td></tr>'; }
      return '<div style="height:10px"></div><div class="card"><div class="card-title" data-term="Detection latency">Detection latency</div>' +
        '<div class="card-subtitle">Median days from occurrence to detection. Overall median ' + overall + ' days; detections over ' + LATE_DAYS + ' days are counted as late.</div>' +
        '<div class="grid grid-2"><table class="table"><thead><tr><th class="no-sort">Category</th><th class="no-sort">Deviations</th><th class="no-sort">Late</th><th class="no-sort">Median</th></tr></thead><tbody>' +
        cats.map(function (c) { return row(c.name, c.n, c.med, c.late); }).join('') + '</tbody></table>' +
        '<table class="table"><thead><tr><th class="no-sort">Slowest sites</th><th class="no-sort">Deviations</th><th class="no-sort">Late</th><th class="no-sort">Median</th></tr></thead><tbody>' +
        sites.map(function (x) { return row(siteLabel(x.id), x.n, x.med, x.late); }).join('') + '</tbody></table></div></div>';
    }

    function overviewHtml(data) {
      var byCat = {};
      global.RBQM_GENERATOR.PD_CATEGORIES.forEach(function (c) { byCat[c] = { total: 0 }; });
      data.studies.forEach(function (s) { global.RBQM_GENERATOR.PD_CATEGORIES.forEach(function (c) { byCat[c][s.id] = 0; }); });
      data.deviations.forEach(function (d) { byCat[d.category].total++; byCat[d.category][d.studyId] = (byCat[d.category][d.studyId] || 0) + 1; });
      var rows = Object.keys(byCat).map(function (cat) {
        var cells = data.studies.map(function (s) {
          var v = byCat[cat][s.id] || 0;
          var tone = v > 15 ? 'action' : v > 5 ? 'watch' : 'ok';
          return '<td><span class="table-cell-metric status-' + tone + '">' + v + '</span></td>';
        }).join('');
        return '<tr><td>' + cat + '</td>' + cells + '<td><b>' + byCat[cat].total + '</b></td></tr>';
      }).join('');
      return '<div class="card"><div class="card-title">Category by study</div><div class="card-subtitle">Count of deviations in the latest snapshot window.</div>' +
        '<table class="table heatmap-table"><thead><tr><th class="no-sort">Category</th>' + data.studies.map(function (s) { return '<th class="no-sort">' + s.id + '</th>'; }).join('') + '<th class="no-sort">Total</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    draw();
  }

  global.RBQM_PAGE_PROTOCOL_DEVIATIONS = { render: render };
})(window);
