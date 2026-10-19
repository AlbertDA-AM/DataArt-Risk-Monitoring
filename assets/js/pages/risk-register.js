/* Risk register: Risks tab (5x5 heat grid + list, add/edit/score) and CtQ traceability tab
   (CtQ factors -> risks, KRIs, mitigations, with gaps highlighted). */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;

  function effective(r) { return Object.assign({}, r, STORE.get('risks', r.id)); }
  function band(score) { return score >= 15 ? 'high' : score >= 8 ? 'medium' : 'low'; }

  function render(contentEl, data) {
    draw();

    function draw() {
      var risks = data.risks.map(effective);
      contentEl.innerHTML =
        '<div class="card-subtitle" style="margin-bottom:8px">' + risks.length + ' risks tracked. Score = likelihood x impact.</div>' +
        '<div class="tabs" id="rrTabs"><button class="tab active" data-tab="risks">Risks</button><button class="tab" data-tab="ctq">CtQ traceability</button></div>' +
        '<div data-tab-panel="risks">' + risksTab(risks) + '</div>' +
        '<div data-tab-panel="ctq" hidden>' + ctqTab(risks) + '</div>';

      global.RBQM_TABS.init(document.getElementById('rrTabs'));
      var addBtn = document.getElementById('addRiskBtn');
      if (addBtn) addBtn.addEventListener('click', openAddModal);
      document.querySelectorAll('.risk-edit-btn').forEach(function (b) {
        b.addEventListener('click', function () { openEditModal(risks.filter(function (r) { return r.id === b.dataset.id; })[0]); });
      });
    }

    function risksTab(risks) {
      var grid = buildGrid(risks);
      var columns = [
        { key: 'id', label: 'ID' },
        { key: 'description', label: 'Description' },
        { key: 'study', label: 'Study', render: function (r) { return r.studyId; } },
        { key: 'score', label: 'Score', sortValue: function (r) { return r.score; }, render: function (r) { return '<span class="risk-badge band-' + band(r.score) + '">' + r.score + '</span>'; } },
        { key: 'status', label: 'Status' },
        { key: 'actions', label: '', sortable: false, render: function (r) { return '<button class="btn btn-sm risk-edit-btn" data-id="' + r.id + '">Edit</button>'; } }
      ];
      return '<div class="grid grid-main-side">' +
        '<div class="card">' + global.RBQM_TABLE.render(columns, risks) + '</div>' +
        '<div class="card"><div class="card-title">5x5 heat grid</div>' + grid + '<button class="btn btn-primary" id="addRiskBtn" style="margin-top:10px">Add risk</button></div>' +
        '</div>';
    }

    function buildGrid(risks) {
      var html = '<table class="table" style="text-align:center"><tbody>';
      for (var impact = 5; impact >= 1; impact--) {
        html += '<tr><td class="muted" style="font-size:10px">I' + impact + '</td>';
        for (var prob = 1; prob <= 5; prob++) {
          var score = impact * prob;
          var hits = risks.filter(function (r) { return r.impact === impact && r.probability === prob; });
          var tone = band(score);
          html += '<td><span class="table-cell-metric status-' + (tone === 'high' ? 'action' : tone === 'medium' ? 'watch' : 'ok') + '" title="' + hits.map(function (r) { return r.id; }).join(', ') + '">' + (hits.length || '') + '</span></td>';
        }
        html += '</tr>';
      }
      html += '<tr><td></td>' + [1, 2, 3, 4, 5].map(function (p) { return '<td class="muted" style="font-size:10px">P' + p + '</td>'; }).join('') + '</tr></tbody></table>';
      return html;
    }

    function ctqTab(risks) {
      return '<div class="card">' + data.ctqFactors.map(function (ctq) {
        var linkedRisks = risks.filter(function (r) { return r.ctqId === ctq.id; });
        var kriCodes = Array.from(new Set(linkedRisks.reduce(function (acc, r) { return acc.concat(r.kriCodes || []); }, [])));
        kriCodes = kriCodes.length ? kriCodes : (KRI.KRIS.filter(function (k) { return k.active && k.ctqIds && k.ctqIds.indexOf(ctq.id) !== -1; }).map(function (k) { return k.code; }));
        var activeKriCodes = kriCodes.filter(function (c) { var k = KRI.byCode(c); return k && k.active; });
        var gap = activeKriCodes.length === 0;
        return '<div class="card-head" style="padding:10px 0;border-bottom:1px solid var(--c-border)">' +
          '<div><b>' + ctq.name + '</b><div class="muted" style="font-size:11px">' + ctq.description + '</div>' +
          '<div style="font-size:11px;margin-top:4px">Risks: ' + (linkedRisks.map(function (r) { return r.id; }).join(', ') || '–') + '</div>' +
          '<div style="font-size:11px">Indicators: ' + (kriCodes.map(function (c) { return KRI.byCode(c) ? KRI.byCode(c).name : c; }).join(', ') || '–') + '</div></div>' +
          (gap ? '<span class="status-pill status-action">Gap: no indicator</span>' : '<span class="status-pill status-ok">Covered</span>') +
          '</div>';
      }).join('') + '</div>';
    }

    function openAddModal() {
      global.RBQM_MODAL.open({
        title: 'Add risk', confirmLabel: 'Add',
        bodyHtml:
          '<div class="field"><label>Description</label><input class="text-input" id="rDesc"></div>' +
          '<div class="field"><label>Study</label><select class="select-input" id="rStudy">' + data.studies.map(function (s) { return '<option value="' + s.id + '">' + s.id + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Probability (1-5)</label><input class="text-input" id="rProb" type="number" min="1" max="5" value="3"></div>' +
          '<div class="field"><label>Impact (1-5)</label><input class="text-input" id="rImpact" type="number" min="1" max="5" value="3"></div>',
        onConfirm: function (modalEl) {
          var desc = modalEl.querySelector('#rDesc').value.trim();
          if (!desc) return false;
          var id = 'R-' + String(data.risks.length + Object.keys(STORE.get('risks') || {}).length + 1).padStart(2, '0') + '-' + Date.now().toString().slice(-4);
          var prob = parseInt(modalEl.querySelector('#rProb').value, 10), impact = parseInt(modalEl.querySelector('#rImpact').value, 10);
          data.risks.push({ id: id, studyId: modalEl.querySelector('#rStudy').value, description: desc, probability: prob, impact: impact, detectability: 3, score: prob * impact, ctqId: null, kriCodes: [], status: 'Monitoring', ownerId: 'U-001', mitigation: 'To be defined.' });
          STORE.logAudit('Risk', id, null, 'Risk added: ' + desc);
          global.RBQM_TOAST.show('Risk added');
          draw(); return true;
        }
      });
    }

    function openEditModal(risk) {
      global.RBQM_MODAL.open({
        title: 'Edit ' + risk.id, confirmLabel: 'Save',
        bodyHtml:
          '<div class="field"><label>Status</label><select class="select-input" id="rStatus">' +
          ['Mitigating', 'Action planned', 'Monitoring', 'Accepted'].map(function (s) { return '<option value="' + s + '"' + (risk.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Probability (1-5)</label><input class="text-input" id="rProb" type="number" min="1" max="5" value="' + risk.probability + '"></div>' +
          '<div class="field"><label>Impact (1-5)</label><input class="text-input" id="rImpact" type="number" min="1" max="5" value="' + risk.impact + '"></div>',
        onConfirm: function (modalEl) {
          var prob = parseInt(modalEl.querySelector('#rProb').value, 10), impact = parseInt(modalEl.querySelector('#rImpact').value, 10);
          STORE.patch('risks', risk.id, { status: modalEl.querySelector('#rStatus').value, probability: prob, impact: impact, score: prob * impact });
          STORE.logAudit('Risk', risk.id, null, 'Risk updated');
          global.RBQM_TOAST.show('Risk updated');
          draw(); return true;
        }
      });
    }
  }

  global.RBQM_PAGE_RISK_REGISTER = { render: render };
})(window);
