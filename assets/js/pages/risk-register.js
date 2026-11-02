/* Risk register: Risks tab (group, sort and search the list; click a row for the Risk detail drawer; 5x5 heat grid;
   add from library) and CtQ traceability tab (CtQ factors -> risks, indicators, mitigations, with gaps highlighted).
   The risk model (scores, derived status, mitigations) lives in components/risk-detail-drawer.js. */
(function (global) {
  'use strict';
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;
  var ROUTER = global.RBQM_ROUTER;
  var RK = global.RBQM_RISKS;
  var STATUS_TONE = { Mitigating: 'ok', 'Action planned': 'watch', Monitoring: 'insufficient', Accepted: 'insufficient', Draft: 'watch' };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function render(contentEl, data) {
    var tab = ROUTER.get('tab', 'risks') === 'ctq' ? 'ctq' : 'risks';
    var f = { group: ROUTER.get('group', 'category'), sort: ROUTER.get('sort', 'score'), q: ROUTER.get('q', ''), study: ROUTER.get('study', 'all'), mit: ROUTER.get('mit', '') };
    var collapsed = {};
    draw();

    function visible(all) {
      var q = f.q.toLowerCase();
      var list = all.filter(function (r) {
        if (f.study !== 'all' && r.studyId !== f.study && r.studyId !== 'All studies') return false;
        if (f.mit === 'Active' && !r.mitigations.some(function (m) { return m.status === 'Active'; })) return false;
        return !q || (r.id + ' ' + r.name + ' ' + r.category + ' ' + r.studyId).toLowerCase().indexOf(q) !== -1;
      });
      return list.sort(function (a, b) {
        if (f.sort === 'name') return a.name < b.name ? -1 : 1;
        return b.score - a.score || (a.id < b.id ? -1 : 1);
      });
    }

    function groupsOf(list) {
      if (f.group === 'none') return [{ name: null, rows: list }];
      var key = f.group === 'score' ? function (r) { return r.band === 'high' ? 'High (15 and above)' : r.band === 'medium' ? 'Medium (8 to 14)' : 'Low (under 8)'; } : function (r) { return r.category; };
      var order = [], by = {};
      list.forEach(function (r) { var k = key(r); if (!by[k]) { by[k] = []; order.push(k); } by[k].push(r); });
      if (f.group === 'score') order = ['High (15 and above)', 'Medium (8 to 14)', 'Low (under 8)'].filter(function (k) { return by[k]; });
      return order.map(function (k) { return { name: k, rows: by[k] }; });
    }

    function draw() {
      var focus = global.RBQM_A11Y.captureFocus('riskSearch');
      var all = RK.risks(data), list = visible(all), incl = RK.settings().includeDetectability;
      contentEl.innerHTML =
        '<div class="card-subtitle" style="margin-bottom:8px">' + list.length + ' of ' + all.length + ' risks shown. Score = likelihood x impact' + (incl ? ' x detectability / 5' : '') + '. Click a risk for its detail.</div>' +
        '<div class="tabs" id="rrTabs"><button class="tab' + (tab === 'risks' ? ' active' : '') + '" data-tab="risks">Risks</button><button class="tab' + (tab === 'ctq' ? ' active' : '') + '" data-tab="ctq">CtQ traceability</button></div>' +
        '<div data-tab-panel="risks">' + risksTab(list) + '</div>' +
        '<div data-tab-panel="ctq" hidden>' + ctqTab(all) + '</div>';

      global.RBQM_TABS.init(document.getElementById('rrTabs'), function (name) { tab = name; });
      var addBtn = document.getElementById('addRiskBtn');
      if (addBtn) addBtn.addEventListener('click', openAddModal);
      bindControls();
      contentEl.querySelectorAll('[data-risk]').forEach(function (tr) {
        tr.addEventListener('click', function () { RK.openDetail(data, tr.getAttribute('data-risk'), draw); });
        tr.addEventListener('keydown', function (e) { if (e.key === 'Enter') RK.openDetail(data, tr.getAttribute('data-risk'), draw); });
      });
      global.RBQM_A11Y.restoreFocus(focus);
    }

    function bindControls() {
      function set(k, v) { f[k] = v; var p = {}; p[k] = (v === 'all' || v === '' || (k === 'group' && v === 'category') || (k === 'sort' && v === 'score')) ? null : v; ROUTER.set(p); draw(); }
      [['riskGroup', 'group'], ['riskSort', 'sort'], ['riskStudy', 'study']].forEach(function (c) {
        var el = document.getElementById(c[0]); if (el) el.addEventListener('change', function () { set(c[1], el.value); });
      });
      var s = document.getElementById('riskSearch'); if (s) s.addEventListener('input', function () { set('q', s.value); });
      var m = document.getElementById('riskMit'); if (m) m.addEventListener('change', function () { set('mit', m.checked ? 'Active' : ''); });
      contentEl.querySelectorAll('[data-collapse]').forEach(function (b) {
        b.addEventListener('click', function () { var k = b.getAttribute('data-collapse'); collapsed[k] = !collapsed[k]; draw(); });
      });
    }

    function sel(id, opts, cur) { return '<select class="select-input" id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }

    function rowHtml(r) {
      var mits = r.mitigations, act = mits.filter(function (m) { return m.status === 'Active'; }).length;
      return '<tr class="clickable" tabindex="0" data-risk="' + r.id + '"><td>' + r.id + '</td><td>' + esc(r.name) + '</td><td>' + r.studyId + '</td>' +
        '<td><span class="risk-badge band-' + r.band + '">' + r.score + '</span></td><td><span class="status-pill status-' + (STATUS_TONE[r.status] || 'insufficient') + '">' + r.status + '</span></td>' +
        '<td>' + act + ' active of ' + mits.length + '</td></tr>';
    }

    function risksTab(list) {
      var groups = groupsOf(list), grid = buildGrid(list);
      var head = '<thead><tr><th class="no-sort">ID</th><th class="no-sort">Description</th><th class="no-sort">Study</th><th class="no-sort">Score</th><th class="no-sort">Status</th><th class="no-sort">Mitigations</th></tr></thead>';
      var body = groups.map(function (g) {
        var key = g.name || 'all', open = !collapsed[key];
        return (g.name ? '<button class="group-head" data-collapse="' + esc(key) + '" aria-expanded="' + open + '"><span aria-hidden="true">' + (open ? '&#9662;' : '&#9656;') + '</span> ' + esc(g.name) + ' <span class="muted">(' + g.rows.length + ')</span></button>' : '') +
          (open ? '<table class="table">' + head + '<tbody>' + g.rows.map(rowHtml).join('') + '</tbody></table>' : '');
      }).join('') || '<div class="empty-state"><h3>Nothing matches these filters</h3><p>Try another search or study.</p></div>';
      var studies = [['all', 'All studies']].concat(data.studies.map(function (s) { return [s.id, s.id]; }));
      return '<div class="grid grid-main-side"><div class="card"><div class="table-toolbar">' +
        '<input class="search-input" id="riskSearch" placeholder="Search risks" value="' + esc(f.q) + '">' +
        '<label class="muted" style="font-size:10.5px">Group by ' + sel('riskGroup', [['category', 'Category'], ['score', 'Score'], ['none', 'None']], f.group) + '</label>' +
        '<label class="muted" style="font-size:10.5px">Sort by ' + sel('riskSort', [['score', 'Score'], ['name', 'Name']], f.sort) + '</label>' +
        sel('riskStudy', studies, f.study) +
        '<label class="hint-toggle"><input type="checkbox" id="riskMit"' + (f.mit === 'Active' ? ' checked' : '') + '> Active mitigations only</label></div>' + body + '</div>' +
        '<div class="card"><div class="card-title" data-help="Risks placed by probability (across) and impact (up). Redder cells score higher.">5x5 heat grid</div>' + grid + '<button class="btn btn-primary" id="addRiskBtn" style="margin-top:10px">Add risk</button></div></div>';
    }

    function buildGrid(risks) {
      var html = '<table class="table" style="text-align:center"><tbody>';
      for (var impact = 5; impact >= 1; impact--) {
        html += '<tr><td class="muted" style="font-size:10px" title="Impact: how serious the effect would be, from 1 (minor) to 5 (severe).">I' + impact + '</td>';
        for (var prob = 1; prob <= 5; prob++) {
          var score = impact * prob;
          var hits = risks.filter(function (r) { return r.impact === impact && r.probability === prob; });
          var tone = score >= 15 ? 'action' : score >= 8 ? 'watch' : 'ok';
          html += '<td><span class="table-cell-metric status-' + tone + '" title="' + hits.map(function (r) { return r.id; }).join(', ') + '">' + (hits.length || '') + '</span></td>';
        }
        html += '</tr>';
      }
      html += '<tr><td></td>' + [1, 2, 3, 4, 5].map(function (p) { return '<td class="muted" style="font-size:10px" title="Probability: how likely it is, from 1 (rare) to 5 (almost certain).">P' + p + '</td>'; }).join('') + '</tr></tbody></table>';
      return html;
    }

    function ctqTab(risks) {
      return '<div class="card">' + data.ctqFactors.map(function (ctq) {
        var linkedRisks = risks.filter(function (r) { return r.ctqId === ctq.id; });
        var kriCodes = Array.from(new Set(linkedRisks.reduce(function (acc, r) { return acc.concat((r.kriCodes || []), r.links.map(function (l) { return l.kriCode; })); }, [])));
        kriCodes = kriCodes.length ? kriCodes : (KRI.KRIS.filter(function (k) { return k.active && k.ctqIds && k.ctqIds.indexOf(ctq.id) !== -1; }).map(function (k) { return k.code; }));
        var activeKriCodes = kriCodes.filter(function (c) { var k = KRI.byCode(c); return k && k.active; });
        var gap = activeKriCodes.length === 0;
        var mitigations = linkedRisks.reduce(function (n, r) { return n + r.mitigations.filter(function (m) { return m.status === 'Active'; }).length; }, 0);
        return '<div class="card-head" style="padding:10px 0;border-bottom:1px solid var(--c-border)">' +
          '<div><b>' + ctq.name + '</b><div class="muted" style="font-size:11px">' + ctq.description + '</div>' +
          '<div style="font-size:11px;margin-top:4px">Risks: ' + (linkedRisks.map(function (r) { return r.id; }).join(', ') || '–') + '</div>' +
          '<div style="font-size:11px">Indicators: ' + (kriCodes.map(function (c) { return KRI.byCode(c) ? KRI.byCode(c).name : c; }).join(', ') || '–') + '</div>' +
          '<div style="font-size:11px">Active mitigations: ' + mitigations + '</div></div>' +
          (gap ? '<span class="status-pill status-action">Gap: no indicator</span>' : '<span class="status-pill status-ok">Covered</span>') +
          '</div>';
      }).join('') + '</div>';
    }

    function openAddModal() {
      var LIB = global.RBQM_RISK_LIBRARY;
      var ctqOptions = '<option value="">None</option>' + data.ctqFactors.map(function (c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('');
      var libOptions = '<option value="">Choose a template</option>' + LIB.indications.map(function (ind) {
        return '<optgroup label="' + ind + '">' + LIB.templates.filter(function (t) { return t.indication === ind; }).map(function (t) { return '<option value="' + t.id + '">' + t.description + '</option>'; }).join('') + '</optgroup>';
      }).join('');
      var modal = global.RBQM_MODAL.open({
        title: 'Add risk', confirmLabel: 'Add',
        bodyHtml:
          '<div class="field"><label>Add from library</label><select class="select-input" id="rLib">' + libOptions + '</select><div class="muted" id="rLibHint" style="font-size:10.5px;margin-top:3px"></div></div>' +
          '<div class="field"><label>Description</label><input class="text-input" id="rDesc"></div>' +
          '<div class="field"><label>Study</label><select class="select-input" id="rStudy">' + data.studies.map(function (s) { return '<option value="' + s.id + '">' + s.id + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Critical to quality factor</label><select class="select-input" id="rCtq">' + ctqOptions + '</select></div>' +
          '<div class="field"><label>Probability (1-5)</label><input class="text-input" id="rProb" type="number" min="1" max="5" value="3"></div>' +
          '<div class="field"><label>Impact (1-5)</label><input class="text-input" id="rImpact" type="number" min="1" max="5" value="3"></div>' +
          '<div class="banner banner-watch" id="rOutlier" hidden></div>' +
          '<div class="field"><label>Mitigation <button type="button" class="btn btn-sm" id="rAiDraft"><span aria-hidden="true">&#10022;</span> AI draft mitigation</button></label>' +
          '<textarea class="text-input" id="rMitigation" rows="3" placeholder="To be defined."></textarea><div class="muted" id="rAiNote" style="font-size:10.5px"></div></div>',
        onConfirm: function (modalEl) {
          var desc = modalEl.querySelector('#rDesc').value.trim();
          if (!desc) return false;
          var id = 'R-' + String(RK.risks(data).length + 1).padStart(2, '0') + '-' + Date.now().toString().slice(-4);
          var prob = clamp(parseInt(modalEl.querySelector('#rProb').value, 10)), impact = clamp(parseInt(modalEl.querySelector('#rImpact').value, 10));
          var tpl = LIB.templates.filter(function (t) { return t.id === modalEl.querySelector('#rLib').value; })[0];
          STORE.patch('risks', id, { id: id, custom: true, studyId: modalEl.querySelector('#rStudy').value, description: desc, probability: prob, impact: impact, detectability: 3, score: prob * impact,
            ctqId: modalEl.querySelector('#rCtq').value || null, kriCodes: tpl ? tpl.kriCodes : [], status: 'Monitoring', ownerId: 'U-001', libraryId: tpl ? tpl.id : null });
          var mitText = modalEl.querySelector('#rMitigation').value.trim();
          if (mitText) RK.addMitigation(data, { riskId: id, title: 'Mitigation for ' + desc.slice(0, 50), ownerId: 'U-001', role: 'Quality', schedule: 'Monthly', goal: mitText, status: 'Draft' });
          STORE.logAudit('Risk', id, null, 'Risk added: ' + desc);
          global.RBQM_TOAST.show('Risk added');
          draw(); return true;
        }
      });
      var m = modal.el;
      function q(sel) { return m.querySelector(sel); }
      function outlier() {
        var score = clamp(parseInt(q('#rProb').value, 10)) * clamp(parseInt(q('#rImpact').value, 10));
        var tpl = LIB.templates.filter(function (t) { return t.id === q('#rLib').value; })[0], ref = null, refText = '';
        if (tpl) { ref = tpl.probability * tpl.impact; refText = 'the library default of ' + ref; }
        else if (q('#rCtq').value) {
          var scores = RK.risks(data).filter(function (r) { return r.ctqId === q('#rCtq').value; }).map(function (r) { return r.score; }).sort(function (a, b) { return a - b; });
          if (scores.length) { ref = scores[Math.floor(scores.length / 2)]; refText = 'the median of ' + scores.length + ' similar risks (' + ref + ')'; }
        }
        var box = q('#rOutlier');
        var flag = ref != null && Math.abs(score - ref) >= 2;
        box.hidden = !flag;
        if (flag) box.innerHTML = '<span aria-hidden="true">&#9888;</span><div><b>Outlier score.</b> ' + score + ' differs from ' + refText + ' by ' + Math.abs(score - ref) + '. Check the likelihood and impact.</div>';
      }
      q('#rLib').addEventListener('change', function () {
        var t = LIB.templates.filter(function (x) { return x.id === q('#rLib').value; })[0];
        if (!t) { q('#rLibHint').textContent = ''; outlier(); return; }
        q('#rDesc').value = t.description; q('#rProb').value = t.probability; q('#rImpact').value = t.impact; q('#rCtq').value = t.ctqId || '';
        q('#rLibHint').textContent = 'Suggested indicators: ' + (t.kriCodes.map(function (c) { return KRI.byCode(c) ? KRI.byCode(c).name : c; }).join(', ') || 'none yet') + '. Typical score ' + (t.probability * t.impact) + '.';
        outlier();
      });
      ['#rProb', '#rImpact', '#rCtq'].forEach(function (sel) { q(sel).addEventListener('input', outlier); q(sel).addEventListener('change', outlier); });
      q('#rAiDraft').addEventListener('click', function () {
        q('#rMitigation').value = LIB.mitigationFor(q('#rCtq').value);
        q('#rAiNote').textContent = 'AI-assisted draft from the ' + (q('#rCtq').selectedOptions[0].textContent.toLowerCase()) + ' template. Edit it before saving.';
      });
    }

    function clamp(n) { return isNaN(n) ? 3 : Math.max(1, Math.min(5, n)); }
  }

  global.RBQM_PAGE_RISK_REGISTER = { render: render };
})(window);
