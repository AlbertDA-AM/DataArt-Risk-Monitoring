/* Hover help for newcomers (Addendum v0.4, item 12): one shared component.
   - Wraps the first glossary term/alias in selected elements in a dotted-underline span with a tooltip.
   - "Beginner hints" header switch (persisted; on for a first visit, off once the user turns it off).
   - "i" page-help popover next to the page title, text from window.PAGE_HELP.
   Pages need no edits; add data-term="Term name" to a label only where it does not match a term exactly. */
(function (global) {
  'use strict';
  var CFG = global.RBQM_CONFIG;
  var KEY = (CFG.storagePrefix || 'rbqm_') + 'beginner_hints';
  var SELECTORS = 'th, .kpi-label, .card-title, .tab, .chip, .pill, .banner, h1, h2, h3, [data-term]';
  var SKIP = 'button, input, select, textarea, nav, svg, canvas, script, style, .gl-term, .sidebar, .app-header, [data-no-tip]';
  var TITLE_MAP = { 'Risk indicator detail': 'KRI detail', 'Subject': 'Subject drill-down', 'Site profile': 'Site profile', 'Study detail': 'Study detail',
    'Portfolio overview': 'Dashboard', 'Since the last snapshot': 'What changed', 'All studies': 'Studies', 'Library': 'Risk indicators', 'Portfolio': 'Dashboard', 'System': 'Glossary and help' };

  var index = null;      // [{ re, entry }] longest first
  var byKey = null;      // lower-case term or alias -> entry
  var observer = null, scanning = false, timer = null, tipEl = null, showTimer = null, activeTerm = null;

  function slug(term) { return String(term).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function enabled() {
    try { return global.localStorage.getItem(KEY) !== 'off'; } catch (e) { return true; }
  }
  function setEnabled(on) {
    try { global.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* storage blocked: switch still works this page */ }
  }

  function build() {
    if (index) return;
    index = []; byKey = {};
    (global.GLOSSARY || []).forEach(function (entry) {
      var keys = [entry.term].concat(entry.aliases || []);
      var short = entry.term.replace(/\s*\(.*\)\s*$/, '');
      if (keys.indexOf(short) === -1) keys.push(short);
      keys.forEach(function (k) {
        var lk = k.toLowerCase();
        if (!byKey[lk]) { byKey[lk] = entry; index.push({ key: k, lk: lk, entry: entry }); }
      });
    });
    index.sort(function (a, b) { return b.key.length - a.key.length; });
    // One alternation, longest first, whole word. Word boundaries are checked in code (terms may end in symbols).
    index.re = new RegExp('(^|[^A-Za-z0-9])(' + index.map(function (i) { return escRe(i.key); }).join('|') + ')(?![A-Za-z0-9])', 'i');
  }

  function wrapIn(container) {
    var walker = global.document.createTreeWalker(container, global.NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue.trim()) return global.NodeFilter.FILTER_REJECT;
        return n.parentNode.closest && n.parentNode.closest(SKIP) ? global.NodeFilter.FILTER_REJECT : global.NodeFilter.FILTER_ACCEPT;
      }
    });
    var node;
    while ((node = walker.nextNode())) {
      var m = index.re.exec(node.nodeValue);
      if (!m) continue;
      var start = m.index + m[1].length, matched = m[2];
      var entry = byKey[matched.toLowerCase()];
      if (!entry) continue;
      var span = global.document.createElement('span');
      span.className = 'gl-term'; span.tabIndex = 0; span.setAttribute('data-gl', slug(entry.term));
      span.textContent = matched;
      var after = node.splitText(start);
      after.nodeValue = after.nodeValue.slice(matched.length);
      node.parentNode.insertBefore(span, after);
      return true;
    }
    return false;
  }

  function wrapByAttribute(el) {
    var entry = byKey[String(el.getAttribute('data-term')).toLowerCase()];
    if (!entry || el.querySelector('.gl-term')) return;
    var span = global.document.createElement('span');
    span.className = 'gl-term'; span.tabIndex = 0; span.setAttribute('data-gl', slug(entry.term));
    while (el.firstChild) span.appendChild(el.firstChild);
    el.appendChild(span);
  }

  var PILL_TITLES = { 'on track': 'Within the expected range.', 'watch': 'Worth a look at the next snapshot.', 'action needed': 'Outside the expected range. Review now.',
    'insufficient data': 'Too few subjects for a reliable comparison.', 'inactive': 'Not used in scoring.' };

  /** Concise native titles for status pills, scores and the AI label (independent of the Beginner hints switch). */
  function applyTitles(root) {
    root = root || global.document;
    Array.prototype.forEach.call(root.querySelectorAll('.status-pill:not([title])'), function (el) {
      var t = PILL_TITLES[el.textContent.replace(/^Status:\s*/i, '').trim().toLowerCase()];
      if (t) el.setAttribute('title', t);
    });
    Array.prototype.forEach.call(root.querySelectorAll('.risk-badge:not([title])'), function (el) { el.setAttribute('title', 'Combines indicator scores. Safety indicators carry the most weight.'); });
    Array.prototype.forEach.call(root.querySelectorAll('.ai-label:not([title])'), function (el) { el.setAttribute('title', 'Simulated on synthetic data. A person confirms every action.'); });
  }

  // ---- "i" help popovers: any element with data-help="..." gets an "i" button and a one-line popover ----
  var iPop = null;
  function closeIPop() { if (iPop) { iPop.remove(); iPop = null; } }
  function applyHelp(root) {
    Array.prototype.forEach.call((root || global.document).querySelectorAll('[data-help]:not([data-help-done])'), function (el) {
      el.setAttribute('data-help-done', '1');
      var b = global.document.createElement('button');
      b.type = 'button'; b.className = 'help-i'; b.textContent = 'i'; b.setAttribute('aria-label', 'What is this?'); b.setAttribute('data-help-text', el.getAttribute('data-help'));
      el.appendChild(b);
    });
  }
  function bindHelpI() {
    global.document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.help-i');
      if (!b) { if (!(e.target.closest && e.target.closest('.help-pop'))) closeIPop(); return; }
      e.preventDefault(); e.stopPropagation();
      var same = iPop && iPop.getAttribute('data-for') === b.getAttribute('data-help-text');
      closeIPop();
      if (same) return;
      iPop = global.document.createElement('div');
      iPop.className = 'page-help-pop help-pop'; iPop.setAttribute('role', 'note'); iPop.setAttribute('data-for', b.getAttribute('data-help-text'));
      iPop.textContent = b.getAttribute('data-help-text');
      iPop.style.width = '260px';
      global.document.body.appendChild(iPop);
      var r = b.getBoundingClientRect();
      iPop.style.left = Math.max(8, Math.min(r.left, global.innerWidth - 276)) + 'px';
      iPop.style.top = (r.bottom + 6) + 'px';
    });
    global.document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeIPop(); });
  }

  function scan(root) {
    applyHelp(global.document);
    applyTitles(global.document);
    if (!enabled() || !global.GLOSSARY) return;
    build();
    root = root || global.document.getElementById('appContent') || global.document.body;
    scanning = true;
    try {
      Array.prototype.forEach.call(root.querySelectorAll(SELECTORS), function (el) {
        if (el.closest(SKIP.replace('.gl-term, ', '')) || el.querySelector('.gl-term') || el.getAttribute('data-gl-done')) return;
        if (el.hasAttribute('data-term')) wrapByAttribute(el); else wrapIn(el);
        el.setAttribute('data-gl-done', '1');
      });
    } finally { scanning = false; }
  }

  function unwrapAll() {
    Array.prototype.forEach.call(global.document.querySelectorAll('.gl-term'), function (s) {
      var p = s.parentNode;
      while (s.firstChild) p.insertBefore(s.firstChild, s);
      p.removeChild(s); p.normalize();
    });
    Array.prototype.forEach.call(global.document.querySelectorAll('[data-gl-done]'), function (e) { e.removeAttribute('data-gl-done'); });
    hideTip();
  }

  // ---- Tooltip -----------------------------------------------------------------------------
  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = global.document.createElement('div');
    tipEl.className = 'gl-tip'; tipEl.setAttribute('role', 'tooltip'); tipEl.hidden = true; tipEl.id = 'glTip';
    global.document.body.appendChild(tipEl);
    tipEl.addEventListener('mouseenter', function () { clearTimeout(showTimer); });
    tipEl.addEventListener('mouseleave', hideTip);
    return tipEl;
  }

  function entryFor(el) {
    var s = el.getAttribute('data-gl');
    return (global.GLOSSARY || []).filter(function (e) { return slug(e.term) === s; })[0];
  }

  function showTip(el) {
    var entry = entryFor(el);
    if (!entry || !enabled()) return;
    var tip = ensureTip();
    tip.innerHTML = '<div class="gl-tip-term">' + esc(entry.term) + '</div><div>' + esc(entry.definition) + '</div>' +
      '<div class="gl-tip-why"><b>Why it matters:</b> ' + esc(entry.why) + '</div>' +
      '<a class="gl-tip-link" href="glossary-help.html#term=' + slug(entry.term) + '">Learn more</a>';
    tip.hidden = false; activeTerm = el;
    el.setAttribute('aria-describedby', 'glTip');
    var r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    var left = Math.max(8, Math.min(r.left, global.innerWidth - tr.width - 8));
    var below = r.bottom + 6 + tr.height < global.innerHeight || r.top - tr.height - 6 < 0;
    tip.style.left = left + 'px';
    tip.style.top = (below ? r.bottom + 6 : r.top - tr.height - 6) + 'px';
  }

  function hideTip() {
    clearTimeout(showTimer);
    if (tipEl) tipEl.hidden = true;
    if (activeTerm) { activeTerm.removeAttribute('aria-describedby'); activeTerm = null; }
  }

  function bindTips() {
    var doc = global.document;
    doc.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('.gl-term');
      if (!t || t === activeTerm) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(function () { showTip(t); }, 250);
    });
    doc.addEventListener('mouseout', function (e) {
      var t = e.target.closest && e.target.closest('.gl-term');
      if (!t) return;
      clearTimeout(showTimer);
      showTimer = setTimeout(function () { if (!tipEl || !tipEl.matches(':hover')) hideTip(); }, 120);
    });
    doc.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('.gl-term'); if (t) showTip(t); });
    doc.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.gl-term')) setTimeout(function () { if (!tipEl || !tipEl.matches(':hover')) hideTip(); }, 100); });
    doc.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('.gl-term');
      if (t) { if (activeTerm === t && !tipEl.hidden) hideTip(); else showTip(t); return; }
      if (!(e.target.closest && e.target.closest('.gl-tip'))) hideTip();
    });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideTip(); closeHelp(); } });
  }

  // ---- Page help popover ---------------------------------------------------------------------
  var helpEl = null;

  function helpKey(opts) {
    var help = global.PAGE_HELP || {};
    if (TITLE_MAP[opts.title] && help[TITLE_MAP[opts.title]]) return TITLE_MAP[opts.title];
    var nav = (global.RBQM_NAV || []).reduce(function (a, g) { return a.concat(g.items || [g]); }, []);
    var item = nav.filter(function (n) { return n.id === opts.activeId; })[0];
    if (opts.title && help[opts.title]) return opts.title;
    if (item && help[item.label]) return item.label;
    return null;
  }

  function closeHelp() {
    if (helpEl) { helpEl.remove(); helpEl = null; }
    var b = global.document.getElementById('pageHelpBtn');
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  function openHelp(opts) {
    var key = helpKey(opts);
    var h = key && global.PAGE_HELP[key];
    var btn = global.document.getElementById('pageHelpBtn');
    if (!btn) return;
    closeHelp();
    helpEl = global.document.createElement('div');
    helpEl.className = 'page-help-pop'; helpEl.setAttribute('role', 'dialog'); helpEl.setAttribute('aria-label', 'What is this page?');
    helpEl.innerHTML = h
      ? '<div class="page-help-title">' + esc(key) + '</div><p><b>What it shows.</b> ' + esc(h.what) + '</p><p><b>What to do.</b> ' + esc(h.use) + '</p><p class="muted"><b>Tip.</b> ' + esc(h.tip) + '</p>' +
        '<a href="glossary-help.html">Open glossary</a>'
      : '<p>No help text is available for this page.</p><a href="glossary-help.html">Open glossary</a>';
    global.document.body.appendChild(helpEl);
    var r = btn.getBoundingClientRect();
    helpEl.style.left = Math.max(8, Math.min(r.left, global.innerWidth - 348)) + 'px';
    helpEl.style.top = (r.bottom + 6) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    var first = helpEl.querySelector('a'); if (first) first.focus({ preventScroll: true });
  }

  function helpButtonHtml() {
    return '<button class="page-help-btn" id="pageHelpBtn" type="button" aria-label="What is this page?" aria-haspopup="dialog" aria-expanded="false" title="What is this page?">i</button>';
  }
  function toggleHtml() {
    return '<label class="hint-toggle" title="Show dotted-underline definitions for terms on this page"><input type="checkbox" id="beginnerHints"' + (enabled() ? ' checked' : '') + '> Beginner hints</label>';
  }

  function observe() {
    var root = global.document.getElementById('appContent');
    if (!root || !global.MutationObserver || observer) return;
    observer = new global.MutationObserver(function () {
      if (scanning) return;
      clearTimeout(timer);
      timer = setTimeout(function () { scan(root); }, 150);
    });
    observer.observe(root, { childList: true, subtree: true });
    // Drawers and modals are appended to <body>; give their labels the same hover help.
    new global.MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.classList && n.classList.contains('overlay')) setTimeout(function () { applyHelp(n); scan(n); }, 0); }); });
    }).observe(global.document.body, { childList: true });
  }

  /** Called by RBQM_SHELL after the header is in the DOM. */
  function mount(opts) {
    bindTips();
    bindHelpI();
    var btn = global.document.getElementById('pageHelpBtn');
    if (btn) btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (helpEl) closeHelp(); else openHelp(opts || {});
    });
    global.document.addEventListener('click', function (e) {
      if (helpEl && !(e.target.closest && (e.target.closest('.page-help-pop') || e.target.closest('#pageHelpBtn')))) closeHelp();
    });
    var sw = global.document.getElementById('beginnerHints');
    if (sw) sw.addEventListener('change', function () {
      setEnabled(sw.checked);
      if (sw.checked) scan(); else unwrapAll();
      global.RBQM_TOAST && global.RBQM_TOAST.show(sw.checked ? 'Beginner hints on' : 'Beginner hints off');
    });
    observe();
  }

  global.RBQM_GLOSSARY_TIP = { mount: mount, scan: scan, applyTitles: applyTitles, applyHelp: applyHelp, slug: slug, enabled: enabled, helpButtonHtml: helpButtonHtml, toggleHtml: toggleHtml, helpKey: helpKey };
})(window);
