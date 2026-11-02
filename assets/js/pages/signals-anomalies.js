/* Data anomalies tab on Signals (Addendum v0.5, item 5): 8 seeded statistical anomalies and 3 visibility gaps.
   Create signal adds one persisted signal of type Data anomaly (counts update only then); Dismiss needs a reason;
   Mark under review is reversible by the next action. Anomalies need human review and do not imply misconduct. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;
  var SIG = global.RBQM_SIGNALS;
  var TERMS = { 'Digit preference': 1 };
  var TONE = { 'New': 'watch', 'Under review': 'watch', 'Dismissed': 'insufficient', 'Signal created': 'ok' };

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function siteLabel(data, id) { var s = data.sites.filter(function (x) { return x.id === id; })[0]; return s ? 'Site ' + s.code : id; }

  function rows(data) { return data.anomalies.rows.map(function (a) { return SIG.effectiveAnomaly(a, STORE); }); }

  function html(data) {
    var list = rows(data), gaps = data.anomalies.visibilityGaps;
    var body = list.map(function (a) {
      var done = a.status === 'Dismissed' || a.status === 'Signal created';
      return '<tr><td>' + siteLabel(data, a.siteId) + '</td><td>' + (TERMS[a.type] ? '<span data-term="' + a.type + '">' + a.type + '</span>' : esc(a.type)) + '</td><td>' + esc(a.variable) + '</td><td>' + esc(a.evidence) + '</td>' +
        '<td><b>' + a.score + '</b></td><td><span class="status-pill status-' + TONE[a.status] + '">' + a.status + '</span>' + (a.dismissReason && a.status === 'Dismissed' ? '<div class="muted" style="font-size:10px">' + esc(a.dismissReason) + '</div>' : '') + '</td>' +
        '<td>' + (done ? '–' : '<button class="btn btn-sm an-create" data-id="' + a.id + '">Create signal</button> <button class="btn btn-sm an-review" data-id="' + a.id + '">Mark under review</button> <button class="btn btn-sm an-dismiss" data-id="' + a.id + '">Dismiss</button>') + '</td></tr>';
    }).join('');
    return '<div class="banner banner-ai" style="margin:8px 0"><span aria-hidden="true">&#10022;</span><div><b>Anomalies need human review.</b> They are statistical patterns, not findings, and do not imply misconduct.</div></div>' +
      '<div class="card-title" data-help="Statistical checks on entered data that look for patterns a reviewer should explain." data-term="Data anomaly">Data anomalies</div>' +
      '<div class="card-subtitle">' + list.length + ' anomalies, ' + list.filter(function (a) { return a.status === 'New'; }).length + ' new. A signal is only created when you choose to.</div>' +
      '<table class="table"><thead><tr><th class="no-sort">Site</th><th class="no-sort">Type</th><th class="no-sort">Variable</th><th class="no-sort">Evidence</th><th class="no-sort">Anomaly score</th><th class="no-sort">Status</th><th class="no-sort"></th></tr></thead><tbody>' + body + '</tbody></table>' +
      '<div style="margin-top:12px;font-size:12px"><b data-term="Visibility gap">Visibility gaps:</b> ' + gaps.length + ' sites have too little data to test.</div>' +
      '<table class="table" style="margin-top:4px"><tbody>' + gaps.map(function (g) {
        return '<tr><td>' + siteLabel(data, g.siteId) + '</td><td><span class="status-pill status-insufficient">Insufficient data</span></td><td class="muted">' + esc(g.reason) + ' Not tested, so not a pass.</td></tr>';
      }).join('') + '</tbody></table>';
  }

  function setStatus(a, patch, action) {
    STORE.patch('notes', 'anom-' + a.id, patch);
    STORE.logAudit('DataAnomaly', a.id, 'U-001', action);
  }

  function createSignal(data, a) {
    var ov = STORE.get('signals') || {}, n = Object.keys(ov).filter(function (k) { return ov[k].custom; }).length + 1;
    var id = 'SIG-A' + String(n).padStart(3, '0'), site = data.sites.filter(function (s) { return s.id === a.siteId; })[0];
    var snap = global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(data.snapshots, site.studyId), d = global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.ASOF);
    STORE.patch('signals', id, { id: id, custom: true, type: 'Data anomaly', variable: a.variable, anomalyId: a.id, siteId: a.siteId, studyId: a.studyId, kriCode: 'data_anomaly', snapshotId: snap.id,
      severity: a.score >= 70 ? 'action' : 'watch', status: 'New', description: 'Data anomaly (' + a.type.toLowerCase() + ') in ' + a.variable.toLowerCase() + ': ' + a.evidence, created: d, updated: d, ownerId: null, history: [] });
    setStatus(a, { status: 'Signal created', signalId: id }, 'Signal ' + id + ' created from anomaly ' + a.id);
    return id;
  }

  function bind(el, data, redraw) {
    var byId = function (id) { return rows(data).filter(function (a) { return a.id === id; })[0]; };
    el.querySelectorAll('.an-create').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = byId(b.getAttribute('data-id'));
        global.RBQM_MODAL.open({ title: 'Create signal', subtitle: siteLabel(data, a.siteId) + ', ' + a.variable, confirmLabel: 'Create signal',
          bodyHtml: '<p style="font-size:12px">This adds a signal of type Data anomaly to the Signals list and counts it as open. ' + esc(a.evidence) + '</p>',
          onConfirm: function () { var id = createSignal(data, a); SIG.applyCustom(data, STORE); global.RBQM_TOAST.show('Signal ' + id + ' created'); redraw(); return true; } });
      });
    });
    el.querySelectorAll('.an-review').forEach(function (b) {
      b.addEventListener('click', function () { var a = byId(b.getAttribute('data-id')); setStatus(a, { status: 'Under review' }, 'Marked under review'); global.RBQM_TOAST.show('Marked under review'); redraw(); });
    });
    el.querySelectorAll('.an-dismiss').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = byId(b.getAttribute('data-id'));
        global.RBQM_MODAL.open({ title: 'Dismiss anomaly', confirmLabel: 'Dismiss', subtitle: siteLabel(data, a.siteId) + ', ' + a.variable,
          bodyHtml: '<div class="field"><label>Reason</label><textarea class="text-input" id="anReason" rows="3"></textarea><div class="error" id="anErr" hidden>Enter a reason before dismissing</div></div>',
          onConfirm: function (m) {
            var v = m.querySelector('#anReason').value.trim();
            if (!v) { m.querySelector('#anErr').hidden = false; return false; }
            setStatus(a, { status: 'Dismissed', dismissReason: v }, 'Dismissed: ' + v); global.RBQM_TOAST.show('Anomaly dismissed'); redraw(); return true;
          } });
      });
    });
  }

  global.RBQM_ANOMALIES = { html: html, bind: bind, rows: rows };
})(window);
