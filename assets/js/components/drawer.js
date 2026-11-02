/* Drawer: side panel (right-anchored) for details, add-from-library, AI assistant panel etc. */
(function (global) {
  'use strict';
  var A11Y = global.RBQM_A11Y;

  function open(opts) {
    opts = opts || {};
    var overlay = global.document.createElement('div');
    overlay.className = 'overlay';
    var drawer = global.document.createElement('div');
    drawer.className = opts.className || 'drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.innerHTML = opts.bodyHtml || '';
    overlay.appendChild(drawer);
    global.document.body.appendChild(overlay);

    function close() { untrap(); overlay.remove(); if (opts.onClose) opts.onClose(); }
    var untrap = A11Y.trapFocus(drawer, close);
    if (!opts.disableBackdropClose) overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    if (opts.onMount) opts.onMount(drawer, close);
    return { close: close, el: drawer };
  }

  global.RBQM_DRAWER = { open: open };
})(window);
