/* Accessibility helpers: focus trap for drawers/modals, escape-to-close, toast announcer. */
(function (global) {
  'use strict';

  function trapFocus(container, onEscape) {
    var focusables = container.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusables.length) focusables[0].focus();
    function handler(e) {
      if (e.key === 'Escape' && onEscape) { onEscape(); return; }
      if (e.key !== 'Tab' || !focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && global.document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && global.document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    container.addEventListener('keydown', handler);
    return function () { container.removeEventListener('keydown', handler); };
  }

  /** For pages that re-render their whole panel on every keystroke in a live-filter input
      (search boxes etc): call captureFocus(id) before re-rendering, restoreFocus(saved)
      after, so the input keeps focus and cursor position instead of dropping keystrokes. */
  function captureFocus(id) {
    var el = global.document.getElementById(id);
    if (!el || el !== global.document.activeElement) return null;
    return { id: id, caret: el.selectionStart };
  }
  function restoreFocus(saved) {
    if (!saved) return;
    var el = global.document.getElementById(saved.id);
    if (!el) return;
    el.focus();
    try { el.setSelectionRange(saved.caret, saved.caret); } catch (e) { /* not a text input */ }
  }

  var liveRegion = null;
  function announce(message) {
    if (!liveRegion) {
      liveRegion = global.document.createElement('div');
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.className = 'sr-only';
      global.document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = message;
  }

  global.RBQM_A11Y = { trapFocus: trapFocus, announce: announce, captureFocus: captureFocus, restoreFocus: restoreFocus };
})(window);
