/* Study detail (sub-page, reached from Studies). Profile, KRI snapshots (create/finalize/
   compare), QTL runs, KRI list with active toggles. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;
  var G = global.RBQM_GENERATOR;

  function effectiveSnapshots(data, studyId) {
    var overlay = STORE.get('snapshots') || {};
    var base = data.snapshots.filter(function (s) { return s.studyId === studyId; })
      .map(function (s) { return Object.assign({}, s, overlay[s.id]); });
    var customIds = Object.keys(overlay).filter(function (id) { return overlay[id].studyId === studyId && overlay[id].custom && base.every(function (b) { return b.id !== id; }); });
    var custom = customIds.map(function (id) { return Object.assign({ id: id }, overlay[id]); });
    return base.concat(custom).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  function render(contentEl, data) {
    var study = data.studies.filter(function (s) { return s.id === ROUTER.get('study', data.studies[0].id); })[0] || data.studies[0];
    draw(contentEl, data, study);
  }

  function draw(contentEl, data, study) {
    var cro = data.cros.filter(function (c) { return c.id === study.cro; })[0];
    var owner = data.users.filter(function (u) { return u.title.indexOf('Study lead') !== -1 && u.title.indexOf(study.id) !== -1; })[0];
    var snaps = effectiveSnapshots(data, study.id);
    var kris = KRI.KRIS;

    contentEl.innerHTML =
      '<div class="card"><div class="card-title">' + study.title + '</div>' +
      '<div class="grid grid-6" style="margin-top:8px">' +
      tile(study.indication, 'Indication') + tile('Phase ' + study.phase, 'Phase') + tile(FMT.int(study.subjects), 'Subjects') +
      tile(study.sites, 'Sites') + tile(study.countries, 'Countries') + tile(cro ? cro.name : study.cro, 'CRO') +
      '</div></div>' +
      '<div style="height:10px"></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">Snapshots</div></div>' +
      '<div id="snapTableWrap"></div>' +
      '<button class="btn btn-primary" id="createSnapshotBtn" style="margin-top:8px">Create snapshot</button>' +
      '</div>' +
      '<div style="height:10px"></div>' +
      '<div class="card"><div class="card-title">Quality limits</div><div id="qtlRunsWrap"></div></div>' +
      '<div style="height:10px"></div>' +
      '<div class="card"><div class="card-title">Indicators</div><div class="card-subtitle">Active toggles apply across the portfolio (illustrative).</div><div id="kriListWrap"></div></div>';

    renderSnapTable();
    renderQtl();
    renderKriList();

    document.getElementById('createSnapshotBtn').addEventListener('click', function () {
      var newId = study.id + '-SNAP-' + G.iso(G.ASOF) + '-' + Date.now();
      STORE.patch('snapshots', newId, { studyId: study.id, date: G.iso(G.ASOF), status: 'Draft', custom: true, createdBy: 'U-001' });
      STORE.logAudit('Snapshot', newId, null, 'Snapshot created');
      global.RBQM_TOAST.show('Snapshot created as a draft');
      renderSnapTable();
    });

    function renderSnapTable() {
      var rows = effectiveSnapshots(data, study.id);
      var html = rows.map(function (s, idx) {
        var prev = rows[idx - 1];
        return '<div class="card-head" style="padding:6px 0;border-bottom:1px solid var(--c-border)">' +
          '<div>' + FMT.dateShort(s.date) + ' <span class="status-pill ' + (s.status === 'Finalized' ? 'status-ok' : 'status-watch') + '">' + s.status + '</span></div>' +
          '<div style="display:flex;gap:6px">' +
          (s.status === 'Draft' ? '<button class="btn btn-sm finalize-btn" data-id="' + s.id + '">Finalize</button>' : '') +
          (prev ? '<button class="btn btn-sm compare-btn" data-id="' + s.id + '" data-prev="' + prev.id + '">Compare with previous</button>' : '') +
          '</div></div>';
      }).join('');
      document.getElementById('snapTableWrap').innerHTML = html || '<p class="muted">No snapshots yet.</p>';
      document.querySelectorAll('.finalize-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          STORE.patch('snapshots', b.dataset.id, { status: 'Finalized' });
          STORE.logAudit('Snapshot', b.dataset.id, null, 'Finalized');
          global.RBQM_TOAST.show('Snapshot finalized. It can no longer change.');
          renderSnapTable();
        });
      });
      document.querySelectorAll('.compare-btn').forEach(function (b) {
        b.addEventListener('click', function () { showCompare(b.dataset.prev, b.dataset.id); });
      });
    }

    function showCompare(prevId, curId) {
      var changed = 0;
      var lines = [];
      data.sites.filter(function (s) { return s.studyId === study.id; }).forEach(function (site) {
        kris.filter(function (k) { return k.active; }).forEach(function (kriDef) {
          var p = data.kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === kriDef.code && r.snapshotId === prevId; })[0];
          var c = data.kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === kriDef.code && r.snapshotId === curId; })[0];
          if (p && c && p.status !== c.status) { changed++; if (lines.length < 10) lines.push('Site ' + site.code + ': ' + kriDef.name + ' ' + p.status + ' → ' + c.status); }
        });
      });
      global.RBQM_MODAL.open({
        title: 'Compare with previous', cancelLabel: false, confirmLabel: 'Close',
        bodyHtml: '<p>' + changed + ' indicator statuses changed between these snapshots.</p>' + lines.map(function (l) { return '<div style="font-size:12px;padding:3px 0">' + l + '</div>'; }).join('')
      });
    }

    function renderQtl() {
      var defs = data.qtlDefs.filter(function (d) { return d.studyId === study.id; });
      document.getElementById('qtlRunsWrap').innerHTML = defs.map(function (d) {
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--c-border);font-size:12px">' +
          '<span>' + d.parameter + '</span><span class="status-pill status-' + (d.outcome === 'Breached' ? 'action' : d.outcome === 'Near' ? 'watch' : 'ok') + '">' + FMT.pct(d.currentValue, 1) + ' of ' + FMT.pct(d.limit, 0) + '</span></div>';
      }).join('') || '<p class="muted">No quality limits configured.</p>';
    }

    function renderKriList() {
      document.getElementById('kriListWrap').innerHTML = kris.map(function (k) {
        var flaggedCount = data.sites.filter(function (s) { return s.studyId === study.id; }).filter(function (site) {
          var snap = G.latestFinalizedSnapshotForStudy(data.snapshots, study.id);
          var r = data.kriResults.filter(function (x) { return x.siteId === site.id && x.kriCode === k.code && x.snapshotId === snap.id; })[0];
          return r && r.status !== 'ok' && r.status !== 'insufficient';
        }).length;
        return '<div class="card-head" style="padding:6px 0;border-bottom:1px solid var(--c-border)">' +
          '<div><b>' + k.name + '</b><div class="muted" style="font-size:10.5px">' + k.validation + (k.active ? ', ' + flaggedCount + ' sites flagged' : '') + '</div></div>' +
          '<label style="display:flex;align-items:center;gap:5px;font-size:11px"><input type="checkbox" class="kri-active-toggle" data-code="' + k.code + '" ' + (k.active ? 'checked' : '') + '> Active</label>' +
          '</div>';
      }).join('');
      document.querySelectorAll('.kri-active-toggle').forEach(function (cb) {
        cb.addEventListener('change', function () {
          STORE.patch('kriThresholds', cb.dataset.code, { active: cb.checked });
          STORE.logAudit('KRIDefinition', cb.dataset.code, null, cb.checked ? 'Activated' : 'Deactivated');
          global.RBQM_TOAST.show((cb.checked ? 'Activated ' : 'Deactivated ') + KRI.byCode(cb.dataset.code).name);
          global.location.reload();
        });
      });
    }
  }

  function tile(value, label) { return '<div><div style="font-size:15px;font-weight:700">' + value + '</div><div class="muted" style="font-size:10.5px">' + label + '</div></div>'; }

  global.RBQM_PAGE_STUDY_DETAIL = { render: render };
})(window);
