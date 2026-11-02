/* Risk model + Risk detail drawer (Addendum v0.5, item 1). One shared place for the effective risk list
   (seed + user edits + derived score and status), mitigations and the right-hand detail drawer, used by the
   Risk register, Studies bubble maps and the assistant. Edits persist in the overlay (risks and notes sections);
   Reset demo data restores the seed. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;
  var SC = global.RBQM_SCORING;
  var USER = 'U-001';
  var LEVELS = [1, 2, 3, 4, 5];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function today() { return global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF); }
  function userName(data, id) { var u = data.users.filter(function (x) { return x.id === id; })[0]; return u ? u.name : id; }

  // ---- Settings (include detectability: off by default) ----
  function settings() { return Object.assign({ includeDetectability: false }, STORE.get('notes', 'risk-settings')); }
  function setIncludeDetectability(on) {
    STORE.patch('notes', 'risk-settings', { includeDetectability: !!on });
    STORE.logAudit('Setting', 'risk-settings', USER, 'Include detectability ' + (on ? 'on' : 'off'));
  }

  // ---- Mitigations ----
  function allMitigations(data, riskId) {
    var ov = STORE.get('notes') || {};
    var seed = data.riskDetail.mitigations.map(function (m) { return Object.assign({}, m, ov['mit-' + m.id]); });
    var custom = Object.keys(ov).filter(function (k) { return k.indexOf('mitnew-') === 0; }).map(function (k) { return ov[k]; });
    return seed.concat(custom).filter(function (m) { return !m.deleted && (!riskId || m.riskId === riskId); });
  }
  function nextMitId(data) {
    var ov = STORE.get('notes') || {}, max = 0;
    data.riskDetail.mitigations.forEach(function (m) { max = Math.max(max, parseInt(m.id.slice(4), 10)); });
    Object.keys(ov).forEach(function (k) { if (k.indexOf('mitnew-') === 0) max = Math.max(max, parseInt(ov[k].id.slice(4), 10)); });
    return 'MIT-' + String(max + 1).padStart(3, '0');
  }
  function saveMitigation(data, m, isNew) {
    var now = { by: USER, date: today() };
    if (isNew) {
      m.id = nextMitId(data); m.created = now; m.updated = now; m.custom = true;
      STORE.patch('notes', 'mitnew-' + m.id, m);
      STORE.logAudit('Mitigation', m.id, USER, 'Mitigation added to ' + m.riskId);
    } else {
      var key = m.custom ? 'mitnew-' + m.id : 'mit-' + m.id;
      STORE.patch('notes', key, Object.assign({}, m, { updated: now }));
      STORE.logAudit('Mitigation', m.id, USER, 'Mitigation updated (' + m.status + ')');
    }
  }
  function deleteMitigation(m) {
    STORE.patch('notes', (m.custom ? 'mitnew-' : 'mit-') + m.id, { deleted: true });
    STORE.logAudit('Mitigation', m.id, USER, 'Mitigation deleted');
  }

  // ---- Risks ----
  function category(data, ctqId) {
    var c = data.ctqFactors.filter(function (x) { return x.id === ctqId; })[0];
    return c ? c.name : 'Not linked to a CtQ factor';
  }
  function linksFor(data, r) {
    if (r.links) return r.links;
    var seeded = data.riskDetail.links.filter(function (l) { return l.riskId === r.id; });
    if (seeded.length) return seeded.map(function (l) { return { kriCode: l.kriCode, likelihoodPct: l.likelihoodPct }; });
    return (r.kriCodes || []).map(function (c) { return { kriCode: c, likelihoodPct: 60 }; });
  }
  function build(data, r) {
    var out = Object.assign({}, r, STORE.get('risks', r.id));
    out.statement = Object.assign({ event: '', driver: '', consequence: '' }, data.riskDetail.statements[r.id], out.statement);
    out.links = linksFor(data, out);
    out.undetectedPct = out.undetectedPct != null ? out.undetectedPct : (data.riskDetail.undetected[r.id] != null ? data.riskDetail.undetected[r.id] : 30);
    out.coverage = SC.detectionCoverage(out.links, out.undetectedPct);
    out.score = SC.riskScore(out.probability, out.impact, out.detectability, settings().includeDetectability);
    out.band = SC.riskBand(out.score);
    out.category = category(data, out.ctqId);
    out.mitigations = allMitigations(data, out.id);
    out.status = (out.mitigations.length || !out.custom) ? SC.deriveRiskStatus(out.mitigations) : out.status;
    out.name = out.description;
    return out;
  }
  function risks(data) {
    var ov = STORE.get('risks') || {};
    var custom = Object.keys(ov).filter(function (k) { return ov[k].custom; }).map(function (k) { return ov[k]; });
    return data.risks.concat(custom).map(function (r) { return build(data, r); });
  }
  function composeStatement(s) {
    return 'If ' + (s.event || '...') + ' occurs due to ' + (s.driver || '...') + ', then ' + (s.consequence || '...') + ' may result.';
  }

  // ---- Drawer ----
  var ROLE_BY_CTQ = { ctq_safety: 'Safety lead', ctq_data: 'Study manager', ctq_endpoint: 'CRAs', ctq_compliance: 'Quality', ctq_rights: 'Quality' };

  function openDetail(data, riskId, onChange) {
    var risk = risks(data).filter(function (r) { return r.id === riskId; })[0];
    if (!risk) return;
    var w = { statement: Object.assign({}, risk.statement), probability: risk.probability, impact: risk.impact, detectability: risk.detectability,
      links: risk.links.map(function (l) { return Object.assign({}, l); }), undetectedPct: risk.undetectedPct };
    var handle;

    function scoreNow() { return SC.riskScore(w.probability, w.impact, w.detectability, settings().includeDetectability); }
    function sel(id, val) { return '<select class="select-input" id="' + id + '" style="width:64px">' + LEVELS.map(function (n) { return '<option' + (n === val ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>'; }

    function mitRows() {
      var list = allMitigations(data, risk.id);
      if (!list.length) return '<p class="muted" style="font-size:11px">No mitigations. This risk is accepted.</p>';
      return list.map(function (m) {
        return '<div class="mit-item" data-mit="' + m.id + '"><div class="card-head"><div><b>' + m.id + '</b> ' + esc(m.title) +
          '</div><span class="status-pill ' + (m.status === 'Active' ? 'status-ok' : m.status === 'Draft' ? 'status-watch' : 'status-insufficient') + '">' + m.status + '</span></div>' +
          '<div class="muted" style="font-size:10.5px">' + esc(userName(data, m.ownerId)) + ' &middot; ' + esc(m.role) + ' &middot; ' + esc(m.schedule) + '</div>' +
          '<div style="font-size:11px">Goal: ' + esc(m.goal) + '</div>' +
          '<div class="muted" style="font-size:10px">Created ' + esc(userName(data, m.created.by)) + ', ' + FMT.dateShort(m.created.date) + '. Updated ' + esc(userName(data, m.updated.by)) + ', ' + FMT.dateShort(m.updated.date) + '.</div>' +
          '<div class="mit-actions"><button class="btn btn-sm" data-edit="' + m.id + '">Edit</button><button class="btn btn-sm" data-toggle="' + m.id + '">' + (m.status === 'Active' ? 'Deactivate' : 'Activate') + '</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + m.id + '">Delete</button></div></div>';
      }).join('');
    }

    function linkRows() {
      var rows = w.links.map(function (l, i) {
        var k = KRI.byCode(l.kriCode);
        return '<tr><td>' + (k ? esc(k.name) : esc(l.kriCode)) + (k && !k.active ? ' <span class="status-pill status-inactive">Inactive</span>' : '') + '</td>' +
          '<td><input class="text-input link-pct" data-i="' + i + '" type="number" min="0" max="100" value="' + l.likelihoodPct + '" style="width:64px"> %</td>' +
          '<td><button class="btn btn-sm" data-rm="' + i + '">Remove</button></td></tr>';
      }).join('');
      var free = KRI.KRIS.filter(function (k) { return !w.links.some(function (l) { return l.kriCode === k.code; }); });
      return '<table class="calc-table"><thead><tr><th class="no-sort" data-term="Likelihood if the indicator fires" style="text-align:left">Indicator</th><th class="no-sort" style="text-align:left">Likelihood if it fires</th><th></th></tr></thead><tbody>' + rows +
        '<tr><td>Likelihood this risk is present and not detected by any associated indicator</td><td><input class="text-input" id="undetPct" type="number" min="0" max="100" value="' + w.undetectedPct + '" style="width:64px"> %</td><td></td></tr></tbody></table>' +
        '<div class="calc-result" style="margin-top:6px"><span data-term="Detection coverage">Detection coverage</span><span class="calc-result-value" id="covOut">' + SC.detectionCoverage(w.links, w.undetectedPct) + '%</span></div>' +
        '<div style="display:flex;gap:6px;margin-top:6px"><select class="select-input" id="addLinkSel" style="flex:1"><option value="">Add associated indicator</option>' +
        free.map(function (k) { return '<option value="' + k.code + '">' + esc(k.name) + (k.active ? '' : ' (inactive)') + '</option>'; }).join('') + '</select><button class="btn" id="addLinkBtn">Add</button></div>';
    }

    function body() {
      return '<div class="drawer-head"><div><div class="card-title" data-help="Everything about one risk: its wording, score, indicators and mitigations.">' + esc(risk.id) + ' ' + esc(risk.name) + '</div>' +
        '<div class="muted" style="font-size:10.5px">' + esc(risk.studyId) + ' &middot; ' + esc(risk.category) + ' &middot; status <b id="rdStatus">' + esc(risk.status) + '</b></div></div>' +
        '<button class="btn btn-ghost" data-act="close" aria-label="Close">&times;</button></div><div class="drawer-body">' +
        '<div class="calc-section"><b data-term="Risk statement" data-help="One sentence that says what could happen, why, and what follows.">Risk statement</b>' +
        '<div class="field"><label>Event</label><input class="text-input" id="stEvent" value="' + esc(w.statement.event) + '"></div>' +
        '<div class="field"><label>Driver</label><input class="text-input" id="stDriver" value="' + esc(w.statement.driver) + '"></div>' +
        '<div class="field"><label>Consequence</label><input class="text-input" id="stCons" value="' + esc(w.statement.consequence) + '"></div>' +
        '<p class="banner banner-ai" id="stPreview" style="font-size:11.5px"></p></div>' +
        '<div class="calc-section"><b>Scoring</b><div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:4px">' +
        '<label>Likelihood ' + sel('scL', w.probability) + '</label><label>Impact ' + sel('scI', w.impact) + '</label><label data-term="Detectability">Detectability ' + sel('scD', w.detectability) + '</label>' +
        '<span id="scOut"></span></div>' +
        '<label class="hint-toggle" style="margin-top:6px"><input type="checkbox" id="inclD"' + (settings().includeDetectability ? ' checked' : '') + '> Include detectability in the score</label>' +
        '<div class="muted" style="font-size:10.5px">Off: score = likelihood x impact. On: score = round(likelihood x impact x detectability / 5). High 15 and above, Medium 8 to 14, Low under 8.</div></div>' +
        '<div class="calc-section"><b data-term="Associated indicators" data-help="Indicators that would change if this risk happens. The percentages say how likely the risk is when each one fires.">Associated indicators</b><div id="linksWrap">' + linkRows() + '</div></div>' +
        '<div class="calc-section"><div class="card-head"><b data-help="Actions that reduce this risk. The risk status follows them: any Active means Mitigating.">Mitigations</b><div style="display:flex;gap:6px"><button class="btn btn-sm" id="mitAi"><span aria-hidden="true">&#10022;</span> AI draft mitigation</button><button class="btn btn-sm" id="mitAdd">Add</button></div></div><div id="mitWrap">' + mitRows() + '</div></div>' +
        '</div><div class="drawer-foot"><button class="btn btn-primary" data-act="save">Save changes</button><button class="btn" data-act="close">Close</button></div>';
    }

    function refreshScore() {
      var sc = scoreNow(), b = SC.riskBand(sc);
      handle.el.querySelector('#scOut').innerHTML = 'Score <span class="risk-badge band-' + b + '">' + sc + '</span> ' + b;
      handle.el.querySelector('#stPreview').textContent = composeStatement(w.statement);
    }

    function mitModal(m, isNew, prefill) {
      var u = data.users, base = m || Object.assign({ title: '', ownerId: USER, role: ROLE_BY_CTQ[risk.ctqId] || 'Quality', schedule: 'Monthly', goal: '', status: 'Draft' }, prefill || {});
      var opts = function (list, cur) { return list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join(''); };
      global.RBQM_MODAL.open({
        title: isNew ? 'Add mitigation' : 'Edit ' + m.id, confirmLabel: 'Save',
        subtitle: prefill ? 'AI-assisted draft from the ' + risk.category.toLowerCase() + ' template. Edit it before saving.' : '',
        bodyHtml: '<div class="field"><label>Title</label><input class="text-input" id="mTitle" value="' + esc(base.title) + '"></div>' +
          '<div class="field"><label>Owner</label><select class="select-input" id="mOwner">' + u.map(function (x) { return '<option value="' + x.id + '"' + (x.id === base.ownerId ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label data-term="Responsible role">Responsible role</label><select class="select-input" id="mRole">' + opts(data.riskDetail.responsibleRoles, base.role) + '</select></div>' +
          '<div class="field"><label data-term="Review schedule">Review schedule</label><select class="select-input" id="mSched">' + opts(data.riskDetail.schedules, base.schedule) + '</select></div>' +
          '<div class="field"><label>Goal</label><textarea class="text-input" id="mGoal" rows="3">' + esc(base.goal) + '</textarea></div>' +
          '<div class="field"><label>Status</label><select class="select-input" id="mStatus">' + opts(['Draft', 'Active', 'Inactive'], base.status) + '</select></div>',
        onConfirm: function (mo) {
          var title = mo.querySelector('#mTitle').value.trim();
          if (!title) return false;
          var next = Object.assign({}, base, { riskId: risk.id, title: title, ownerId: mo.querySelector('#mOwner').value, role: mo.querySelector('#mRole').value,
            schedule: mo.querySelector('#mSched').value, goal: mo.querySelector('#mGoal').value.trim(), status: mo.querySelector('#mStatus').value });
          saveMitigation(data, next, isNew);
          global.RBQM_TOAST.show(isNew ? 'Mitigation added' : 'Mitigation updated');
          afterMitChange(); return true;
        }
      });
    }

    function afterMitChange() {
      handle.el.querySelector('#mitWrap').innerHTML = mitRows();
      bindMit();
      var st = SC.deriveRiskStatus(allMitigations(data, risk.id));
      handle.el.querySelector('#rdStatus').textContent = (allMitigations(data, risk.id).length || !risk.custom) ? st : risk.status;
      if (onChange) onChange();
    }

    function bindMit() {
      var el = handle.el;
      el.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { mitModal(allMitigations(data, risk.id).filter(function (m) { return m.id === b.getAttribute('data-edit'); })[0], false); }); });
      el.querySelectorAll('[data-toggle]').forEach(function (b) {
        b.addEventListener('click', function () {
          var m = allMitigations(data, risk.id).filter(function (x) { return x.id === b.getAttribute('data-toggle'); })[0];
          saveMitigation(data, Object.assign({}, m, { status: m.status === 'Active' ? 'Inactive' : 'Active' }), false);
          global.RBQM_TOAST.show('Mitigation ' + (m.status === 'Active' ? 'deactivated' : 'activated')); afterMitChange();
        });
      });
      el.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          var m = allMitigations(data, risk.id).filter(function (x) { return x.id === b.getAttribute('data-del'); })[0];
          global.RBQM_MODAL.open({ title: 'Delete ' + m.id, subtitle: m.title, confirmLabel: 'Delete', bodyHtml: '<p style="font-size:12px">This removes the mitigation from the risk. You can add it again later.</p>',
            onConfirm: function () { deleteMitigation(m); global.RBQM_TOAST.show('Mitigation deleted'); afterMitChange(); return true; } });
        });
      });
    }

    function bindLinks() {
      var el = handle.el;
      el.querySelectorAll('.link-pct').forEach(function (inp) { inp.addEventListener('input', function () { w.links[+inp.getAttribute('data-i')].likelihoodPct = clampPct(inp.value); covUpdate(); }); });
      el.querySelector('#undetPct').addEventListener('input', function (e) { w.undetectedPct = clampPct(e.target.value); covUpdate(); });
      el.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { w.links.splice(+b.getAttribute('data-rm'), 1); redrawLinks(); }); });
      el.querySelector('#addLinkBtn').addEventListener('click', function () {
        var code = el.querySelector('#addLinkSel').value;
        if (!code) return;
        w.links.push({ kriCode: code, likelihoodPct: 50 }); redrawLinks();
      });
    }
    function clampPct(v) { v = parseFloat(v); return isNaN(v) ? 0 : Math.max(0, Math.min(100, v)); }
    function covUpdate() { handle.el.querySelector('#covOut').textContent = SC.detectionCoverage(w.links, w.undetectedPct) + '%'; }
    function redrawLinks() { handle.el.querySelector('#linksWrap').innerHTML = linkRows(); bindLinks(); }

    handle = global.RBQM_DRAWER.open({
      className: 'drawer drawer-wide', bodyHtml: body(),
      onMount: function (el, close) {
        handle = { el: el };   // drawer.open runs onMount before it returns, so set the handle here
        el.querySelectorAll('[data-act="close"]').forEach(function (b) { b.addEventListener('click', close); });
        function readStatement() { w.statement = { event: el.querySelector('#stEvent').value, driver: el.querySelector('#stDriver').value, consequence: el.querySelector('#stCons').value }; refreshScore(); }
        ['#stEvent', '#stDriver', '#stCons'].forEach(function (s) { el.querySelector(s).addEventListener('input', readStatement); });
        [['#scL', 'probability'], ['#scI', 'impact'], ['#scD', 'detectability']].forEach(function (p) {
          el.querySelector(p[0]).addEventListener('change', function (e) { w[p[1]] = parseInt(e.target.value, 10); refreshScore(); });
        });
        el.querySelector('#inclD').addEventListener('change', function (e) { setIncludeDetectability(e.target.checked); refreshScore(); if (onChange) onChange(); });
        el.querySelector('#mitAdd').addEventListener('click', function () { mitModal(null, true); });
        el.querySelector('#mitAi').addEventListener('click', function () {
          mitModal(null, true, { title: 'Draft: ' + risk.name.slice(0, 60), goal: global.RBQM_RISK_LIBRARY.mitigationFor(risk.ctqId) });
        });
        el.querySelector('[data-act="save"]').addEventListener('click', function () {
          STORE.patch('risks', risk.id, Object.assign({}, risk.custom ? STORE.get('risks', risk.id) : {}, { statement: w.statement, probability: w.probability, impact: w.impact, detectability: w.detectability, links: w.links, undetectedPct: w.undetectedPct }));
          STORE.logAudit('Risk', risk.id, USER, 'Risk details saved (score ' + scoreNow() + ', coverage ' + SC.detectionCoverage(w.links, w.undetectedPct) + '%)');
          global.RBQM_TOAST.show('Risk saved');
          if (onChange) onChange(); close();
        });
        bindLinks(); bindMit(); refreshScore();
      }
    });
  }

  function addMitigation(data, fields) {
    var m = Object.assign({ title: '', ownerId: USER, role: 'Quality', schedule: 'Monthly', goal: '', status: 'Draft' }, fields);
    saveMitigation(data, m, true);
    return m;
  }

  global.RBQM_RISKS = { addMitigation: addMitigation, settings: settings, setIncludeDetectability: setIncludeDetectability, risks: risks, mitigations: allMitigations, openDetail: openDetail, composeStatement: composeStatement, category: category };
})(window);
