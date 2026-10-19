/* URL parameter helpers: filters and selected entities live in the URL so pages are
   linkable and back/forward work. Thin wrapper over URLSearchParams + history.replaceState. */
(function (global) {
  'use strict';

  function params() { return new URLSearchParams(global.location.search); }

  function get(key, fallback) {
    var v = params().get(key);
    return v != null ? v : (fallback != null ? fallback : null);
  }

  function getAll(key) { return params().getAll(key); }

  /** Set one or more params; null/empty removes the key. Updates the URL without reloading. */
  function set(patch, opts) {
    opts = opts || {};
    var p = params();
    Object.keys(patch).forEach(function (k) {
      var v = patch[k];
      if (v === null || v === undefined || v === '') p.delete(k);
      else p.set(k, v);
    });
    var qs = p.toString();
    var url = global.location.pathname + (qs ? '?' + qs : '') + global.location.hash;
    if (opts.push) global.history.pushState({}, '', url);
    else global.history.replaceState({}, '', url);
  }

  function buildUrl(page, patch) {
    var p = new URLSearchParams();
    Object.keys(patch || {}).forEach(function (k) { if (patch[k] != null && patch[k] !== '') p.set(k, patch[k]); });
    var qs = p.toString();
    return page + (qs ? '?' + qs : '');
  }

  function navigate(page, patch) { global.location.href = buildUrl(page, patch); }

  function onChange(fn) { global.addEventListener('popstate', fn); }

  global.RBQM_ROUTER = { get: get, getAll: getAll, set: set, buildUrl: buildUrl, navigate: navigate, onChange: onChange };
})(window);
