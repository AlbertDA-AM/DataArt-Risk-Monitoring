/* Simulated AI assistant: no live LLM. Normalizes text, extracts entities, scores intents
   by keyword groups, keeps context memory for follow-ups, and falls back to the 3 closest
   intents. Intent answer builders live in engine/assistant-intents.js (loaded after this). */
(function (global) {
  'use strict';
  var KRI = global.RBQM_KRI_CATALOG;
  var G = global.RBQM_GENERATOR;

  function normalize(text) {
    return String(text || '').toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** Pulls entities (site, country, KRI, study, CRO, signal, CAPA) out of normalized text,
      falling back to the conversation context ("it", "that site") when nothing is found. */
  function extractEntities(text, data, ctx) {
    var e = {};
    var siteMatch = text.match(/site\s*-?\s*(\d{2,3})/) || text.match(/\b(\d{3})\b/);
    if (siteMatch) {
      var site = data.sites.filter(function (s) { return s.code === siteMatch[1]; })[0];
      if (site) e.site = site;
    }
    data.countries.forEach(function (c) { if (text.indexOf(c.name.toLowerCase()) !== -1) e.country = c; });
    KRI.KRIS.forEach(function (k) {
      if (!k.active) return;
      if (text.indexOf(k.name.toLowerCase()) !== -1 || text.indexOf(k.shortName.toLowerCase()) !== -1) e.kri = k;
    });
    data.studies.forEach(function (s) { if (text.indexOf(s.id.toLowerCase()) !== -1) e.study = s; });
    if (text.indexOf('flagship') !== -1) e.study = data.studies.filter(function (s) { return s.id === 'CV-5645'; })[0];
    data.cros.forEach(function (c) { if (text.indexOf(c.id.toLowerCase()) !== -1 || text.indexOf(c.name.toLowerCase()) !== -1) e.cro = c; });
    var sigMatch = text.match(/sig-?\s?(\d{3,4})/i);
    if (sigMatch) e.signal = data.signals.filter(function (s) { return s.id.toUpperCase() === 'SIG-' + sigMatch[1]; })[0];
    var capaMatch = text.match(/capa[\w-]*/i);
    if (capaMatch) e.capa = data.capas.filter(function (c) { return c.id.toLowerCase() === capaMatch[0].toLowerCase(); })[0];

    // Follow-up / pronoun resolution from context memory.
    if (!e.site && ctx && ctx.lastSite && /\b(it|that site|this site)\b/.test(text)) e.site = ctx.lastSite;
    if (!e.country && ctx && ctx.lastCountry && /\b(it|that country|and\b)\b/.test(text)) e.country = ctx.lastCountry;
    if (!e.signal && ctx && ctx.lastSignal && /\b(it|this signal|that signal)\b/.test(text)) e.signal = ctx.lastSignal;
    if (!e.kri && ctx && ctx.lastKri) e.kri = e.kri || (/\b(it|that)\b/.test(text) ? ctx.lastKri : null);

    return e;
  }

  /** Word-boundary match so short common keywords (e.g. "to", "it") don't false-positive
      inside unrelated words ("today", "fits"). Multi-word phrases match as substrings. */
  function containsKeyword(text, kw) {
    if (kw.indexOf(' ') !== -1) return text.indexOf(kw) !== -1;
    return new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(text);
  }

  function scoreIntent(text, intent, entities) {
    var score = 0;
    (intent.keywords || []).forEach(function (group) {
      var hit = (Array.isArray(group) ? group : [group]).some(function (kw) { return containsKeyword(text, kw); });
      if (hit) score += 1;
    });
    (intent.requiresEntity || []).forEach(function (key) { if (entities[key]) score += 0.5; });
    return score;
  }

  /** Public entry point: ask(text, context, data, store) -> {intentId, entities, response}. */
  function ask(text, ctx, data, store) {
    var norm = normalize(text);
    var entities = extractEntities(norm, data, ctx);
    entities.rawText = norm;
    var defs = global.RBQM_ASSISTANT_INTENTS;
    var scored = defs.map(function (intent) { return { intent: intent, score: scoreIntent(norm, intent, entities) }; })
      .sort(function (a, b) { return b.score - a.score; });

    var best = scored[0];
    if (!best || best.score < 1) {
      var closest = scored.slice(0, 3).map(function (s) { return s.intent; });
      return {
        intentId: 'fallback', entities: entities,
        response: {
          aiAssisted: true,
          text: "I can't answer that yet. Here are questions I can help with:",
          followUps: closest.map(function (i) { return i.example || i.id; })
        }
      };
    }

    // Update context memory.
    if (entities.site) ctx.lastSite = entities.site;
    if (entities.country) ctx.lastCountry = entities.country;
    if (entities.kri) ctx.lastKri = entities.kri;
    if (entities.signal) ctx.lastSignal = entities.signal;

    var response = best.intent.run(entities, data, store, ctx);
    return { intentId: best.intent.id, entities: entities, response: response };
  }

  global.RBQM_ASSISTANT = { normalize: normalize, extractEntities: extractEntities, ask: ask };
})(window);
