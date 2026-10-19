/* AI assistant side panel. No live LLM: delegates matching to engine/assistant.js, renders
   the conversation, and executes confirmed actions through the same store/audit path every
   other page uses. Opens from the header "Ask AI" button or the sidebar footer shortcut. */
(function (global) {
  'use strict';
  var STORE = global.RBQM_STORE;
  var A11Y = global.RBQM_A11Y;
  var ctx = {};
  var history = [];
  var panelEl = null;

  var TRY_ASKING = [
    'What changed since the last snapshot?', 'Which sites are most at risk?', 'Why is Site 114 flagged?',
    'Create a CAPA for it', 'Which KRIs will breach in 60 days?', 'What if Site 114 closes?',
    'Compare Poland and Germany on data entry', 'Which CRO is slowest on queries?',
    'Which sites can skip an on-site visit?', 'Are we inspection-ready?', 'Draft the executive brief',
    'What is a funnel plot?'
  ];

  function open() {
    if (panelEl) return;
    var data = global.RBQM_DATA;
    var overlay = global.document.createElement('div');
    overlay.className = 'overlay';
    overlay.id = 'aiOverlay';
    var panel = global.document.createElement('div');
    panel.className = 'ai-panel';
    panel.innerHTML =
      '<div class="ai-panel-header"><span class="sparkle" style="font-weight:700">Ask AI</span>' +
      '<span class="ai-panel-context">' + (global.document.title.split('|')[0].trim()) + '</span>' +
      '<div style="flex:1"></div>' +
      '<button class="btn btn-sm" id="aiNewChat">New chat</button>' +
      '<button class="icon-btn" id="aiClose" aria-label="Close">&times;</button></div>' +
      '<div class="ai-panel-body" id="aiBody"></div>' +
      '<div class="ai-panel-footer">' +
      '<div class="ai-chip-row" id="aiTryAsking" style="margin-bottom:8px">' +
      TRY_ASKING.slice(0, 6).map(function (q) { return '<button class="ai-chip" data-chip="' + q.replace(/"/g, '&quot;') + '">' + q + '</button>'; }).join('') +
      '</div><div class="ai-input-row">' +
      '<input class="text-input" id="aiInput" placeholder="Ask about your data">' +
      '<button class="btn btn-primary" id="aiSend">Send</button></div>' +
      '<div class="ai-footnote">AI-assisted. Runs on synthetic data. Actions need your confirmation.</div></div>';
    overlay.appendChild(panel);
    global.document.body.appendChild(overlay);
    panelEl = overlay;

    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    panel.querySelector('#aiClose').addEventListener('click', close);
    panel.querySelector('#aiNewChat').addEventListener('click', function () { history = []; ctx = {}; renderBody(data); });
    panel.querySelector('#aiSend').addEventListener('click', function () { send(data); });
    panel.querySelector('#aiInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') send(data); });
    panel.querySelectorAll('#aiTryAsking .ai-chip').forEach(function (c) {
      c.addEventListener('click', function () { panel.querySelector('#aiInput').value = c.dataset.chip; send(data); });
    });

    if (!history.length) pushMorningBriefing(data);
    renderBody(data);
    global.document.addEventListener('keydown', escHandler);
    panel.querySelector('#aiInput').focus();
  }

  function escHandler(e) { if (e.key === 'Escape') close(); }

  function close() {
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
    global.document.removeEventListener('keydown', escHandler);
  }

  function pushMorningBriefing(data) {
    var result = global.RBQM_ASSISTANT.ask('morning briefing', ctx, data, STORE);
    history.push({ role: 'assistant', response: result.response, id: 'm0' });
  }

  function send(data) {
    var input = panelEl.querySelector('#aiInput');
    var text = input.value.trim();
    if (!text) return;
    history.push({ role: 'user', text: text });
    var result = global.RBQM_ASSISTANT.ask(text, ctx, data, STORE);
    result.response.rawText = text;
    history.push({ role: 'assistant', response: result.response, id: 'r' + history.length });
    input.value = '';
    renderBody(data);
  }

  function renderBody(data) {
    var body = panelEl.querySelector('#aiBody');
    body.innerHTML = history.map(function (h) {
      if (h.role === 'user') return '<div class="ai-msg user">' + escapeHtml(h.text) + '</div>';
      return '<div class="ai-msg assistant">' + renderAssistantCard(h.response, h.id) + '</div>';
    }).join('');
    body.scrollTop = body.scrollHeight;
    bindCardActions(data);
  }

  function renderAssistantCard(r, id) {
    var chips = (r.followUps || []).map(function (f) { return '<button class="ai-chip" data-chip="' + escapeHtml(f) + '">' + escapeHtml(f) + '</button>'; }).join('');
    var actions = (r.actions || []).map(function (a, i) { return '<button class="btn btn-sm ai-action-btn" data-msg="' + id + '" data-idx="' + i + '">' + a.label + '</button>'; }).join('');
    return '<div class="ai-card">' +
      '<span class="ai-label"><span aria-hidden="true">&#10022;</span> AI-assisted</span>' +
      '<div>' + escapeHtml(r.text) + '</div>' +
      (r.basedOn ? '<div class="ai-based-on">' + escapeHtml(r.basedOn) + (r.viewHref ? ' <a href="' + r.viewHref + '">View data</a>' : '') + '</div>' : (r.viewHref ? '<div class="ai-based-on"><a href="' + r.viewHref + '">View data</a></div>' : '')) +
      (actions ? '<div class="ai-chip-row">' + actions + '</div>' : '') +
      (chips ? '<div class="ai-chip-row">' + chips + '</div>' : '') +
      '<div class="ai-feedback"><button data-fb="up" data-msg="' + id + '">Helpful</button><button data-fb="down" data-msg="' + id + '">Not helpful</button><button data-fb="pin" data-msg="' + id + '">Pin</button></div>' +
      '</div>';
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function bindCardActions(data) {
    panelEl.querySelectorAll('#aiBody .ai-chip[data-chip]').forEach(function (c) {
      c.addEventListener('click', function () { panelEl.querySelector('#aiInput').value = c.dataset.chip; send(data); });
    });
    panelEl.querySelectorAll('.ai-feedback button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.fb === 'pin') { global.RBQM_TOAST.show('Pinned to dashboard'); STORE.logAudit('AIAnswer', b.dataset.msg, null, 'Pinned'); }
        else { global.RBQM_TOAST.show('Thanks for the feedback'); STORE.logAudit('AIAnswer', b.dataset.msg, null, b.dataset.fb === 'up' ? 'Marked helpful' : 'Marked not helpful'); }
      });
    });
    panelEl.querySelectorAll('.ai-action-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var msg = history.filter(function (h) { return h.id === b.dataset.msg; })[0];
        var action = msg.response.actions[Number(b.dataset.idx)];
        runAction(action, data);
      });
    });
  }

  function runAction(action, data) {
    if (action.id === 'open_page') { global.location.href = action.href; return; }
    if (action.id === 'copy') { global.RBQM_TOAST.show('Copied as text'); return; }
    if (action.id === 'add_to_report') {
      STORE.push('reportItems', { id: 'RPT-' + Date.now(), title: 'AI summary', date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF), body: 'Saved from the AI assistant.' });
      global.RBQM_TOAST.show('Added to report'); return;
    }
    if (action.id === 'save_scenario') { global.RBQM_TOAST.show('Scenario saved'); return; }
    if (action.id === 'open_signal' && action.site) { global.location.href = 'site-profile.html?site=' + action.site.id; return; }

    if (action.id === 'create_capa') {
      global.RBQM_MODAL.open({
        title: 'Create CAPA', subtitle: action.site ? 'Site ' + action.site.code : '',
        bodyHtml: '<div class="field"><label>Owner</label><select class="select-input"><option>A. Novak, central monitoring lead</option></select></div>' +
          '<div class="field"><label>Due date</label><input class="text-input" type="date" value="' + global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.addDays(global.RBQM_GENERATOR.ASOF, 30)) + '"></div>',
        onConfirm: function () {
          STORE.logAudit('CAPA', 'CAPA-NEW-' + Date.now(), null, 'Created from AI assistant');
          global.RBQM_TOAST.show('CAPA submitted for approval');
          return true;
        }
      });
    } else if (action.id === 'assign_owner') {
      global.RBQM_MODAL.open({
        title: 'Assign owner', bodyHtml: '<div class="field"><label>Owner</label><select class="select-input" id="aiOwner">' + data.users.map(function (u) { return '<option value="' + u.id + '">' + u.name + '</option>'; }).join('') + '</select></div>',
        onConfirm: function (modalEl) {
          var name = modalEl.querySelector('#aiOwner').selectedOptions[0].textContent;
          if (action.signal) STORE.patch('signals', action.signal.id, { ownerId: modalEl.querySelector('#aiOwner').value });
          STORE.logAudit('Signal', action.signal ? action.signal.id : 'signal', null, 'Assigned to ' + name);
          global.RBQM_TOAST.show('Signal assigned to ' + name);
          return true;
        }
      });
    } else if (action.id === 'watchlist_add') {
      if (action.site) {
        var sigsForSite = data.signals.filter(function (s) { return s.siteId === action.site.id; });
        if (sigsForSite[0]) STORE.patch('signals', sigsForSite[0].id, { status: 'Watch' });
      }
      STORE.logAudit('Site', action.site ? action.site.id : 'site', null, 'Added to watchlist');
      global.RBQM_TOAST.show('Added to the watchlist');
    } else if (action.id === 'dismiss_signal') {
      global.RBQM_MODAL.open({
        title: 'Dismiss signal', confirmLabel: 'Dismiss',
        bodyHtml: '<div class="field"><label>Reason</label><textarea class="text-input" id="aiReason" rows="3"></textarea><div class="error" id="aiErr" hidden>Enter a reason before dismissing</div></div>',
        onConfirm: function (modalEl) {
          var val = modalEl.querySelector('#aiReason').value.trim();
          if (!val) { modalEl.querySelector('#aiErr').hidden = false; return false; }
          if (action.signal) STORE.patch('signals', action.signal.id, { status: 'Dismissed', dismissReason: val });
          STORE.logAudit('Signal', action.signal ? action.signal.id : 'signal', null, 'Dismissed: ' + val);
          global.RBQM_TOAST.show('Signal dismissed');
          return true;
        }
      });
    } else if (action.id === 'raise_edc_queries') {
      STORE.logAudit('Site', action.site ? action.site.id : 'site', null, 'Queries raised in EDC (simulated)');
      global.RBQM_TOAST.show('Queries raised in EDC (simulated)');
    } else if (action.id === 'schedule_visit') {
      STORE.logAudit('Site', action.site ? action.site.id : 'site', null, 'Targeted visit scheduled (simulated)');
      global.RBQM_TOAST.show('Visit scheduled (simulated)');
    } else if (action.id === 'toggle_kri') {
      STORE.patch('kriThresholds', action.kri.code, { active: !action.kri.active });
      STORE.logAudit('KRIDefinition', action.kri.code, null, 'Toggled active');
      global.RBQM_TOAST.show((action.kri.active ? 'Deactivated ' : 'Activated ') + action.kri.name);
    }
  }

  /** Try-asking chips + proactive nudge, for use outside the panel (e.g. sidebar). */
  function tryAsking() { return TRY_ASKING; }

  global.RBQM_AI_PANEL = { open: open, close: close, tryAsking: tryAsking };
})(window);
