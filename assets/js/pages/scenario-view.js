/* Scenario view: what-if panel (site closure, enrollment slip, CRO change, threshold change).
   Site closure and threshold change recompute from the real data layer; the other two give a
   computed, labeled-illustrative estimate (noted in DECISIONS.md). */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var G = global.RBQM_GENERATOR;

  function render(contentEl, data) {
    var scenario = 'site_closure';

    function draw() {
      contentEl.innerHTML =
        '<div class="card"><div class="card-title">What-if</div>' +
        '<div class="field"><label>Scenario type</label><select class="select-input" id="scenarioType">' +
        '<option value="site_closure">A site closes</option><option value="enrollment_slip">Enrollment slips</option>' +
        '<option value="cro_change">CRO performance changes</option><option value="threshold_change">Threshold change</option>' +
        '</select></div>' +
        '<div id="scenarioParams"></div>' +
        '<button class="btn btn-primary" id="runScenarioBtn" style="margin-top:8px">Run scenario</button>' +
        '</div><div style="height:10px"></div><div id="scenarioResult"></div>';

      document.getElementById('scenarioType').value = scenario;
      renderParams();
      document.getElementById('scenarioType').addEventListener('change', function (e) { scenario = e.target.value; renderParams(); });
      document.getElementById('runScenarioBtn').addEventListener('click', run);
    }

    function renderParams() {
      var el = document.getElementById('scenarioParams');
      if (scenario === 'site_closure') {
        el.innerHTML = '<div class="field"><label>Site</label><select class="select-input" id="pSite">' +
          data.sites.filter(function (s) { return s.status === 'active'; }).map(function (s) { return '<option value="' + s.id + '">Site ' + s.code + ', ' + s.country + '</option>'; }).join('') + '</select></div>';
      } else if (scenario === 'enrollment_slip') {
        el.innerHTML = '<div class="field"><label>Months of slip</label><input class="text-input" id="pMonths" type="number" value="2" min="1" max="12"></div>';
      } else if (scenario === 'cro_change') {
        el.innerHTML = '<div class="field"><label>CRO</label><select class="select-input" id="pCro">' + data.cros.map(function (c) { return '<option value="' + c.id + '">' + c.name + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>Performance drop (%)</label><input class="text-input" id="pDrop" type="number" value="10" min="1" max="50"></div>';
      } else {
        el.innerHTML = '<div class="field"><label>Indicator</label><select class="select-input" id="pKri">' + KRI.KRIS.filter(function (k) { return k.active; }).map(function (k) { return '<option value="' + k.code + '">' + k.name + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label>New red threshold</label><input class="text-input" id="pRed" type="number" step="0.01"></div>';
      }
    }

    function run() {
      var resultEl = document.getElementById('scenarioResult');
      if (scenario === 'site_closure') resultEl.innerHTML = runSiteClosure();
      else if (scenario === 'threshold_change') resultEl.innerHTML = runThresholdChange();
      else if (scenario === 'enrollment_slip') resultEl.innerHTML = runEnrollmentSlip();
      else resultEl.innerHTML = runCroChange();
      global.RBQM_TOAST.show('Scenario run. Compare the projected effect below.');
    }

    function runSiteClosure() {
      var siteId = document.getElementById('pSite').value;
      var site = data.sites.filter(function (s) { return s.id === siteId; })[0];
      var snap = G.latestFinalizedSnapshotForStudy(data.snapshots, site.studyId);
      var risk = data.siteRisk.filter(function (r) { return r.siteId === siteId && r.snapshotId === snap.id; })[0];
      var openSignalsAtSite = data.signals.filter(function (s) { return s.siteId === siteId && global.RBQM_SIGNALS.isOpen(s.status); }).length;
      var wasHighRisk = risk && risk.band === 'high';
      var baselineHighRisk = data.summary.highRiskSites, baselineSignals = data.summary.openSignals;
      return compareCard('Site ' + site.code + ' closes', [
        ['High-risk sites', baselineHighRisk, baselineHighRisk - (wasHighRisk ? 1 : 0)],
        ['Open signals', baselineSignals, baselineSignals - openSignalsAtSite],
        ['Subjects to transfer', 0, data.subjects.filter(function (s) { return s.siteId === siteId; }).length]
      ], 'Monitoring plan: this site’s visit would be removed from the schedule.');
    }

    function runThresholdChange() {
      var code = document.getElementById('pKri').value;
      var red = parseFloat(document.getElementById('pRed').value);
      var kriDef = KRI.byCode(code);
      if (isNaN(red)) return '<div class="card"><p class="muted">Enter a red threshold.</p></div>';
      var snap = null;
      var changed = [];
      data.studies.forEach(function (study) {
        var s = G.latestFinalizedSnapshotForStudy(data.snapshots, study.id);
        data.kriResults.filter(function (r) { return r.kriCode === code && r.snapshotId === s.id; }).forEach(function (r) {
          var newStatus = r.value > red ? 'action' : (r.value > kriDef.amber ? 'watch' : 'ok');
          if (newStatus !== r.status) changed.push(r);
        });
      });
      return compareCard('Tighten ' + kriDef.name + ' to ' + red, [
        ['Sites changing status', 0, changed.length]
      ], changed.slice(0, 5).map(function (r) { var site = data.sites.filter(function (s) { return s.id === r.siteId; })[0]; return 'Site ' + site.code + ': ' + r.status + ' → new status'; }).join('<br>'));
    }

    function runEnrollmentSlip() {
      var months = parseInt(document.getElementById('pMonths').value, 10);
      return compareCard(months + '-month enrollment slip', [
        ['Forecast window shifts by (days)', 0, months * 30],
        ['Monitoring visits pushed out', 0, Math.round(data.sites.length * 0.4)]
      ], 'Illustrative: exposure accrues ' + months + ' months later, so forecasts and visit due dates shift by the same amount.');
    }

    function runCroChange() {
      var croId = document.getElementById('pCro').value;
      var drop = parseInt(document.getElementById('pDrop').value, 10);
      var cro = data.cros.filter(function (c) { return c.id === croId; })[0];
      var affectedSites = data.sites.filter(function (s) { return s.croId === croId && s.status === 'active'; });
      var estNewSignals = Math.round(affectedSites.length * (drop / 100) * 0.3);
      return compareCard(cro.name + ' performance drops ' + drop + '%', [
        ['Sites affected', 0, affectedSites.length],
        ['Estimated new signals (illustrative)', 0, estNewSignals]
      ], 'Illustrative: a ' + drop + '% drop in query response and entry timeliness would likely push some of ' + cro.name + '’s ' + affectedSites.length + ' sites into watch or action.');
    }

    function compareCard(title, rows, note) {
      return '<div class="card"><div class="card-title">' + title + '</div><div class="card-subtitle">Compare scenario vs baseline</div>' +
        '<table class="table"><thead><tr><th class="no-sort"></th><th class="no-sort">Baseline</th><th class="no-sort">Scenario</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td><b>' + r[2] + '</b></td></tr>'; }).join('') +
        '</tbody></table><p class="muted" style="font-size:11px;margin-top:8px">' + note + '</p></div>';
    }

    draw();
  }

  global.RBQM_PAGE_SCENARIO_VIEW = { render: render };
})(window);
