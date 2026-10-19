/* KPI card: label, big value, trend delta, small inline SVG sparkline (no chart lib needed). */
(function (global) {
  'use strict';

  function sparkline(values, color, w, h) {
    w = w || 90; h = h || 28;
    if (!values || values.length < 2) return '';
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var pts = values.map(function (v, i) {
      var x = (i / (values.length - 1)) * (w - 4) + 2;
      var y = h - 2 - ((v - min) / span) * (h - 4);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    var last = values[values.length - 1];
    var lastX = w - 2, lastY = h - 2 - ((last - min) / span) * (h - 4);
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' +
      '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + lastX + '" cy="' + lastY.toFixed(1) + '" r="3" fill="' + color + '"/></svg>';
  }

  /** opts: {label, value, deltaText, deltaTone ('up-bad'|'down-good'|''), trend: number[], color} */
  function render(opts) {
    var color = opts.color || '#3453ad';
    return '<div class="card kpi-card">' +
      '<div class="kpi-label">' + opts.label + '</div>' +
      '<div class="kpi-value">' + opts.value + '</div>' +
      sparkline(opts.trend, color) +
      (opts.deltaText ? '<div class="kpi-delta ' + (opts.deltaTone || '') + '">' + opts.deltaText + '</div>' : '') +
      '</div>';
  }

  global.RBQM_KPI_CARD = { render: render, sparkline: sparkline };
})(window);
