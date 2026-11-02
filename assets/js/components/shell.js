/* App shell: mounts sidebar + header + footer around a page's content, wires global
   behaviors (reset demo data, Ask AI panel). Every page calls RBQM_SHELL.mount once. */
(function (global) {
  'use strict';
  var CFG = global.RBQM_CONFIG;

  /** First-visit splash: logo, product name and a short progress bar. Shown once per browser (flag in localStorage);
      Reset demo data clears the flag so it plays again. Click or press Escape to skip. */
  function splash() {
    var KEY = (CFG.storagePrefix || 'rbqm_') + 'splash_seen';
    try { if (global.localStorage.getItem(KEY)) return; global.localStorage.setItem(KEY, '1'); } catch (e) { return; }
    var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var el = document.createElement('div');
    el.className = 'splash'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<div class="splash-inner"><img src="../assets/img/dataart-logo-large-white.svg" alt="DataArt">' +
      '<div class="splash-title">' + CFG.productName + '</div><div class="splash-sub">Loading synthetic demo data</div>' +
      '<div class="splash-bar"><div class="splash-fill"></div></div><div class="splash-note">Prototype with synthetic data. Not validated for regulated use.</div></div>';
    document.body.appendChild(el);
    var done = false;
    function close() {
      if (done) return; done = true;
      document.removeEventListener('keydown', onKey);
      el.classList.add('splash-out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, reduce ? 0 : 400);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    el.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    setTimeout(close, reduce ? 600 : 2200);
  }

  function mount(opts) {
    var data = global.RBQM_DATA;
    if (global.RBQM_SIGNALS && global.RBQM_SIGNALS.applyCustom) global.RBQM_SIGNALS.applyCustom(data, global.RBQM_STORE);
    document.title = opts.title + ' | ' + CFG.productName;

    splash();
    var root = document.getElementById('app');
    root.innerHTML =
      '<div class="app-shell">' +
      '<aside class="sidebar" id="sidebar">' + global.RBQM_SIDEBAR.render(opts.activeId, data) + '</aside>' +
      '<div class="app-main">' +
      '<header class="app-header" id="appHeader">' + global.RBQM_HEADER.render(opts, data) + '</header>' +
      '<main class="app-content" id="appContent">' + (opts.contentHtml || '') + '</main>' +
      '<footer class="site-footer"><small>' + CFG.footerDisclaimer + '</small></footer>' +
      '</div></div>';

    global.RBQM_HEADER.bind();
    if (global.RBQM_GLOSSARY_TIP) global.RBQM_GLOSSARY_TIP.mount(opts);

    var sidebarAsk = document.getElementById('sidebarAskAi');
    if (sidebarAsk && global.RBQM_AI_PANEL) sidebarAsk.addEventListener('click', function () { global.RBQM_AI_PANEL.open(); });

    if (opts.onMount) opts.onMount(document.getElementById('appContent'), data);
    if (global.RBQM_GLOSSARY_TIP) global.RBQM_GLOSSARY_TIP.scan();
  }

  global.RBQM_SHELL = { mount: mount };
})(window);
