/* KRI detail: Overview (4 linked charts + signal panel), Details (raw records), Thresholds
   (edit + what-if). Same template for all 10 active KRIs. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;
  var KRI = global.RBQM_KRI_CATALOG;
  var STATS = global.RBQM_STATS;
  var STORE = global.RBQM_STORE;
  var charts = {};

  function studySnapshots(data, studyId) {
    return data.snapshots.filter(function (s) { return s.studyId === studyId && s.status === 'Finalized'; }).sort(function (a, b) { return a.index - b.index; });
  }

  function resultsFor(data, siteId, kriCode) { return data.kriResults.filter(function (r) { return r.siteId === siteId && r.kriCode === kriCode; }); }
  function resultsForSnapshot(data, studyId, kriCode, snapshotId) {
    var siteIds = data.sites.filter(function (s) { return s.studyId === studyId; }).map(function (s) { return s.id; });
    return data.kriResults.filter(function (r) { return r.kriCode === kriCode && r.snapshotId === snapshotId && siteIds.indexOf(r.siteId) !== -1 && r.status !== 'insufficient'; });
  }

  function studyAverage(data, studyId, kriCode, snapshotId) {
    var rows = resultsForSnapshot(data, studyId, kriCode, snapshotId);
    if (!rows.length) return 0;
    return rows.reduce(function (s, r) { return s + r.value; }, 0) / rows.length;
  }

  function state(data) {
    var site = data.sites.filter(function (s) { return s.id === ROUTER.get('site'); })[0] ||
      data.sites.filter(function (s) { return s.code === '114'; })[0];
    var kriCode = ROUTER.get('kri', 'ae_rate');
    if (!KRI.byCode(kriCode)) kriCode = 'ae_rate';
    return { site: site, kriCode: kriCode, studyId: site.studyId };
  }

  function render(contentEl, data) {
    var s = state(data);
    draw(contentEl, data, s);
  }

  function draw(contentEl, data, s) {
    var kriDef = KRI.byCode(s.kriCode);
    var snaps = studySnapshots(data, s.studyId);
    var latest = snaps[snaps.length - 1];
    var row = data.kriResults.filter(function (r) { return r.siteId === s.site.id && r.kriCode === s.kriCode && r.snapshotId === latest.id; })[0];
    var study = data.studies.filter(function (x) { return x.id === s.studyId; })[0];

    contentEl.innerHTML =
      '<div class="tabs" id="kriTabs">' +
      '<button class="tab active" data-tab="overview">Overview</button>' +
      '<button class="tab" data-tab="details">Details</button>' +
      '<button class="tab" data-tab="thresholds">Thresholds</button>' +
      '<div style="flex:1"></div>' +
      '<select class="select-input" id="kriSwitcher">' + KRI.KRIS.filter(function (k) { return k.active; }).map(function (k) {
        return '<option value="' + k.code + '"' + (k.code === s.kriCode ? ' selected' : '') + '>' + k.name + '</option>';
      }).join('') + '</select>' +
      '<span class="status-pill status-' + row.status + '" style="margin-left:8px">Status: ' + FMT.statusLabel(row.status) + '</span>' +
      '</div>' +
      '<div data-tab-panel="overview">' + overviewHtml(data, s, kriDef, row, latest) + '</div>' +
      '<div data-tab-panel="details" hidden>' + detailsHtml(data, s, kriDef, latest) + '</div>' +
      '<div data-tab-panel="thresholds" hidden>' + thresholdsHtml(data, s, kriDef, latest) + '</div>';

    global.RBQM_TABS.init(document.getElementById('kriTabs'), function (name) {
      if (name === 'overview') setTimeout(function () { mountCharts(data, s, kriDef, latest); }, 0);
    });
    document.getElementById('kriSwitcher').addEventListener('change', function (e) {
      ROUTER.set({ kri: e.target.value });
      s.kriCode = e.target.value;
      draw(contentEl, data, s);
    });
    mountCharts(data, s, kriDef, latest);
    bindOverviewActions(data, s, row, latest, contentEl);
    bindThresholds(data, s, kriDef, latest, contentEl);
    bindDetails(data, s, kriDef, latest);
  }

  function overviewHtml(data, s, kriDef, row, latest) {
    var avg = studyAverage(data, s.studyId, s.kriCode, latest.id);
    var ratio = avg > 0 ? (row.value / avg) : 1;
    var bannerTone = row.status === 'action' ? 'banner-action' : (row.status === 'watch' ? 'banner-watch' : 'banner-ok');
    var whatThisMeans = 'Site ' + s.site.code + ' reports ' + kriDef.name.toLowerCase() + ' at ' + (ratio >= 1 ? (Math.round(ratio * 10) / 10) + 'x' : Math.round(ratio * 100) + '%') +
      ' the study average (' + FMT.num(row.value, 2) + ' vs ' + FMT.num(avg, 2) + '). ' +
      (row.status === 'action' ? 'The gap is too large to be chance. Check whether it reflects different reporting practice or a real difference.' :
        row.status === 'watch' ? 'Worth a look at the next snapshot.' : 'This is within the range normal variation would explain.');

    return '<div class="banner ' + bannerTone + '"><div><b>What this means</b><br>' + whatThisMeans + '</div></div>' +
      '<div style="height:10px"></div>' +
      '<div class="grid grid-2">' +
      chartCard('chartRate', kriDef.name + ' over time', 'Study average vs selected site') +
      chartCard('chartScatter', 'Events per site', 'Events vs time on study, all sites') +
      '</div><div style="height:10px"></div>' +
      '<div class="grid grid-2">' +
      chartCard('chartCi', 'Confidence interval of site rate', 'Sites flagged on either side of the average') +
      chartCard('chartFunnel', kriDef.name + ' outliers', 'Sites outside the funnel differ from their peers') +
      '</div><div style="height:10px"></div>' +
      signalPanelHtml(data, s, latest) +
      '<div style="height:10px"></div>' + signalHistoryHtml(data, s);
  }

  function chartCard(id, title, subtitle) {
    return '<div class="card"><div class="card-title">' + title + '</div><div class="card-subtitle">' + subtitle + '</div><div id="' + id + '" style="height:260px"></div></div>';
  }

  function mountCharts(data, s, kriDef, latest) {
    var snaps = studySnapshots(data, s.studyId);
    renderRateChart(data, s, kriDef, snaps);
    renderScatterChart(data, s, kriDef, latest);
    renderCiChart(data, s, kriDef, latest);
    renderFunnelChart(data, s, kriDef, latest);
  }

  function getChart(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    if (charts[id]) charts[id].dispose();
    charts[id] = echarts.init(el);
    return charts[id];
  }

  function renderRateChart(data, s, kriDef, snaps) {
    var chart = getChart('chartRate'); if (!chart) return;
    var studySeries = snaps.map(function (sn) { return Math.round(studyAverage(data, s.studyId, s.kriCode, sn.id) * 1000) / 1000; });
    var siteSeries = snaps.map(function (sn) {
      var r = data.kriResults.filter(function (x) { return x.siteId === s.site.id && x.kriCode === s.kriCode && x.snapshotId === sn.id; })[0];
      return r && r.value != null ? Math.round(r.value * 1000) / 1000 : null;
    });
    chart.setOption({
      grid: { left: 42, right: 16, top: 16, bottom: 28 },
      tooltip: { trigger: 'axis' },
      legend: { data: ['Study', 'Site ' + s.site.code], top: 0 },
      xAxis: { type: 'category', data: snaps.map(function (sn) { return FMT.dateMonthYear(sn.date); }) },
      yAxis: { type: 'value' },
      series: [
        { name: 'Study', type: 'line', data: studySeries, color: '#3453ad' },
        { name: 'Site ' + s.site.code, type: 'line', data: siteSeries, color: '#f0503c', lineStyle: { type: 'dashed' } }
      ]
    });
    chart.off('click'); chart.on('click', function (p) { ROUTER.set({ snapshot: snaps[p.dataIndex].date }); global.location.reload(); });
  }

  function renderScatterChart(data, s, kriDef, latest) {
    var chart = getChart('chartScatter'); if (!chart) return;
    var rows = resultsForSnapshot(data, s.studyId, s.kriCode, latest.id);
    var points = rows.map(function (r) {
      var site = data.sites.filter(function (x) { return x.id === r.siteId; })[0];
      return { value: [r.denominator, r.numerator], status: r.status, code: site.code, selected: r.siteId === s.site.id };
    });
    var colorOf = function (st) { return st === 'action' ? '#f0503c' : st === 'watch' ? '#ffb133' : '#08a8a4'; };
    chart.setOption({
      grid: { left: 42, right: 16, top: 16, bottom: 28 },
      tooltip: { formatter: function (p) { return 'Site ' + p.data.code + '<br>Count: ' + p.data.value[1] + '<br>Exposure: ' + FMT.num(p.data.value[0], 1); } },
      xAxis: { type: 'value', name: 'Exposure' }, yAxis: { type: 'value', name: 'Count' },
      series: [{
        type: 'scatter', data: points,
        symbolSize: function (v, p) { return p.data.selected ? 14 : 8; },
        itemStyle: { color: function (p) { return p.data.selected ? '#70529f' : colorOf(p.data.status); } }
      }]
    });
    chart.off('click'); chart.on('click', function (p) {
      var site = data.sites.filter(function (x) { return x.code === p.data.code && x.studyId === s.studyId; })[0];
      if (site) { ROUTER.set({ site: site.id }); s.site = site; draw(document.getElementById('appContent'), data, s); }
    });
  }

  function renderCiChart(data, s, kriDef, latest) {
    var chart = getChart('chartCi'); if (!chart) return;
    var rows = resultsForSnapshot(data, s.studyId, s.kriCode, latest.id).slice().sort(function (a, b) { return b.value - a.value; }).slice(0, 8);
    var avg = studyAverage(data, s.studyId, s.kriCode, latest.id);
    var siteCodes = rows.map(function (r) { return data.sites.filter(function (x) { return x.id === r.siteId; })[0].code; });
    chart.setOption({
      grid: { left: 60, right: 30, top: 16, bottom: 28 },
      tooltip: {},
      xAxis: { type: 'value' }, yAxis: { type: 'category', data: siteCodes, inverse: true },
      series: [
        { type: 'custom', renderItem: function (params, api) {
            var y = api.coord([0, params.dataIndex])[1];
            var lowPt = api.coord([api.value(1), params.dataIndex]); var highPt = api.coord([api.value(2), params.dataIndex]);
            return { type: 'line', shape: { x1: lowPt[0], y1: y, x2: highPt[0], y2: y }, style: { stroke: '#a1a4a6', lineWidth: 2 } };
          }, data: rows.map(function (r, i) { return [i, r.ciLow || r.value, r.ciHigh || r.value]; }), encode: { x: [1, 2], y: 0 } },
        { type: 'scatter', symbolSize: 10, data: rows.map(function (r) { return r.value; }), itemStyle: { color: function (p) { return rows[p.dataIndex].status === 'action' ? '#f0503c' : '#08a8a4'; } } },
        { type: 'line', markLine: { silent: true, symbol: 'none', data: [{ xAxis: avg }], lineStyle: { color: '#707477', type: 'dashed' }, label: { formatter: 'study avg' } }, data: [] }
      ]
    });
  }

  function renderFunnelChart(data, s, kriDef, latest) {
    var chart = getChart('chartFunnel'); if (!chart) return;
    var rows = resultsForSnapshot(data, s.studyId, s.kriCode, latest.id);
    var studyRate = studyAverage(data, s.studyId, s.kriCode, latest.id) || 0.0001;
    var maxExp = Math.max.apply(null, rows.map(function (r) { return r.denominator || 1; }).concat([10]));
    var curvePts = []; var n = 24;
    for (var i = 1; i <= n; i++) {
      var exp = (maxExp / n) * i;
      var lim = STATS.poissonFunnelLimits(studyRate, exp, kriDef.method === 'binomial_funnel' ? 1.5 : 1.6);
      curvePts.push({ x: exp, mod: lim.moderateHigh / studyRate, high: lim.highHigh / studyRate });
    }
    var points = rows.map(function (r) {
      var site = data.sites.filter(function (x) { return x.id === r.siteId; })[0];
      var ratio = STATS.standardizedRatio(r.numerator, studyRate, r.denominator || 1) || 0;
      return { value: [r.denominator, ratio], code: site.code, selected: r.siteId === s.site.id, status: r.status };
    });
    chart.setOption({
      grid: { left: 42, right: 16, top: 16, bottom: 28 },
      tooltip: { formatter: function (p) { return p.data && p.data.code ? 'Site ' + p.data.code + '<br>Ratio: ' + FMT.num(p.data.value[1], 2) : ''; } },
      xAxis: { type: 'value', name: 'Expected events' }, yAxis: { type: 'value', name: 'Standardized ratio' },
      series: [
        { type: 'line', data: curvePts.map(function (p) { return [p.x, p.mod]; }), showSymbol: false, lineStyle: { color: '#ffb133' }, name: 'Moderate limit' },
        { type: 'line', data: curvePts.map(function (p) { return [p.x, 2 - p.mod]; }), showSymbol: false, lineStyle: { color: '#ffb133' } },
        { type: 'line', data: curvePts.map(function (p) { return [p.x, p.high]; }), showSymbol: false, lineStyle: { color: '#f0503c' }, name: 'High limit' },
        { type: 'line', data: curvePts.map(function (p) { return [p.x, Math.max(0, 2 - p.high)]; }), showSymbol: false, lineStyle: { color: '#f0503c' } },
        { type: 'scatter', data: points, symbolSize: function (v, p) { return p.data.selected ? 14 : 7; },
          itemStyle: { color: function (p) { return p.data.selected ? '#70529f' : (p.data.status === 'action' ? '#f0503c' : p.data.status === 'watch' ? '#ffb133' : '#08a8a4'); } } }
      ]
    });
  }

  function signalPanelHtml(data, s, latest) {
    var signal = data.signals.filter(function (sig) { return sig.siteId === s.site.id && sig.kriCode === s.kriCode; })
      .sort(function (a, b) { return b.created < a.created ? -1 : 1; })[0];
    if (!signal) return '<div class="card"><div class="card-title">Signal</div><p class="muted">No signal for this indicator at this site.</p></div>';
    return '<div class="card"><div class="card-head"><div><h3 style="margin-bottom:4px">Signal ' + signal.id + ' <span class="status-pill status-' + (signal.severity === 'action' ? 'action' : 'watch') + '">' + signal.status + '</span></h3></div>' +
      '<a href="#" id="editSignalLink">Edit signal</a></div>' +
      '<p>' + signal.description + '</p>' +
      '<div class="banner banner-ai" style="margin:7px 0"><span aria-hidden="true">&#10022;</span> AI: same CRA team covers other flagged sites. Likely cause: reporting practice.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" id="createCapaBtn">Create CAPA</button>' +
      '<button class="btn" id="assignOwnerBtn">Assign owner</button>' +
      '<button class="btn" id="askAiExplainBtn"><span aria-hidden="true">&#10022;</span> Ask AI to explain</button>' +
      '<button class="btn btn-danger" id="dismissSignalBtn">Dismiss</button>' +
      '</div></div>';
  }

  function signalHistoryHtml(data, s) {
    var sig = data.signals.filter(function (x) { return x.siteId === s.site.id && x.kriCode === s.kriCode; })[0];
    var hist = sig && sig.history ? sig.history : [];
    return '<div class="card"><div class="card-head"><div class="card-title">Signal history</div></div>' +
      (hist.length ? hist.map(function (h) { return '<div style="padding:6px 0;border-bottom:1px solid var(--c-border);font-size:12.5px">' + FMT.dateShort(h.date) + ' - ' + h.status + ' - ' + h.note + '</div>'; }).join('')
        : '<p class="muted">No earlier signals on this site for this indicator.</p>') + '</div>';
  }

  function bindOverviewActions(data, s, row, latest, contentEl) {
    var createBtn = document.getElementById('createCapaBtn');
    if (createBtn) createBtn.addEventListener('click', function () {
      global.RBQM_MODAL.open({
        title: 'Create CAPA', subtitle: 'Site ' + s.site.code + ', ' + KRI.byCode(s.kriCode).name,
        bodyHtml: '<div class="field"><label>Owner</label><select class="select-input"><option>A. Novak, central monitoring lead</option></select></div>' +
          '<div class="field"><label>Due date</label><input class="text-input" type="date" value="' + global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.addDays(global.RBQM_GENERATOR.ASOF, 30)) + '"></div>',
        onConfirm: function () { STORE.logAudit('CAPA', 'CAPA-NEW-' + Date.now(), null, 'Created from KRI detail'); global.RBQM_TOAST.show('CAPA submitted for approval'); return true; }
      });
    });
    var assignBtn = document.getElementById('assignOwnerBtn');
    if (assignBtn) assignBtn.addEventListener('click', function () {
      global.RBQM_MODAL.open({
        title: 'Assign owner', bodyHtml: '<div class="field"><label>Owner</label><select class="select-input" id="ownerSelect">' +
          data.users.map(function (u) { return '<option value="' + u.id + '">' + u.name + ', ' + u.title + '</option>'; }).join('') + '</select></div>',
        onConfirm: function (modalEl) {
          var name = modalEl.querySelector('#ownerSelect').selectedOptions[0].textContent;
          STORE.logAudit('Signal', 'signal', null, 'Assigned to ' + name);
          global.RBQM_TOAST.show('Signal assigned to ' + name.split(',')[0]);
          return true;
        }
      });
    });
    var askAiBtn = document.getElementById('askAiExplainBtn');
    if (askAiBtn) askAiBtn.addEventListener('click', function () {
      var avg = studyAverage(data, s.studyId, s.kriCode, latest.id);
      global.RBQM_MODAL.open({
        title: 'AI explanation', cancelLabel: false, confirmLabel: 'Close',
        bodyHtml: '<span class="ai-label">AI-assisted</span><p>Site ' + s.site.code + ' is ' + FMT.num(row.value, 2) + ' vs a study average of ' + FMT.num(avg, 2) +
          ' for ' + KRI.byCode(s.kriCode).name.toLowerCase() + '. This crosses the ' + (row.status === 'action' ? 'high' : 'moderate') + ' funnel limit, so it is unlikely to be chance.' +
          ' Likely causes: a change in reporting practice, staffing change, or a genuine difference in site conduct.</p>' +
          '<p class="ai-based-on">Based on snapshot ' + FMT.dateShort(latest.date) + '.</p>'
      });
    });
    var dismissBtn = document.getElementById('dismissSignalBtn');
    if (dismissBtn) dismissBtn.addEventListener('click', function () {
      global.RBQM_MODAL.open({
        title: 'Dismiss signal', confirmLabel: 'Dismiss',
        bodyHtml: '<div class="field"><label>Reason</label><textarea class="text-input" id="dismissReason" rows="3"></textarea><div class="error" id="dismissErr" hidden>Enter a reason before dismissing</div></div>',
        onConfirm: function (modalEl) {
          var val = modalEl.querySelector('#dismissReason').value.trim();
          if (!val) { modalEl.querySelector('#dismissErr').hidden = false; return false; }
          STORE.logAudit('Signal', 'signal', null, 'Dismissed: ' + val);
          global.RBQM_TOAST.show('Signal dismissed');
          return true;
        }
      });
    });
  }

  function detailsHtml(data, s, kriDef, latest) {
    var records = detailRecords(data, s, kriDef, latest);
    return '<div class="card"><div class="table-toolbar"><div class="card-title">Underlying records</div><div class="spacer"></div>' +
      '<button class="btn" id="detailsExportBtn">Export CSV</button></div>' +
      '<div id="detailsTableWrap">' + global.RBQM_TABLE.render(records.columns, records.rows) + '</div></div>';
  }

  function detailRecords(data, s, kriDef, latest) {
    var subjIds = data.subjects.filter(function (su) { return su.siteId === s.site.id; }).map(function (su) { return su.id; });
    if (kriDef.code === 'ae_rate' || kriDef.code === 'sae_rate') {
      var subs = data.subjects.filter(function (su) { return su.siteId === s.site.id; });
      return { columns: [
        { key: 'id', label: 'Subject' }, { key: 'enrollDate', label: 'Enrolled', render: function (r) { return FMT.dateShort(r.enrollDate); } },
        { key: 'status', label: 'Status' }, { key: 'arm', label: 'Arm' }
      ], rows: subs };
    }
    var visits = data.visits.filter(function (v) { return v.siteId === s.site.id; });
    return { columns: [
      { key: 'id', label: 'Visit' }, { key: 'subjectId', label: 'Subject' }, { key: 'plannedDate', label: 'Planned', render: function (r) { return FMT.dateShort(r.plannedDate); } },
      { key: 'actualDate', label: 'Actual', render: function (r) { return r.actualDate ? FMT.dateShort(r.actualDate) : 'Missed'; } },
      { key: 'entryDate', label: 'Entered', render: function (r) { return r.entryDate ? FMT.dateShort(r.entryDate) : '–'; } }
    ], rows: visits };
  }

  function bindDetails(data, s, kriDef, latest) {
    var btn = document.getElementById('detailsExportBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var records = detailRecords(data, s, kriDef, latest);
      global.RBQM_TABLE.downloadCsv(s.kriCode + '-' + s.site.code + '.csv', records.columns, records.rows);
      global.RBQM_TOAST.show('Export ready: ' + s.kriCode + '-' + s.site.code + '.csv');
    });
  }

  function thresholdsHtml(data, s, kriDef, latest) {
    return '<div class="card" style="max-width:520px">' +
      '<div class="card-title">Edit thresholds</div>' +
      '<p class="muted" style="font-size:11px">Illustrative defaults. Set your own per study.</p>' +
      '<div class="field"><label>Amber</label><input class="text-input" id="amberInput" type="number" step="0.001" value="' + kriDef.amber + '"></div>' +
      '<div class="field"><label>Red</label><input class="text-input" id="redInput" type="number" step="0.001" value="' + kriDef.red + '"></div>' +
      '<div class="field"><label><input type="checkbox" id="activeToggle" ' + (kriDef.active ? 'checked' : '') + '> Active</label></div>' +
      '<div id="whatIfPreview" class="banner banner-ai" style="margin-bottom:8px"></div>' +
      '<button class="btn btn-primary" id="saveThresholdsBtn">Save</button>' +
      '</div>';
  }

  function whatIfCount(data, s, kriDef, latest, amber, red) {
    var rows = resultsForSnapshot(data, s.studyId, s.kriCode, latest.id);
    var changed = 0;
    rows.forEach(function (r) {
      var newStatus = r.value > red ? 'action' : (r.value > amber ? 'watch' : 'ok');
      if (newStatus !== r.status) changed++;
    });
    return changed;
  }

  function bindThresholds(data, s, kriDef, latest, contentEl) {
    var amberInput = document.getElementById('amberInput'), redInput = document.getElementById('redInput');
    if (!amberInput) return;
    function updatePreview() {
      var amber = parseFloat(amberInput.value), red = parseFloat(redInput.value);
      if (red <= amber) {
        document.getElementById('whatIfPreview').textContent = 'The red threshold must be higher than amber';
        return;
      }
      var n = whatIfCount(data, s, kriDef, latest, amber, red);
      document.getElementById('whatIfPreview').textContent = n + ' site' + (n === 1 ? '' : 's') + ' would change status if saved.';
    }
    amberInput.addEventListener('input', updatePreview);
    redInput.addEventListener('input', updatePreview);
    updatePreview();
    document.getElementById('saveThresholdsBtn').addEventListener('click', function () {
      var amber = parseFloat(amberInput.value), red = parseFloat(redInput.value);
      if (red <= amber) return;
      var n = whatIfCount(data, s, kriDef, latest, amber, red);
      STORE.patch('kriThresholds', s.kriCode, { amber: amber, red: red, active: document.getElementById('activeToggle').checked });
      STORE.logAudit('KRIDefinition', s.kriCode, null, 'Thresholds saved', { amber: kriDef.amber, red: kriDef.red }, { amber: amber, red: red });
      global.RBQM_TOAST.show('Threshold saved. ' + n + ' sites changed status.');
      global.location.reload();
    });
  }

  global.RBQM_PAGE_KRI_DETAIL = { render: render };
})(window);
