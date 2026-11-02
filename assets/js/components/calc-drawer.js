/* "Show calculation" drawer (Addendum v0.4, item 3). One shared component: any element with
   data-calc="<metric id>" opens it (delegated, so pages only need to render RBQM_CALC.link(id)). */
(function (global) {
  'use strict';
  var CALC = global.RBQM_CALC;
  var STORE = global.RBQM_STORE;

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function rows(list) {
    return list.map(function (i) { return '<tr><td>' + esc(i.label) + '</td><td style="text-align:right"><b>' + esc(i.value) + '</b></td></tr>'; }).join('');
  }

  function bodyHtml(c) {
    return '<div class="drawer-head"><div><div class="card-title">' + esc(c.title) + '</div><div class="muted" style="font-size:10.5px">' + esc(c.subtitle) + '</div></div>' +
      '<button class="btn btn-ghost" data-act="close" aria-label="Close">&times;</button></div>' +
      '<div class="drawer-body">' +
      '<div class="calc-result"><span class="muted">' + esc(c.resultLabel) + '</span><span class="calc-result-value">' + esc(c.resultValue) + '</span></div>' +
      '<div class="calc-section"><b>Formula</b><p>' + esc(c.formula) + '</p></div>' +
      '<div class="calc-section"><b>Inputs at this snapshot</b><table class="calc-table">' + rows(c.inputs) + '</table></div>' +
      (c.thresholds.length ? '<div class="calc-section"><b>Thresholds</b><table class="calc-table">' + rows(c.thresholds) + '</table></div>' : '') +
      '<div class="calc-section"><b>Data sources</b><p>' + c.sources.map(esc).join(', ') + '</p></div>' +
      (c.note ? '<p class="muted" style="font-size:10.5px">' + esc(c.note) + '</p>' : '') +
      '<p class="muted" style="font-size:10.5px">Synthetic data. Not validated for regulated use.</p></div>' +
      '<div class="drawer-foot"><button class="btn" data-act="copy">Copy as text</button><button class="btn btn-primary" data-act="report">Add to report</button></div>';
  }

  function copyText(text) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve) {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) { /* clipboard blocked; the toast still reports the attempt */ }
      ta.remove(); resolve();
    });
  }

  function open(id) {
    var c = CALC.resolve(id);
    if (!c) { global.RBQM_TOAST.show('No calculation is available for this value'); return; }
    global.RBQM_DRAWER.open({
      bodyHtml: bodyHtml(c),
      onMount: function (el, close) {
        el.querySelector('[data-act="close"]').addEventListener('click', close);
        el.querySelector('[data-act="copy"]').addEventListener('click', function () {
          copyText(CALC.toText(c)).then(function () { global.RBQM_TOAST.show('Copied as text'); });
        });
        el.querySelector('[data-act="report"]').addEventListener('click', function () {
          var body = el.querySelector('.drawer-body').innerHTML;
          STORE.push('reportItems', { id: 'RPT-' + Date.now(), title: 'Calculation - ' + c.title, date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF), body: body });
          STORE.logAudit('Report', c.id, null, 'Calculation added to saved reports');
          global.RBQM_TOAST.show('Added to report');
        });
      }
    });
  }

  // ---- Savings calculator ("Model your monitoring effort", Dashboard ROI widget) ----
  var FIELDS = [['sites', 'Sites', 1, 1000, 1], ['subjectsPerSite', 'Subjects per site', 1, 500, 1], ['visitsPerSubject', 'Visits per subject', 1, 100, 1],
    ['costPerVisitUsd', 'Cost per on-site visit (USD)', 0, 200000, 500], ['currentSdvPct', 'Current SDV (%)', 0, 100, 5], ['targetSdvPct', 'Target SDV (%)', 0, 100, 5]];

  function readInputs(el) {
    var cur = Object.assign({}, global.RBQM_DATA.savingsDefaults, STORE.get('notes', 'savings-inputs'));
    FIELDS.forEach(function (f) {
      var v = el ? parseFloat(el.querySelector('#sv-' + f[0]).value) : cur[f[0]];
      cur[f[0]] = isNaN(v) ? cur[f[0]] : Math.max(f[2], Math.min(f[3], v));
    });
    return cur;
  }

  function openSavings() {
    var d = global.RBQM_DATA, inputs = readInputs(null), FMT = global.RBQM_FORMAT;
    global.RBQM_DRAWER.open({
      bodyHtml: '<div class="drawer-head"><div><div class="card-title">Model your monitoring effort</div><div class="muted" style="font-size:10.5px">Same formulas as the Monitoring plan impact panel. Synthetic estimate.</div></div>' +
        '<button class="btn btn-ghost" data-act="close" aria-label="Close">&times;</button></div><div class="drawer-body">' +
        FIELDS.map(function (f) { return '<div class="field"><label for="sv-' + f[0] + '">' + f[1] + '</label><input class="text-input" id="sv-' + f[0] + '" type="number" min="' + f[2] + '" max="' + f[3] + '" step="' + f[4] + '" value="' + inputs[f[0]] + '"></div>'; }).join('') +
        '<div class="calc-section"><b>Results</b><table class="calc-table"><tr><td>On-site visits avoided</td><td style="text-align:right"><b id="sv-out-visits"></b></td></tr>' +
        '<tr><td>Cost saved</td><td style="text-align:right"><b id="sv-out-cost"></b></td></tr><tr><td>SDV effort saved</td><td style="text-align:right"><b id="sv-out-hours"></b></td></tr></table></div></div>' +
        '<div class="drawer-foot"><button class="btn" data-act="reset">Reset to defaults</button><button class="btn" data-act="save">Save inputs</button><button class="btn btn-primary" data-act="report">Add to report</button></div>',
      onMount: function (el, close) {
        function update() {
          var o = CALC.savings(readInputs(el));
          el.querySelector('#sv-out-visits').textContent = FMT.int(o.visitsAvoided);
          el.querySelector('#sv-out-cost').textContent = FMT.usd(o.costSavedUsd);
          el.querySelector('#sv-out-hours').textContent = FMT.int(o.sdvHoursSaved) + ' h';
          return o;
        }
        FIELDS.forEach(function (f) { el.querySelector('#sv-' + f[0]).addEventListener('input', update); });
        update();
        el.querySelector('[data-act="close"]').addEventListener('click', close);
        el.querySelector('[data-act="reset"]').addEventListener('click', function () {
          FIELDS.forEach(function (f) { el.querySelector('#sv-' + f[0]).value = d.savingsDefaults[f[0]]; });
          STORE.remove('notes', 'savings-inputs'); update(); global.RBQM_TOAST.show('Inputs reset to defaults');
        });
        el.querySelector('[data-act="save"]').addEventListener('click', function () {
          STORE.patch('notes', 'savings-inputs', readInputs(el));
          STORE.logAudit('SavingsModel', 'savings', null, 'Savings inputs saved');
          global.RBQM_TOAST.show('Inputs saved');
        });
        el.querySelector('[data-act="report"]').addEventListener('click', function () {
          var i = readInputs(el), o = update();
          var body = '<h3>Monitoring effort model</h3><p>' + FIELDS.map(function (f) { return f[1] + ': ' + i[f[0]]; }).join('; ') + '.</p>' +
            '<p>On-site visits avoided: ' + FMT.int(o.visitsAvoided) + '. Cost saved: ' + FMT.usd(o.costSavedUsd) + '. SDV effort saved: ' + FMT.int(o.sdvHoursSaved) + ' h.</p><p>Synthetic estimate.</p>';
          STORE.push('reportItems', { id: 'RPT-' + Date.now(), title: 'Monitoring effort model', date: global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF), body: body });
          STORE.logAudit('Report', 'savings', null, 'Savings model added to saved reports');
          global.RBQM_TOAST.show('Added to report');
        });
      }
    });
  }

  document.addEventListener('click', function (e) {
    var sv = e.target.closest ? e.target.closest('[data-savings]') : null;
    if (sv) { e.preventDefault(); openSavings(); return; }
    var t = e.target.closest ? e.target.closest('[data-calc]') : null;
    if (!t) return;
    e.preventDefault();
    open(t.getAttribute('data-calc'));
  });

  global.RBQM_CALC_DRAWER = { open: open, openSavings: openSavings };
})(window);
