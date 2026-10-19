/* Protocol deviations: Overview (trend, category heatmap) and Listing tabs. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;

  function render(contentEl, data) {
    var filters = { category: 'all', importance: 'all', study: 'all' };

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
        '<div class="tabs" id="pdTabs"><button class="tab active" data-tab="overview">Overview</button><button class="tab" data-tab="listing">Listing</button></div>' +
        '<div data-tab-panel="overview">' + overviewHtml(data) + '</div>' +
        '<div data-tab-panel="listing" hidden>' + listingHtml(rows) + '</div>';

      global.RBQM_TABS.init(document.getElementById('pdTabs'));

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
      { key: 'date', label: 'Date', render: function (r) { return FMT.dateShort(r.date); } },
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
