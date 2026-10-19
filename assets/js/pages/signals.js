/* Signals: list with filters, quick actions, watchlist view, signal detail drawer. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;
  var KRI = global.RBQM_KRI_CATALOG;
  var SIGNALS_ENGINE = global.RBQM_SIGNALS;
  var STORE = global.RBQM_STORE;

  function effectiveStatus(sig) {
    var patch = STORE.get('signals', sig.id);
    return patch && patch.status ? patch.status : sig.status;
  }

  function siteLabel(data, sig) {
    if (sig.siteId) { var s = data.sites.filter(function (x) { return x.id === sig.siteId; })[0]; return s ? 'Site ' + s.code + ', ' + s.country : sig.siteId; }
    return sig.countryLevel ? sig.countryLevel + ' (country level)' : '–';
  }

  var columns;
  function buildColumns(data) {
    return [
      { key: 'id', label: 'Signal', sortValue: function (r) { return r.id; }, render: function (r) { return '<a href="#" class="signal-open-link" data-id="' + r.id + '">' + r.id + '</a>'; } },
      { key: 'site', label: 'Site', sortValue: function (r) { return siteLabel(data, r); }, render: function (r) { return siteLabel(data, r); } },
      { key: 'kri', label: 'Indicator', sortValue: function (r) { return r.kriCode; }, render: function (r) { var d = KRI.byCode(r.kriCode); return d ? d.name : r.kriCode; } },
      { key: 'severity', label: 'Severity', sortValue: function (r) { return r.severity; }, render: function (r) { return '<span class="status-pill status-' + (r.severity === 'action' ? 'action' : 'watch') + '">' + (r.severity === 'action' ? 'High' : 'Moderate') + '</span>'; } },
      { key: 'status', label: 'Status', sortValue: function (r) { return effectiveStatus(r); }, render: function (r) { return effectiveStatus(r); } },
      { key: 'owner', label: 'Owner', sortValue: function (r) { var o = STORE.get('signals', r.id); var id = o && o.ownerId !== undefined ? o.ownerId : r.ownerId; return id || ''; }, render: function (r) {
          var o = STORE.get('signals', r.id); var id = o && o.ownerId !== undefined ? o.ownerId : r.ownerId;
          if (!id) return '<span class="muted">Unassigned</span>';
          var u = data.users.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id;
        } },
      { key: 'created', label: 'Created', sortValue: function (r) { return r.created; }, render: function (r) { return FMT.dateShort(r.created); } },
      { key: 'actions', label: '', sortable: false, render: function (r) { return '<button class="btn btn-sm signal-quick-btn" data-id="' + r.id + '">Quick action</button>'; } }
    ];
  }

  function applyFilters(data, signals, filters) {
    return signals.filter(function (sig) {
      var st = effectiveStatus(sig);
      if (filters.view === 'watchlist' && st !== 'Watch') return false;
      if (filters.status && filters.status !== 'all' && st !== filters.status) return false;
      if (filters.severity && filters.severity !== 'all' && sig.severity !== filters.severity) return false;
      if (filters.kri && filters.kri !== 'all' && sig.kriCode !== filters.kri) return false;
      if (filters.search) {
        var q = filters.search.toLowerCase();
        if ((sig.id + ' ' + siteLabel(data, sig) + ' ' + sig.description).toLowerCase().indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function render(contentEl, data) {
    columns = buildColumns(data);
    var filters = { view: 'all', status: 'all', severity: 'all', kri: 'all', search: '' };
    var openSignals = data.signals.filter(function (s) { return SIGNALS_ENGINE.isOpen(effectiveStatus(s)); });
    var newCount = data.signals.filter(function (s) { return effectiveStatus(s) === 'New'; }).length;

    function draw() {
      var focus = global.RBQM_A11Y.captureFocus('sigSearch');
      var rows = data.signals.filter(function (s) { return filters.view === 'watchlist' ? true : SIGNALS_ENGINE.isOpen(effectiveStatus(s)) || filters.status !== 'all'; });
      var filtered = applyFilters(data, rows, filters);
      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div><b>' + openSignals.length + ' signals are open.</b> ' + newCount + ' are new.</div></div>' +
        '<div style="height:10px"></div><div class="card">' +
        '<div class="tabs" id="signalsTabs"><button class="tab' + (filters.view === 'all' ? ' active' : '') + '" data-view="all">All signals</button>' +
        '<button class="tab' + (filters.view === 'watchlist' ? ' active' : '') + '" data-view="watchlist">Watchlist</button></div>' +
        '<div class="table-toolbar"><input class="search-input" id="sigSearch" placeholder="Search signals" value="' + filters.search + '">' +
        '<select class="select-input" id="statusFilter"><option value="all">All statuses</option>' + SIGNALS_ENGINE.SIGNAL_STATES.map(function (s) { return '<option value="' + s + '"' + (filters.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<select class="select-input" id="severityFilter"><option value="all">All severities</option><option value="action">High</option><option value="watch">Moderate</option></select>' +
        '<select class="select-input" id="kriFilter"><option value="all">All indicators</option>' + KRI.KRIS.filter(function (k) { return k.active; }).map(function (k) { return '<option value="' + k.code + '">' + k.name + '</option>'; }).join('') + '</select>' +
        '<div class="spacer"></div><button class="btn" id="sigExportBtn">Export CSV</button></div>' +
        '<div id="signalsTableWrap">' + global.RBQM_TABLE.render(columns, filtered) + '</div></div>';

      document.getElementById('signalsTabs').querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { filters.view = t.dataset.view; draw(); }); });
      document.getElementById('sigSearch').addEventListener('input', function (e) { filters.search = e.target.value; draw(); });
      document.getElementById('statusFilter').value = filters.status;
      document.getElementById('statusFilter').addEventListener('change', function (e) { filters.status = e.target.value; draw(); });
      document.getElementById('severityFilter').addEventListener('change', function (e) { filters.severity = e.target.value; draw(); });
      document.getElementById('kriFilter').addEventListener('change', function (e) { filters.kri = e.target.value; draw(); });
      document.getElementById('sigExportBtn').addEventListener('click', function () { global.RBQM_TABLE.downloadCsv('signals.csv', columns, filtered); global.RBQM_TOAST.show('Export ready: signals.csv'); });

      var wrap = document.getElementById('signalsTableWrap');
      global.RBQM_TABLE.bindSort(wrap, filtered, columns, function (sorted) { wrap.innerHTML = global.RBQM_TABLE.render(columns, sorted); bindRowActions(); });
      bindRowActions();
      global.RBQM_A11Y.restoreFocus(focus);

      function bindRowActions() {
        document.querySelectorAll('.signal-open-link').forEach(function (a) {
          a.addEventListener('click', function (e) { e.preventDefault(); openDetail(data.signals.filter(function (s) { return s.id === a.dataset.id; })[0]); });
        });
        document.querySelectorAll('.signal-quick-btn').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            openQuickActionMenu(btn, data.signals.filter(function (s) { return s.id === btn.dataset.id; })[0], draw);
          });
        });
      }
    }

    function openDetail(sig) { openSignalDetail(data, sig, draw); }

    draw();
  }

  function openQuickActionMenu(anchorEl, sig, onDone) {
    var rect = anchorEl.getBoundingClientRect();
    var menu = document.createElement('div');
    menu.className = 'card';
    menu.style.cssText = 'position:fixed;z-index:60;padding:6px;min-width:170px;top:' + (rect.bottom + 4) + 'px;left:' + Math.max(8, rect.right - 180) + 'px';
    ['Add to watchlist', 'Assign owner', 'Dismiss', 'Create CAPA'].forEach(function (label) {
      var b = document.createElement('button');
      b.className = 'btn btn-ghost'; b.style.cssText = 'display:block;width:100%;text-align:left'; b.textContent = label;
      b.addEventListener('click', function () { document.body.removeChild(menu); runQuickAction(label, sig, onDone); });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    setTimeout(function () {
      function away(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', away); } }
      document.addEventListener('click', away);
    }, 0);
  }

  function runQuickAction(label, sig, onDone) {
    var STORE2 = global.RBQM_STORE;
    if (label === 'Add to watchlist') {
      STORE2.patch('signals', sig.id, { status: 'Watch' });
      STORE2.logAudit('Signal', sig.id, null, 'Added to watchlist');
      global.RBQM_TOAST.show('Signal added to the watchlist');
      onDone();
    } else if (label === 'Assign owner') {
      global.RBQM_MODAL.open({
        title: 'Assign owner', bodyHtml: '<div class="field"><label>Owner</label><select class="select-input" id="qOwner">' +
          global.RBQM_DATA.users.map(function (u) { return '<option value="' + u.id + '">' + u.name + '</option>'; }).join('') + '</select></div>',
        onConfirm: function (modalEl) {
          var sel = modalEl.querySelector('#qOwner');
          STORE2.patch('signals', sig.id, { ownerId: sel.value });
          STORE2.logAudit('Signal', sig.id, null, 'Assigned to ' + sel.selectedOptions[0].textContent);
          global.RBQM_TOAST.show('Signal assigned to ' + sel.selectedOptions[0].textContent);
          onDone(); return true;
        }
      });
    } else if (label === 'Dismiss') {
      global.RBQM_MODAL.open({
        title: 'Dismiss signal', confirmLabel: 'Dismiss',
        bodyHtml: '<div class="field"><label>Reason</label><textarea class="text-input" id="qReason" rows="3"></textarea><div class="error" id="qErr" hidden>Enter a reason before dismissing</div></div>',
        onConfirm: function (modalEl) {
          var val = modalEl.querySelector('#qReason').value.trim();
          if (!val) { modalEl.querySelector('#qErr').hidden = false; return false; }
          STORE2.patch('signals', sig.id, { status: 'Dismissed', dismissReason: val });
          STORE2.logAudit('Signal', sig.id, null, 'Dismissed: ' + val);
          global.RBQM_TOAST.show('Signal dismissed');
          onDone(); return true;
        }
      });
    } else if (label === 'Create CAPA') {
      global.RBQM_MODAL.open({
        title: 'Create CAPA', subtitle: sig.id,
        bodyHtml: '<div class="field"><label>Owner</label><select class="select-input"><option>A. Novak, central monitoring lead</option></select></div>' +
          '<div class="field"><label>Due date</label><input class="text-input" type="date" value="' + global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.addDays(global.RBQM_GENERATOR.ASOF, 30)) + '"></div>',
        onConfirm: function () {
          STORE2.patch('signals', sig.id, { status: 'Action planned' });
          STORE2.logAudit('CAPA', 'CAPA-NEW-' + Date.now(), null, 'Created from ' + sig.id);
          global.RBQM_TOAST.show('CAPA ' + ('CAPA-2026-0' + Math.floor(Math.random() * 90 + 10)) + ' submitted for approval');
          onDone(); return true;
        }
      });
    }
  }

  function openSignalDetail(data, sig, onChange) {
    var site = sig.siteId ? data.sites.filter(function (s) { return s.id === sig.siteId; })[0] : null;
    global.RBQM_DRAWER.open({
      bodyHtml:
        '<h2>' + sig.id + '</h2><p class="muted">' + siteLabel(data, sig) + ' &middot; ' + (KRI.byCode(sig.kriCode) ? KRI.byCode(sig.kriCode).name : sig.kriCode) + '</p>' +
        '<span class="status-pill status-' + (sig.severity === 'action' ? 'action' : 'watch') + '">' + effectiveStatus(sig) + '</span>' +
        '<hr class="divider"><p>' + sig.description + '</p>' +
        (sig.history && sig.history.length ? '<h3 style="font-size:12px">History</h3>' + sig.history.map(function (h) { return '<div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--c-border)">' + FMT.dateShort(h.date) + ' - ' + h.note + '</div>'; }).join('') : '') +
        '<div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap">' +
        (site ? '<a class="btn" href="kri-detail.html?kri=' + sig.kriCode + '&site=' + site.id + '">View linked chart</a>' : '') +
        '<button class="btn btn-primary" id="drawerCreateCapa">Create CAPA</button>' +
        '<button class="btn btn-danger" id="drawerDismiss">Dismiss</button>' +
        '</div>',
      onMount: function (drawerEl) {
        drawerEl.querySelector('#drawerCreateCapa').addEventListener('click', function () { runQuickAction('Create CAPA', sig, onChange); });
        drawerEl.querySelector('#drawerDismiss').addEventListener('click', function () { runQuickAction('Dismiss', sig, onChange); });
      }
    });
  }

  global.RBQM_PAGE_SIGNALS = { render: render };
})(window);
