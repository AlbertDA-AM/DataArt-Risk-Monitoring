/* State + localStorage. The seed (window.RBQM_DATA) is the immutable baseline; this store
   holds a small "overlay" of user edits (signal status, CAPA state, thresholds, chat, etc.)
   persisted in localStorage and merged over the seed at read time. Wrapped in try/catch so
   the app keeps working without storage (private browsing, quota, file://). */
(function (global) {
  'use strict';
  var CFG = global.RBQM_CONFIG;
  var KEY = CFG.storagePrefix + 'overlay_v' + CFG.storageVersion;

  function safeParse(json, fallback) {
    try { return JSON.parse(json); } catch (e) { return fallback; }
  }

  function emptyOverlay() {
    return {
      signals: {},      // id -> {status, ownerId, history[], ...patch}
      capas: {},        // id -> {state, ...patch}
      risks: {},        // id -> {...patch}
      kriThresholds: {},// code -> {amber, red, active}
      monitoringPlan: {}, // siteId -> {status, overrideReason, due}
      snapshots: {},    // id -> {status}
      watchlist: {},     // siteId -> true
      notes: {},        // entityKey -> [{text,userId,date}]
      savedViews: [],
      notifications: [],
      chatHistory: [],
      auditEvents: [],
      pinned: [],       // ai answers pinned to dashboard
      reportItems: [],  // "Add to report" saved items
      feedback: {}       // ai answer id -> 'helpful' | 'not_helpful'
    };
  }

  var cache = null;

  function load() {
    if (cache) return cache;
    try {
      var raw = global.localStorage.getItem(KEY);
      cache = raw ? Object.assign(emptyOverlay(), safeParse(raw, {})) : emptyOverlay();
    } catch (e) {
      cache = emptyOverlay();
    }
    return cache;
  }

  function persist() {
    try { global.localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* ignore */ }
  }

  function get(section, id) {
    var o = load();
    return id ? o[section][id] : o[section];
  }

  function patch(section, id, patchObj) {
    var o = load();
    o[section][id] = Object.assign({}, o[section][id], patchObj);
    persist();
    return o[section][id];
  }

  function push(section, item) {
    var o = load();
    o[section].push(item);
    persist();
    return item;
  }

  /** For array-typed sections (savedViews, notifications, auditEvents, pinned, reportItems):
      replace the whole array, e.g. after filtering an item out. */
  function setArray(section, arr) {
    var o = load();
    o[section] = arr;
    persist();
    return arr;
  }

  function remove(section, id) {
    var o = load();
    delete o[section][id];
    persist();
  }

  function reset() {
    try { global.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    cache = emptyOverlay();
    persist();
  }

  function logAudit(entity, entityId, userId, action, before, after) {
    push('auditEvents', {
      id: 'AUD-OVL-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      entity: entity, entityId: entityId, userId: userId || CFG.sponsorId,
      action: action, before: before != null ? before : null, after: after != null ? after : null,
      timestamp: new Date().toISOString()
    });
  }

  global.RBQM_STORE = { load: load, get: get, patch: patch, push: push, setArray: setArray, remove: remove, reset: reset, logAudit: logAudit, emptyOverlay: emptyOverlay };
})(window);
