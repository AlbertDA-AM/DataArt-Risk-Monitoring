/* Issues and CAPA: board + list views, approval workflow with e-signature, effectiveness
   check, overdue highlighting, approval inbox. Single user switches requester/approver hat. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var CAPA_ENGINE = global.RBQM_CAPA;
  var CFG = global.RBQM_CONFIG;
  var role = 'requester';

  function effective(capa) { return Object.assign({}, capa, STORE.get('capas', capa.id)); }

  function siteLabel(data, capa) { var s = data.sites.filter(function (x) { return x.id === capa.siteId; })[0]; return s ? 'Site ' + s.code + ', ' + s.country : capa.studyId; }

  function render(contentEl, data) {
    var view = 'board';

    function draw() {
      var capas = data.capas.map(effective);
      var overdueCount = capas.filter(function (c) { return CAPA_ENGINE.isOverdue(c, CFG.asOfDate); }).length;
      var approvalInbox = capas.filter(function (c) { return c.state === 'Submitted'; });

      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div><b>' + overdueCount + ' CAPAs are overdue.</b> ' + approvalInbox.length + ' are waiting for approval.</div></div>' +
        '<div style="height:10px"></div>' +
        '<div class="card-head" style="margin-bottom:8px"><div class="tabs" id="capaViewTabs" style="margin-bottom:0;border-bottom:none">' +
        '<button class="tab' + (view === 'board' ? ' active' : '') + '" data-view="board">Board</button>' +
        '<button class="tab' + (view === 'list' ? ' active' : '') + '" data-view="list">List</button>' +
        '<button class="tab' + (view === 'inbox' ? ' active' : '') + '" data-view="inbox">Approval inbox (' + approvalInbox.length + ')</button></div>' +
        '<button class="btn" id="roleToggle">Viewing as: ' + (role === 'requester' ? 'Requester' : 'Quality approver') + '</button></div>' +
        '<div id="capaBody"></div>';

      document.getElementById('capaViewTabs').querySelectorAll('.tab').forEach(function (t) { t.addEventListener('click', function () { view = t.dataset.view; draw(); }); });
      document.getElementById('roleToggle').addEventListener('click', function () { role = role === 'requester' ? 'approver' : 'requester'; draw(); });

      var body = document.getElementById('capaBody');
      if (view === 'board') body.innerHTML = boardHtml(data, capas);
      else if (view === 'list') body.innerHTML = listHtml(data, capas);
      else body.innerHTML = listHtml(data, approvalInbox, true);
      bindCardClicks(data, draw);
    }

    draw();
  }

  function boardHtml(data, capas) {
    var cols = CAPA_ENGINE.STATES;
    return '<div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:8px">' + cols.map(function (state) {
      var items = capas.filter(function (c) { return c.state === state; });
      return '<div style="min-width:220px;flex:1"><div class="muted" style="font-size:11.5px;text-transform:uppercase;margin-bottom:6px">' + state + ' (' + items.length + ')</div>' +
        items.map(function (c) {
          var overdue = CAPA_ENGINE.isOverdue(c, CFG.asOfDate);
          return '<div class="card capa-card" data-id="' + c.id + '" style="margin-bottom:8px;cursor:pointer;padding:7px 9px' + (overdue ? ';border-color:var(--c-action-fill)' : '') + '">' +
            '<b style="font-size:12.5px">' + c.id + '</b><div class="muted" style="font-size:11.5px">' + siteLabel(data, c) + '</div>' +
            (overdue ? '<span class="status-pill status-action" style="margin-top:6px">' + CAPA_ENGINE.daysOverdue(c, CFG.asOfDate) + 'd overdue</span>' : '<span class="muted" style="font-size:11px">Due ' + FMT.dateShort(c.due) + '</span>') +
            '</div>';
        }).join('') + '</div>';
    }).join('') + '</div>';
  }

  var listColumns;
  function listHtml(data, capas, inboxMode) {
    listColumns = [
      { key: 'id', label: 'CAPA', render: function (r) { return '<a href="#" class="capa-card" data-id="' + r.id + '">' + r.id + '</a>'; } },
      { key: 'site', label: 'Site', render: function (r) { return siteLabel(data, r); } },
      { key: 'state', label: 'State', render: function (r) { return r.state; } },
      { key: 'due', label: 'Due', render: function (r) {
          var overdue = CAPA_ENGINE.isOverdue(r, CFG.asOfDate);
          return (overdue ? '<span class="status-pill status-action">' + CAPA_ENGINE.daysOverdue(r, CFG.asOfDate) + 'd overdue</span>' : FMT.dateShort(r.due));
        } },
      { key: 'owner', label: 'Owner', render: function (r) { var u = data.users.filter(function (x) { return x.id === r.ownerId; })[0]; return u ? u.name : r.ownerId; } }
    ];
    if (inboxMode) listColumns.splice(3, 0, { key: 'rootCause', label: 'Root cause', render: function (r) { return r.rootCause; } });
    return '<div class="card">' + global.RBQM_TABLE.render(listColumns, capas, { emptyTitle: 'No CAPAs yet', emptyBody: 'CAPAs appear here when a signal needs a documented fix.' }) + '</div>';
  }

  function bindCardClicks(data, onChange) {
    document.querySelectorAll('.capa-card').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openCapaDetail(data, effective(data.capas.filter(function (c) { return c.id === el.dataset.id; })[0]), onChange); });
    });
  }

  function openCapaDetail(data, capa, onChange) {
    var overdue = CAPA_ENGINE.isOverdue(capa, CFG.asOfDate);
    var signatures = (capa.signatures || []).map(function (s) { return '<div style="font-size:11.5px;padding:3px 0">' + s.action + ' by ' + s.userId + ' on ' + FMT.dateShort(s.date) + '</div>'; }).join('');
    var body =
      '<h2>' + capa.id + '</h2><p class="muted">' + siteLabel(data, capa) + ' &middot; ' + capa.state + (overdue ? ' &middot; <span class="status-pill status-action">' + CAPA_ENGINE.daysOverdue(capa, CFG.asOfDate) + 'd overdue</span>' : '') + '</p>' +
      '<div class="field"><label>Root cause</label><textarea class="text-input" id="capaRootCause" rows="2">' + (capa.rootCause || '') + '</textarea></div>' +
      '<div class="field"><label>Corrective action</label><textarea class="text-input" id="capaCorrective" rows="2">' + (capa.corrective || '') + '</textarea></div>' +
      '<div class="field"><label>Preventive action</label><textarea class="text-input" id="capaPreventive" rows="2">' + (capa.preventive || '') + '</textarea></div>' +
      '<div class="field"><label>Due date</label><input class="text-input" type="date" id="capaDue" value="' + capa.due + '"></div>' +
      (capa.effectivenessResult ? '<div class="banner ' + (capa.effectivenessResult.recovered ? 'banner-ok' : 'banner-action') + '">' + capa.effectivenessResult.summary + '</div>' : '') +
      '<h3 style="font-size:11.5px;margin-top:9px">Audit trail</h3>' + (signatures || '<p class="muted" style="font-size:11px">No approvals recorded yet.</p>') +
      '<div style="margin-top:9px;display:flex;gap:8px;flex-wrap:wrap" id="capaActions"></div>';

    global.RBQM_DRAWER.open({
      bodyHtml: body,
      onMount: function (drawerEl, close) { renderActions(drawerEl, data, capa, onChange, { close: close }); }
    });
  }

  function renderActions(drawerEl, data, capa, onChange, handle) {
    var actionsEl = drawerEl.querySelector('#capaActions');
    actionsEl.innerHTML = '';
    function addBtn(label, cls, fn) {
      var b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = label;
      b.addEventListener('click', fn); actionsEl.appendChild(b);
    }
    function saveFields() {
      STORE.patch('capas', capa.id, {
        rootCause: drawerEl.querySelector('#capaRootCause').value,
        corrective: drawerEl.querySelector('#capaCorrective').value,
        preventive: drawerEl.querySelector('#capaPreventive').value,
        due: drawerEl.querySelector('#capaDue').value
      });
    }
    function transition(to, extra) {
      saveFields();
      STORE.patch('capas', capa.id, Object.assign({ state: to }, extra || {}));
      STORE.logAudit('CAPA', capa.id, null, 'State set to ' + to, capa.state, to);
      global.RBQM_TOAST.show(capa.id + ' set to ' + to.toLowerCase());
      handle.close(); onChange();
    }

    if (role === 'requester') {
      if (capa.state === 'Draft') addBtn('Submit for approval', 'btn-primary', function () { transition('Submitted'); global.RBQM_TOAST.show('CAPA ' + capa.id + ' submitted for approval'); });
      if (capa.state === 'Returned') addBtn('Resubmit', 'btn-primary', function () { transition('Submitted'); });
      if (capa.state === 'Approved') addBtn('Start work', 'btn-primary', function () { transition('In progress'); });
      if (capa.state === 'In progress') addBtn('Run effectiveness check', 'btn-primary', function () {
          var recovered = Math.random() > 0.3;
          transition('Effectiveness check', { effectivenessResult: { recovered: recovered, summary: recovered ? 'Recovered: both follow-up snapshots are within limit.' : 'Not recovered: at least one follow-up snapshot is still outside limit.' } });
        });
      if (capa.state === 'Effectiveness check') {
        addBtn('Close CAPA', 'btn-primary', function () { transition('Closed'); });
        addBtn('Reopen', 'btn-danger', function () { transition('In progress'); });
      }
    } else {
      if (capa.state === 'Submitted') {
        addBtn('Approve (e-signature)', 'btn-primary', function () {
          transition('Approved', { signatures: (capa.signatures || []).concat([{ userId: 'U-003', action: 'Approved', date: CFG.asOfDate.slice(0, 10) }]) });
        });
        addBtn('Return with comment', 'btn-danger', function () {
          global.RBQM_MODAL.open({
            title: 'Return CAPA', confirmLabel: 'Return',
            bodyHtml: '<div class="field"><label>Comment</label><textarea class="text-input" id="returnComment" rows="3"></textarea><div class="error" id="returnErr" hidden>Enter a comment before returning</div></div>',
            onConfirm: function (modalEl) {
              var val = modalEl.querySelector('#returnComment').value.trim();
              if (!val) { modalEl.querySelector('#returnErr').hidden = false; return false; }
              transition('Returned', { returnComment: val });
              return true;
            }
          });
        });
      }
    }
    addBtn('Close', '', function () { handle.close(); });
  }

  global.RBQM_PAGE_ISSUES_CAPA = { render: render };
})(window);
