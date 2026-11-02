/* Protocol intelligence (Addendum v0.4, item 1): simulated, pre-analysed protocol for CV-5645.
   Complexity score with six drivers, CtQ factors with their protocol section, predicted deviation
   hot spots with "Add control" (creates a Draft risk), comparison with the portfolio median and an
   AI note. No upload; the analysis comes from data.protocolAnalysis and is the same on every re-run. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var STORE = global.RBQM_STORE;
  var LIB = global.RBQM_RISK_LIBRARY;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function ctqName(data, id) { var c = data.ctqFactors.filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
  function riskId(h) { return 'R-PI-' + h.id; }
  function added(h) { return !!STORE.get('risks', riskId(h)); }

  function render(contentEl, data) {
    var a = data.protocolAnalysis;
    var running = false;

    function driversHtml() {
      return a.drivers.map(function (d) {
        return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11.5px"><span><b>' + d.label + '</b> <span class="muted">' + esc(d.detail) + '</span></span><span>' + d.points + ' of ' + d.max + '</span></div>' +
          '<div style="height:7px;background:var(--c-panel);border-radius:4px;margin-top:3px"><div style="height:100%;width:' + Math.round(d.points / d.max * 100) + '%;background:var(--c-blue-400);border-radius:4px"></div></div></div>';
      }).join('');
    }

    function complexityHtml() {
      var diff = a.complexityScore - a.portfolioMedian;
      return '<div class="card"><div class="card-head"><div><div class="card-title" data-term="Protocol complexity">Protocol complexity</div>' +
        '<div class="card-subtitle">' + a.studyId + ', protocol ' + a.protocolVersion + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:26px;font-weight:700">' + a.complexityScore + '<span class="muted" style="font-size:13px"> / 100</span></div>' +
        '<div class="muted" style="font-size:10.5px">Portfolio median ' + a.portfolioMedian + ', ' + (diff >= 0 ? diff + ' points higher' : Math.abs(diff) + ' points lower') + '</div></div></div>' +
        '<div style="position:relative;height:10px;background:var(--c-panel);border-radius:5px;margin:4px 0 12px" title="The marker shows the portfolio median">' +
        '<div style="height:100%;width:' + a.complexityScore + '%;background:' + (diff > 10 ? 'var(--c-watch-fill)' : 'var(--c-ok-fill)') + ';border-radius:5px"></div>' +
        '<div style="position:absolute;left:' + a.portfolioMedian + '%;top:-3px;height:16px;border-left:2px solid var(--c-text-600)"></div></div>' +
        driversHtml() + '</div>';
    }

    function ctqHtml() {
      return '<div class="card"><div class="card-title">Critical to quality factors identified</div><div class="card-subtitle">Each factor with the protocol section it came from.</div>' +
        a.ctq.map(function (c) {
          return '<div class="card-head" style="padding:7px 0;border-bottom:1px solid var(--c-border)"><div><b>' + ctqName(data, c.ctqId) + '</b>' +
            '<div class="muted" style="font-size:10.5px">' + esc(c.section) + '</div><div style="font-size:11.5px">' + esc(c.note) + '</div></div>' +
            '<a class="ai-chip" href="risk-register.html?tab=ctq" title="Open the CtQ traceability tab">Linked to ' + ctqName(data, c.ctqId) + '</a></div>';
        }).join('') + '</div>';
    }

    function hotSpotsHtml() {
      return '<div class="card"><div class="card-title">Predicted deviation hot spots</div><div class="card-subtitle">Top 5 by probability. Add a control to create a draft risk.</div>' +
        a.hotSpots.map(function (h) {
          var k = KRI.byCode(h.kriCode), p = Math.round(h.probability * 100);
          return '<div style="padding:8px 0;border-bottom:1px solid var(--c-border)"><div class="card-head"><div><b>' + esc(h.title) + '</b>' +
            '<div class="muted" style="font-size:11px">' + esc(h.reason) + '</div>' +
            '<div style="font-size:11px;margin-top:2px">Watched by: <a href="kri-detail.html?kri=' + h.kriCode + '">' + (k ? k.name : h.kriCode) + '</a>' + (k && !k.active ? ' <span class="status-pill status-inactive">Inactive</span>' : '') + '</div></div>' +
            '<div style="text-align:right;min-width:120px"><div style="font-weight:700">' + p + '%</div><div class="muted" style="font-size:10.5px">probability</div>' +
            (added(h) ? '<span class="status-pill status-ok">Control added</span>' : '<button class="btn btn-sm add-control-btn" data-id="' + h.id + '">Add control</button>') + '</div></div>' +
            '<div style="height:6px;background:var(--c-panel);border-radius:3px;margin-top:5px"><div style="height:100%;width:' + p + '%;background:' + (p >= 60 ? 'var(--c-action-fill)' : 'var(--c-watch-fill)') + ';border-radius:3px"></div></div></div>';
        }).join('') + '</div>';
    }

    function draw() {
      contentEl.innerHTML =
        '<div class="card-head" style="margin-bottom:8px"><div class="card-subtitle">Simulated analysis of a synthetic protocol. No file is uploaded.</div>' +
        '<div style="display:flex;gap:6px"><button class="btn" id="piRerun">Re-run analysis</button><button class="btn" id="piExport">Export summary</button><button class="btn btn-primary" id="piReport">Add to report</button></div></div>' +
        '<div id="piProgress" hidden style="margin-bottom:8px"><div class="muted" style="font-size:11px">Analysing the protocol...</div><div style="height:6px;background:var(--c-panel);border-radius:3px"><div id="piBar" style="height:100%;width:0;background:var(--c-sky-600);border-radius:3px;transition:width 2s linear"></div></div></div>' +
        '<div id="piBody"><div class="grid grid-main-side"><div>' + complexityHtml() + '<div style="height:10px"></div>' + hotSpotsHtml() + '</div>' +
        '<div>' + ctqHtml() + '<div style="height:10px"></div>' +
        '<div class="banner banner-ai"><span aria-hidden="true">&#10022;</span><div><b>AI note</b> <span class="ai-label"><span aria-hidden="true">&#10022;</span> AI-assisted</span><br>' + esc(a.aiNote) + '</div></div></div></div></div>';
      document.getElementById('piRerun').addEventListener('click', rerun);
      document.getElementById('piExport').addEventListener('click', function () { global.print(); });
      document.getElementById('piReport').addEventListener('click', addToReport);
      contentEl.querySelectorAll('.add-control-btn').forEach(function (b) { b.addEventListener('click', function () { addControl(b.getAttribute('data-id')); }); });
    }

    function rerun() {
      if (running) return;
      running = true;
      var prog = document.getElementById('piProgress'), bar = document.getElementById('piBar'), btn = document.getElementById('piRerun');
      prog.hidden = false; btn.disabled = true;
      setTimeout(function () { bar.style.width = '100%'; }, 20);
      setTimeout(function () {
        running = false;
        STORE.logAudit('ProtocolAnalysis', a.studyId, null, 'Analysis re-run (same result)');
        draw();
        global.RBQM_TOAST.show('Analysis re-run. The result is unchanged.');
      }, 2000);
    }

    function addControl(id) {
      var h = a.hotSpots.filter(function (x) { return x.id === id; })[0];
      global.RBQM_MODAL.open({
        title: 'Add control', subtitle: h.title, confirmLabel: 'Create draft risk',
        bodyHtml: '<p style="font-size:12px">This creates a draft risk in the Risk register for ' + a.studyId + ', linked to ' + ctqName(data, h.ctqId) + ' and watched by ' + (KRI.byCode(h.kriCode) ? KRI.byCode(h.kriCode).name : h.kriCode) + '. You can edit it there.</p>',
        onConfirm: function () {
          LIB.createDraftRisk({ id: riskId(h), studyId: a.studyId, description: 'Predicted hot spot: ' + h.title, probability: Math.round(h.probability * 5), impact: 3, ctqId: h.ctqId, kriCodes: [h.kriCode] });
          global.RBQM_TOAST.show('Draft risk created');
          draw(); return true;
        }
      });
    }

    function addToReport() {
      var body = '<h3>Protocol intelligence, ' + a.studyId + '</h3><p>Complexity ' + a.complexityScore + ' of 100 (portfolio median ' + a.portfolioMedian + ').</p><ul>' +
        a.drivers.map(function (d) { return '<li>' + d.label + ': ' + d.points + ' of ' + d.max + '</li>'; }).join('') + '</ul><p>Top hot spots: ' +
        a.hotSpots.map(function (h) { return esc(h.title) + ' (' + Math.round(h.probability * 100) + '%)'; }).join('; ') + '.</p><p>Synthetic data. Not validated for regulated use.</p>';
      STORE.push('reportItems', { id: 'RPT-' + Date.now(), title: 'Protocol intelligence - ' + a.studyId, date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF), body: body });
      STORE.logAudit('Report', 'protocol-intelligence', null, 'Added to saved reports');
      global.RBQM_TOAST.show('Added to report');
    }

    draw();
  }

  global.RBQM_PAGE_PROTOCOL_INTELLIGENCE = { render: render };
})(window);
