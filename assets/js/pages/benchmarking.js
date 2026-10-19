/* Benchmarking: Countries, Sites, CROs tabs. Compare one entity vs portfolio average per KRI,
   with a distribution plot, rank and percentile. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var G = global.RBQM_GENERATOR;
  var chart;

  function latestRowsForKri(data, code) {
    var out = [];
    data.studies.forEach(function (study) {
      var snap = G.latestFinalizedSnapshotForStudy(data.snapshots, study.id);
      data.kriResults.filter(function (r) { return r.kriCode === code && r.snapshotId === snap.id && r.status !== 'insufficient'; }).forEach(function (r) { out.push(r); });
    });
    return out;
  }

  function groupBy(data, rows, type) {
    var groups = {};
    rows.forEach(function (r) {
      var site = data.sites.filter(function (s) { return s.id === r.siteId; })[0];
      if (!site) return;
      var key = type === 'country' ? site.country : type === 'cro' ? site.croId : site.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r.value);
    });
    return Object.keys(groups).map(function (k) {
      var vals = groups[k];
      return { key: k, value: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length };
    });
  }

  function labelFor(data, type, key) {
    if (type === 'country') return (global.RBQM_REFERENCE.countryByIso(key) || { name: key }).name;
    if (type === 'cro') return (data.cros.filter(function (c) { return c.id === key; })[0] || { name: key }).name;
    var s = data.sites.filter(function (s) { return s.id === key; })[0];
    return s ? 'Site ' + s.code + ', ' + s.country : key;
  }

  function render(contentEl, data) {
    var tab = 'country', kriCode = 'query_response_time', entityKey = null;

    function draw() {
      contentEl.innerHTML =
        '<div class="tabs" id="benchTabs">' +
        '<button class="tab' + (tab === 'country' ? ' active' : '') + '" data-tab="country">Countries</button>' +
        '<button class="tab' + (tab === 'site' ? ' active' : '') + '" data-tab="site">Sites</button>' +
        '<button class="tab' + (tab === 'cro' ? ' active' : '') + '" data-tab="cro">CROs</button></div>' +
        '<div class="card"><div class="field"><label>Indicator</label><select class="select-input" id="kriSelect">' +
        KRI.KRIS.filter(function (k) { return k.active; }).map(function (k) { return '<option value="' + k.code + '"' + (k.code === kriCode ? ' selected' : '') + '>' + k.name + '</option>'; }).join('') +
        '</select></div><div id="benchChart" style="height:280px"></div><div id="benchRank"></div></div>';

      document.getElementById('benchTabs').querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { tab = t.dataset.tab; entityKey = null; draw(); }); });
      document.getElementById('kriSelect').addEventListener('change', function (e) { kriCode = e.target.value; draw(); });
      mountChart();
    }

    function mountChart() {
      var el = document.getElementById('benchChart');
      if (chart) chart.dispose();
      chart = echarts.init(el);
      var rows = latestRowsForKri(data, kriCode);
      var groups = groupBy(data, rows, tab).sort(function (a, b) { return b.value - a.value; });
      if (!entityKey && groups.length) entityKey = groups[0].key;
      var portfolioAvg = groups.reduce(function (s, g) { return s + g.value; }, 0) / (groups.length || 1);

      chart.setOption({
        grid: { left: 140, right: 30, top: 10, bottom: 28 },
        tooltip: {},
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: groups.map(function (g) { return labelFor(data, tab, g.key); }) },
        series: [
          { type: 'bar', barWidth: 10, data: groups.map(function (g) { return { value: g.value, itemStyle: { color: g.key === entityKey ? '#70529f' : '#a1a4a6' } }; }) },
          { type: 'line', markLine: { silent: true, symbol: 'none', data: [{ xAxis: portfolioAvg }], lineStyle: { color: '#3453ad', type: 'dashed' }, label: { formatter: 'avg' } }, data: [] }
        ]
      });
      chart.off('click'); chart.on('click', function (p) { entityKey = groups[p.dataIndex].key; renderRank(groups, portfolioAvg); mountChart(); });
      renderRank(groups, portfolioAvg);
    }

    function renderRank(groups, avg) {
      var idx = groups.findIndex(function (g) { return g.key === entityKey; });
      var entity = groups[idx];
      var percentile = groups.length > 1 ? Math.round((1 - idx / (groups.length - 1)) * 100) : 100;
      document.getElementById('benchRank').innerHTML = entity ? (
        '<p><b>' + labelFor(data, tab, entity.key) + '</b>: ' + FMT.num(entity.value, 2) + ' vs portfolio average ' + FMT.num(avg, 2) +
        '. Rank ' + (idx + 1) + ' of ' + groups.length + ', ' + percentile + 'th percentile (worst to best).</p>'
      ) : '';
    }

    draw();
  }

  global.RBQM_PAGE_BENCHMARKING = { render: render };
})(window);
