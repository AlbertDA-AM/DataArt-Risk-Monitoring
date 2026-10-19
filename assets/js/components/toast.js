/* Toast: brief confirmation after an action (spec section 2, microcopy confirmations). */
(function (global) {
  'use strict';
  var stackEl = null;

  function ensureStack() {
    if (stackEl) return stackEl;
    stackEl = global.document.createElement('div');
    stackEl.className = 'toast-stack';
    stackEl.setAttribute('role', 'status');
    stackEl.setAttribute('aria-live', 'polite');
    global.document.body.appendChild(stackEl);
    return stackEl;
  }

  function show(message, durationMs) {
    var stack = ensureStack();
    var el = global.document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(function () { el.remove(); }, durationMs || 3200);
  }

  global.RBQM_TOAST = { show: show };
})(window);
