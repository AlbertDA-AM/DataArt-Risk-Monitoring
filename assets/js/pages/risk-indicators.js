/* Risk indicators: library of all KRIs (active + inactive extras), with active toggles,
   "Add from library" drawer, and a "Create custom indicator" form. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;
  var G = global.RBQM_GENERATOR;

  function flaggedSiteCount(data, kriDef) {
    var count = 0, worstSite = null, worstRank = -1;
    var rank = { action: 2, watch: 1, ok: 0 };
    data.sites.forEach(function (site) {
      var snap = G.latestFinalizedSnapshotForStudy(data.snapshots, site.studyId);
      var r = data.kriResults.filter(function (x) { return x.siteId === site.id && x.kriCode === kriDef.code && x.snapshotId === snap.id; })[0];
      if (!r) return;
      if (r.status !== 'ok' && r.status !== 'insufficient') count++;
      if ((rank[r.status] || 0) > worstRank) { worstRank = rank[r.status] || 0; worstSite = site; }
    });
    return { count: count, worstSite: worstSite };
  }

  function worstSiteFor(data, kriDef) { return flaggedSiteCount(data, kriDef).worstSite; }

  function render(contentEl, data) {
    draw();

    function draw() {
      var active = KRI.KRIS.filter(function (k) { return k.active; });
      var inactive = KRI.KRIS.filter(function (k) { return !k.active; });
      contentEl.innerHTML =
        '<div class="card-subtitle" style="margin-bottom:8px">' + active.length + ' indicators active. ' + inactive.length + ' available in the library.</div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px">' +
        '<button class="btn" id="addFromLibraryBtn">Add from library</button>' +
        '<button class="btn" id="createCustomBtn">Create custom indicator</button>' +
        '</div>' +
        '<div class="card">' + active.map(rowHtml).join('') + '</div>';

      document.getElementById('addFromLibraryBtn').addEventListener('click', openLibraryDrawer);
      document.getElementById('createCustomBtn').addEventListener('click', openCustomModal);
      document.querySelectorAll('.kri-row-toggle').forEach(function (cb) {
        cb.addEventListener('change', function () {
          STORE.patch('kriThresholds', cb.dataset.code, { active: cb.checked });
          STORE.logAudit('KRIDefinition', cb.dataset.code, null, cb.checked ? 'Activated' : 'Deactivated');
          global.RBQM_TOAST.show((cb.checked ? 'Activated ' : 'Deactivated ') + KRI.byCode(cb.dataset.code).name);
          global.location.reload();
        });
      });
    }

    function rowHtml(k) {
      var stats = flaggedSiteCount(data, k);
      var target = stats.worstSite ? 'kri-detail.html?kri=' + k.code + '&site=' + stats.worstSite.id : null;
      return '<div class="card-head" style="padding:8px 0;border-bottom:1px solid var(--c-border)">' +
        '<div>' + (target ? '<a href="' + target + '"><b>' + k.name + '</b></a>' : '<b>' + k.name + '</b>') +
        '<div class="muted" style="font-size:10.5px">' + k.unit + ' &middot; ' + k.validation + ' &middot; amber ' + k.amber + ', red ' + k.red + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
        '<span class="status-pill status-watch">' + stats.count + ' flagged</span>' +
        '<label style="display:flex;align-items:center;gap:5px;font-size:11px"><input type="checkbox" class="kri-row-toggle" data-code="' + k.code + '" checked> Active</label>' +
        '</div></div>';
    }

    function openLibraryDrawer() {
      var inactive = KRI.KRIS.filter(function (k) { return !k.active; });
      global.RBQM_DRAWER.open({
        bodyHtml: '<h2>Add from library</h2><p class="muted">Indicators not currently active for this portfolio.</p>' +
          inactive.map(function (k) {
            return '<div class="card-head" style="padding:8px 0;border-bottom:1px solid var(--c-border)">' +
              '<div><b>' + k.name + '</b><div class="muted" style="font-size:10.5px">' + k.unit + '</div></div>' +
              '<button class="btn btn-sm activate-btn" data-code="' + k.code + '">Activate</button></div>';
          }).join(''),
        onMount: function (drawerEl) {
          drawerEl.querySelectorAll('.activate-btn').forEach(function (b) {
            b.addEventListener('click', function () {
              STORE.patch('kriThresholds', b.dataset.code, { active: true });
              STORE.logAudit('KRIDefinition', b.dataset.code, null, 'Activated from library');
              global.RBQM_TOAST.show('Activated ' + KRI.byCode(b.dataset.code).name);
              global.location.reload();
            });
          });
        }
      });
    }

    function openCustomModal() {
      global.RBQM_MODAL.open({
        title: 'Create custom indicator', confirmLabel: 'Create',
        bodyHtml:
          '<div class="field"><label>Name</label><input class="text-input" id="customName" placeholder="e.g. Query aging by country"></div>' +
          '<div class="field"><label>Unit</label><input class="text-input" id="customUnit" placeholder="e.g. % of queries"></div>' +
          '<div class="field"><label>Amber threshold</label><input class="text-input" id="customAmber" type="number" step="0.01" value="0.05"></div>' +
          '<div class="field"><label>Red threshold</label><input class="text-input" id="customRed" type="number" step="0.01" value="0.10"></div>' +
          '<div class="field"><div class="error" id="customErr" hidden>The red threshold must be higher than amber</div></div>',
        onConfirm: function (modalEl) {
          var name = modalEl.querySelector('#customName').value.trim();
          var amber = parseFloat(modalEl.querySelector('#customAmber').value);
          var red = parseFloat(modalEl.querySelector('#customRed').value);
          if (!name) return false;
          if (red <= amber) { modalEl.querySelector('#customErr').hidden = false; return false; }
          var code = 'custom_' + Date.now();
          var custom = STORE.get('kriThresholds') || {};
          STORE.patch('kriThresholds', code, {
            custom: true, name: name, unit: modalEl.querySelector('#customUnit').value.trim() || 'count',
            amber: amber, red: red, active: true, flagDirection: 'high', method: 'discrete', validation: 'Sponsor-defined'
          });
          STORE.logAudit('KRIDefinition', code, null, 'Custom indicator created: ' + name);
          global.RBQM_TOAST.show('Indicator created. No sites have data for it yet.');
          global.location.reload();
          return true;
        }
      });
    }
  }

  global.RBQM_PAGE_RISK_INDICATORS = { render: render };
})(window);
