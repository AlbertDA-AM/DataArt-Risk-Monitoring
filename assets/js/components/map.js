/* World map with zoom/pan (reference: prep-docs/05-map-reference.html, reused behavior).
   Country data (site counts, status) always comes from the data layer via opts.countryData,
   never hard-coded. Anchors are hand-set so bubbles for US/France/etc. are not pulled by
   overseas territories. */
(function (global) {
  'use strict';

  // iso -> [lon, lat] anchor point, hand-set (not centroid) for the 15 portfolio countries.
  var ANCHORS = {
    US: [-98, 39], CA: [-100, 56], BR: [-52, -12], AR: [-64, -34], UK: [-2, 54], FR: [2, 47],
    DE: [10, 51], PL: [19, 52], ES: [-4, 40], IT: [12, 43], ZA: [24, -29], IN: [79, 22],
    JP: [138, 37], KR: [128, 36], AU: [134, -25]
  };
  // world-atlas country name -> our iso code.
  var NAME_TO_ISO = {
    'United States of America': 'US', 'Canada': 'CA', 'Brazil': 'BR', 'Argentina': 'AR',
    'United Kingdom': 'UK', 'France': 'FR', 'Germany': 'DE', 'Poland': 'PL', 'Spain': 'ES',
    'Italy': 'IT', 'South Africa': 'ZA', 'India': 'IN', 'Japan': 'JP', 'South Korea': 'KR',
    'Australia': 'AU'
  };
  var COLORS = { action: '#f0503c', watch: '#ffb133', ok: '#08a8a4', neutral: '#e2e6e9' };

  function colorFor(entry) {
    if (!entry) return COLORS.neutral;
    if (entry.action > 0) return COLORS.action;
    if (entry.watch > 0) return COLORS.watch;
    return COLORS.ok;
  }

  /** opts: {containerId, countryData: {iso: {count, action, watch, name}}, onSelect(iso|null)} */
  function render(opts) {
    var W = 652, H = 330;
    var container = document.getElementById(opts.containerId);
    container.innerHTML =
      '<div class="card-head"><div><div class="card-title">Site risk by country</div>' +
      '<div class="card-subtitle">Bubble size is the number of sites. Click a country.</div></div>' +
      '<div class="map-legend"><span><i style="background:' + COLORS.ok + '"></i>On track</span>' +
      '<span><i style="background:' + COLORS.watch + '"></i>Watch</span>' +
      '<span><i style="background:' + COLORS.action + '"></i>Action needed</span></div></div>' +
      '<div class="map-wrap"><div id="' + opts.containerId + 'Svg" class="map-svg-host"></div>' +
      '<div class="map-zoom-ctrl"><button id="' + opts.containerId + 'ZoomIn" aria-label="Zoom in">+</button>' +
      '<button id="' + opts.containerId + 'ZoomOut" aria-label="Zoom out">&minus;</button>' +
      '<button id="' + opts.containerId + 'ZoomReset" aria-label="Reset view">&#8962;</button></div>' +
      '<div class="map-hint">Drag to pan. Ctrl or Cmd plus scroll to zoom. Click a country to zoom in.</div>' +
      '<div class="map-tip" id="' + opts.containerId + 'Tip"></div></div>' +
      '<div class="map-selection" id="' + opts.containerId + 'Sel">Click a country to see its sites. Hover for a summary.</div>';

    var svg = d3.select('#' + opts.containerId + 'Svg').append('svg')
      .attr('viewBox', '0 0 ' + W + ' ' + H).attr('width', '100%').attr('role', 'img')
      .attr('aria-label', 'World map with country risk bubbles').style('display', 'block').style('touch-action', 'none');
    var tip = document.getElementById(opts.containerId + 'Tip');
    var sel = document.getElementById(opts.containerId + 'Sel');
    var box = container.querySelector('.map-wrap');

    d3.json('../vendor/world-atlas/countries-110m.json').then(function (world) {
      var features = topojson.feature(world, world.objects.countries).features.filter(function (f) { return f.properties.name !== 'Antarctica'; });
      var projection = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], { type: 'FeatureCollection', features: features });
      var path = d3.geoPath(projection);
      var view = svg.append('g');
      var K = 1;

      view.append('g').selectAll('path').data(features).join('path').attr('d', path)
        .style('fill', function (f) { var iso = NAME_TO_ISO[f.properties.name]; return colorFor(opts.countryData[iso]); })
        .style('fill-opacity', function (f) { return NAME_TO_ISO[f.properties.name] && opts.countryData[NAME_TO_ISO[f.properties.name]] ? 0.28 : 1; })
        .style('stroke', '#cfd3d6').style('stroke-width', 0.4).attr('vector-effect', 'non-scaling-stroke')
        .style('cursor', function (f) { var iso = NAME_TO_ISO[f.properties.name]; return opts.countryData[iso] ? 'pointer' : 'grab'; })
        .on('click', function (e, f) { var iso = NAME_TO_ISO[f.properties.name]; if (opts.countryData[iso]) pick(iso); });

      var g = view.append('g');
      var bubbles = Object.keys(opts.countryData).filter(function (iso) { return ANCHORS[iso]; }).map(function (iso) {
        var entry = opts.countryData[iso];
        var anchor = ANCHORS[iso];
        var p = projection(anchor);
        var c = g.append('g').attr('class', 'b').attr('tabindex', '0').attr('aria-label', entry.name + ': ' + entry.count + ' sites')
          .style('cursor', 'pointer')
          .on('click', function (e) { e.stopPropagation(); pick(iso); })
          .on('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(iso); } })
          .on('mousemove', function (e) {
            var b = box.getBoundingClientRect();
            tip.style.display = 'block'; tip.style.left = (e.clientX - b.left + 12) + 'px'; tip.style.top = (e.clientY - b.top + 12) + 'px';
            tip.innerHTML = '<b>' + entry.name + '</b><br>' + entry.count + ' sites, ' + entry.action + ' action needed, ' + entry.watch + ' on watch';
          })
          .on('mouseleave', function () { tip.style.display = 'none'; });
        var r = 5 + Math.sqrt(entry.count) * 2.1;
        c.append('circle').attr('r', r).attr('fill', colorFor(entry)).attr('fill-opacity', 0.85).attr('stroke', '#ffffff').attr('stroke-width', 1.5);
        c.append('text').attr('y', 3).attr('text-anchor', 'middle').attr('font-size', 9).attr('font-weight', 700)
          .attr('fill', entry.action > 0 || entry.watch === 0 ? '#ffffff' : '#0a1e53').attr('pointer-events', 'none').text(iso);
        return { iso: iso, p: p, c: c };
      });

      function place(k) { bubbles.forEach(function (b) { b.c.attr('transform', 'translate(' + b.p[0] + ',' + b.p[1] + ') scale(' + (1 / Math.sqrt(k)) + ')'); }); }
      place(1);

      var zoom = d3.zoom().scaleExtent([1, 8]).extent([[0, 0], [W, H]]).translateExtent([[0, 0], [W, H]])
        .filter(function (e) { return e.type === 'wheel' ? (e.ctrlKey || e.metaKey) : !e.button; })
        .on('zoom', function (e) { K = e.transform.k; view.attr('transform', e.transform); place(K); });
      svg.call(zoom).on('dblclick.zoom', null);
      document.getElementById(opts.containerId + 'ZoomIn').onclick = function () { svg.transition().duration(250).call(zoom.scaleBy, 1.6); };
      document.getElementById(opts.containerId + 'ZoomOut').onclick = function () { svg.transition().duration(250).call(zoom.scaleBy, 1 / 1.6); };
      document.getElementById(opts.containerId + 'ZoomReset').onclick = function () {
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
        sel.innerHTML = 'Click a country to see its sites. Hover for a summary.';
        if (opts.onSelect) opts.onSelect(null);
      };

      function pick(iso) {
        var entry = opts.countryData[iso];
        var anchor = ANCHORS[iso];
        var p = projection(anchor);
        var k = entry.count >= 15 ? 2.6 : 3.6;
        svg.transition().duration(550).call(zoom.transform, d3.zoomIdentity.translate(W / 2 - k * p[0], H / 2 - k * p[1]).scale(k));
        sel.innerHTML = '<b>' + entry.name + '</b>: ' + entry.count + ' sites. ' + entry.action + ' action needed, ' + entry.watch + ' on watch, ' +
          (entry.count - entry.action - entry.watch) + ' on track. <a href="#" id="' + opts.containerId + 'FilterLink">Filter the site table</a>';
        var link = document.getElementById(opts.containerId + 'FilterLink');
        if (link) link.addEventListener('click', function (e) { e.preventDefault(); if (opts.onSelect) opts.onSelect(iso); });
        if (opts.onSelect) opts.onSelect(iso);
      }
    }).catch(function () {
      container.querySelector('#' + opts.containerId + 'Svg').innerHTML = '<p class="muted">The map could not load.</p>';
    });
  }

  global.RBQM_MAP = { render: render };
})(window);
