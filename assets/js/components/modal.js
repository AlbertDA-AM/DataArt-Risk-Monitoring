/* Modal: confirmation cards (create CAPA, dismiss with reason, etc). Centered overlay. */
(function (global) {
  'use strict';
  var A11Y = global.RBQM_A11Y;

  function open(opts) {
    opts = opts || {};
    var overlay = global.document.createElement('div');
    overlay.className = 'overlay center';
    var modal = global.document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="modal-title">' + (opts.title || '') + '</div>' +
      (opts.subtitle ? '<p class="muted">' + opts.subtitle + '</p>' : '') +
      '<div class="modal-body">' + (opts.bodyHtml || '') + '</div>' +
      '<div class="modal-actions">' +
      (opts.cancelLabel !== false ? '<button class="btn" data-action="cancel">' + (opts.cancelLabel || 'Cancel') + '</button>' : '') +
      '<button class="btn btn-primary" data-action="confirm">' + (opts.confirmLabel || 'Confirm') + '</button>' +
      '</div>';
    overlay.appendChild(modal);
    global.document.body.appendChild(overlay);

    function close() { untrap(); overlay.remove(); }
    var untrap = A11Y.trapFocus(modal, close);

    modal.querySelector('[data-action="cancel"]') && modal.querySelector('[data-action="cancel"]').addEventListener('click', function () {
      if (opts.onCancel) opts.onCancel();
      close();
    });
    modal.querySelector('[data-action="confirm"]').addEventListener('click', function () {
      var ok = opts.onConfirm ? opts.onConfirm(modal) : true;
      if (ok !== false) close();
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    return { close: close, el: modal };
  }

  global.RBQM_MODAL = { open: open };
})(window);
