/* Quality limits (QTL): board with current vs limit, forecast, outcome; excursion workflow
   with impact assessment note; history of runs. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var FORECAST = global.RBQM_FORECAST;

  function render(contentEl, data) {
    draw();

    function draw() {
      var breached = data.qtlDefs.filter(function (d) { return d.outcome === 'Breached'; }).length;
      var near = data.qtlDefs.filter(function (d) { return d.outcome === 'Near'; }).length;
      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div>' +
        '<b>' + breached + ' limit is breached and ' + near + ' are close.</b></div></div>' +
        '<div style="height:10px"></div>' +
        data.studies.map(studySection).join('');

      document.querySelectorAll('.impact-assessment-btn').forEach(function (b) {
        b.addEventListener('click', function () { openImpactModal(b.dataset.id); });
      });
      document.querySelectorAll('.qtl-history-btn').forEach(function (b) {
        b.addEventListener('click', function () { openHistory(b.dataset.id); });
      });
    }

    function studySection(study) {
      var defs = data.qtlDefs.filter(function (d) { return d.studyId === study.id; });
      return '<div class="card" style="margin-bottom:10px"><div class="card-title">' + study.id + ' - ' + study.title + '</div>' +
        defs.map(qtlRow).join('') + '</div>';
    }

    function qtlRow(def) {
      var runs = data.qtlRuns.filter(function (r) { return r.qtlId === def.id; });
      var history = runs.map(function (r, i) { return { snapshotIndex: i, value: r.value }; });
      var forecast = FORECAST.forecastBreach(history, def.limit, 'high');
      var pct = Math.min(100, (def.currentValue / def.limit) * 100);
      var tone = def.outcome === 'Breached' ? 'action' : def.outcome === 'Near' ? 'watch' : 'ok';
      var note = STORE.get('notes', 'qtl-' + def.id);
      return '<div style="padding:10px 0;border-bottom:1px solid var(--c-border)">' +
        '<div class="card-head"><div><b>' + def.parameter + '</b><div class="muted" style="font-size:10.5px">' + FMT.pct(def.currentValue, 1) + ' of ' + FMT.pct(def.limit, 0) + ' limit, early warning at ' + FMT.pct(def.warning, 1) + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px"><span class="status-pill status-' + tone + '">' + def.outcome + '</span>' +
        '<span class="muted" style="font-size:10.5px">' + Math.round(forecast.probability * 100) + '% breach chance (60d)</span>' +
        '<button class="btn btn-sm qtl-history-btn" data-id="' + def.id + '">History</button>' +
        (def.outcome !== 'Within limit' ? '<button class="btn btn-sm impact-assessment-btn" data-id="' + def.id + '">Impact assessment</button>' : '') +
        '</div></div>' +
        '<div style="position:relative;height:8px;background:var(--c-panel);border-radius:4px;margin-top:6px">' +
        '<div style="position:absolute;left:0;top:0;height:100%;width:' + pct + '%;background:' + (tone === 'action' ? 'var(--c-action-fill)' : tone === 'watch' ? 'var(--c-watch-fill)' : 'var(--c-ok-fill)') + ';border-radius:4px"></div>' +
        '<div style="position:absolute;left:75%;top:-2px;height:12px;border-left:1px solid var(--c-text-600)"></div></div>' +
        (note ? '<p class="muted" style="font-size:10.5px;margin-top:6px">Impact assessment: ' + note.text + '</p>' : '') +
        '</div>';
    }

    function openImpactModal(id) {
      var def = data.qtlDefs.filter(function (d) { return d.id === id; })[0];
      global.RBQM_MODAL.open({
        title: 'Impact assessment: ' + def.parameter, confirmLabel: 'Save',
        bodyHtml: '<div class="field"><label>Assessment note</label><textarea class="text-input" id="impactNote" rows="4" placeholder="Describe the systemic impact and planned Quality review."></textarea></div>',
        onConfirm: function (modalEl) {
          var val = modalEl.querySelector('#impactNote').value.trim();
          if (!val) return false;
          STORE.patch('notes', 'qtl-' + id, { text: val, date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF) });
          STORE.logAudit('QTLDefinition', id, null, 'Impact assessment recorded');
          global.RBQM_TOAST.show('Impact assessment saved');
          draw(); return true;
        }
      });
    }

    function openHistory(id) {
      var def = data.qtlDefs.filter(function (d) { return d.id === id; })[0];
      var runs = data.qtlRuns.filter(function (r) { return r.qtlId === id; });
      global.RBQM_MODAL.open({
        title: def.parameter + ' - history', cancelLabel: false, confirmLabel: 'Close',
        bodyHtml: runs.map(function (r) {
          var snap = data.snapshots.filter(function (s) { return s.id === r.snapshotId; })[0];
          return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--c-border);font-size:12px">' +
            '<span>' + (snap ? FMT.dateShort(snap.date) : r.snapshotId) + '</span><span>' + FMT.pct(r.value, 2) + ' - ' + r.outcome + '</span></div>';
        }).join('')
      });
    }
  }

  global.RBQM_PAGE_QUALITY_LIMITS = { render: render };
})(window);
