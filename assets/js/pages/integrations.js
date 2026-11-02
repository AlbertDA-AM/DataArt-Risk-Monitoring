/* Integrations: source cards with status/last sync/record count, Sync now (simulated),
   simulated push actions logged to the audit trail. Illustrative, no live connections. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var G = global.RBQM_GENERATOR;

  function effective(src) { return Object.assign({}, src, STORE.get('notes', 'sync-' + src.id)); }

  function render(contentEl, data) {
    draw();

    function draw() {
      var sources = data.integrations.map(effective);
      contentEl.innerHTML =
        '<div class="banner banner-ai"><span aria-hidden="true">&#10022;</span><div>Illustrative. No live connections.</div></div>' +
        '<div style="height:10px"></div><div class="grid grid-3">' + sources.map(sourceCard).join('') + '</div>';

      document.querySelectorAll('.sync-now-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          STORE.patch('notes', 'sync-' + b.dataset.id, { lastSync: G.iso(G.ASOF) });
          STORE.logAudit('IntegrationSource', b.dataset.id, null, 'Synced now (simulated)');
          var src = sources.filter(function (s) { return s.id === b.dataset.id; })[0];
          global.RBQM_TOAST.show(src.name + ' synced. Data as of ' + CFG_DISPLAY());
          draw();
        });
      });
      document.querySelectorAll('.push-action-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var src = sources.filter(function (s) { return s.id === b.dataset.id; })[0];
          var action = b.dataset.action;
          STORE.logAudit('IntegrationSource', src.id, null, action + ' (simulated)');
          global.RBQM_TOAST.show(action + ' (simulated)');
        });
      });
    }

    function CFG_DISPLAY() { return global.RBQM_CONFIG.asOfDateDisplay; }

    function sourceCard(src) {
      var pushAction = src.type === 'EDC' ? 'Raise query in EDC' : src.type === 'CTMS' ? 'Create CTMS task' : src.type === 'eTMF' ? 'File to eTMF' : null;
      return '<div class="card"><div class="card-head"><div><b>' + src.name + '</b><div class="muted" style="font-size:10.5px">' + src.type + '</div></div>' +
        '<span class="status-pill status-ok">' + src.status + '</span></div>' +
        '<p class="muted" style="font-size:11px">Last sync: ' + FMT.dateShort(src.lastSync) + ' &middot; ' + FMT.int(src.recordCount) + ' records</p>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-sm sync-now-btn" data-id="' + src.id + '">Sync now</button>' +
        (pushAction ? '<button class="btn btn-sm push-action-btn" data-id="' + src.id + '" data-action="' + pushAction + '">' + pushAction + '</button>' : '') +
        '</div></div>';
    }
  }

  global.RBQM_PAGE_INTEGRATIONS = { render: render };
})(window);
