/* App shell: mounts sidebar + header + footer around a page's content, wires global
   behaviors (reset demo data, Ask AI panel). Every page calls RBQM_SHELL.mount once. */
(function (global) {
  'use strict';
  var CFG = global.RBQM_CONFIG;

  function mount(opts) {
    var data = global.RBQM_DATA;
    document.title = opts.title + ' | ' + CFG.productName;

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

    var sidebarAsk = document.getElementById('sidebarAskAi');
    if (sidebarAsk && global.RBQM_AI_PANEL) sidebarAsk.addEventListener('click', function () { global.RBQM_AI_PANEL.open(); });

    if (opts.onMount) opts.onMount(document.getElementById('appContent'), data);
  }

  global.RBQM_SHELL = { mount: mount };
})(window);
