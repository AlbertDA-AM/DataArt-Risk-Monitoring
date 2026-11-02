/* Shared formatting helpers so the same number/date renders identically everywhere. */
(function (global) {
  'use strict';

  function pct(value, decimals) {
    if (value == null) return '–';
    return (value * 100).toFixed(decimals != null ? decimals : 1) + '%';
  }

  function num(value, decimals) {
    if (value == null) return '–';
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals != null ? decimals : 2 });
  }

  function intFmt(value) {
    if (value == null) return '–';
    return Math.round(value).toLocaleString('en-US');
  }

  function usd(value) {
    if (value == null) return '–';
    if (Math.abs(value) >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
    if (Math.abs(value) >= 1000) return '$' + (value / 1000).toFixed(0) + 'K';
    return '$' + Math.round(value);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateShort(isoStr) {
    if (!isoStr) return '–';
    var d = new Date(isoStr);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function dateMonthYear(isoStr) {
    var d = new Date(isoStr);
    return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function daysAgo(isoStr, asOfIso) {
    var asOf = new Date(asOfIso || window.RBQM_CONFIG.asOfDate);
    return Math.round((asOf - new Date(isoStr)) / 86400000);
  }

  function titleCase(s) {
    return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function statusLabel(status) {
    return { ok: 'On track', watch: 'Watch', action: 'Action needed', insufficient: 'Insufficient data', inactive: 'Not active' }[status] || status;
  }

  function statusClass(status) {
    return { ok: 'status-ok', watch: 'status-watch', action: 'status-action', insufficient: 'status-insufficient', inactive: 'status-inactive' }[status] || '';
  }

  global.RBQM_FORMAT = { pct: pct, num: num, int: intFmt, usd: usd, dateShort: dateShort, dateMonthYear: dateMonthYear, daysAgo: daysAgo, titleCase: titleCase, statusLabel: statusLabel, statusClass: statusClass };
})(window);
