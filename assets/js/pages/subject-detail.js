/* Subject drill-down (sub-page, reached from Site profile). Timeline lanes (visits, deviations, dosing,
   concomitant medications, adverse events), Vitals and labs panel, and an AI review card per AE/SAE.
   Dosing, vitals and AI review exist only for Site 114 subjects and three Safety review subjects. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;
  var STORE = global.RBQM_STORE;
  var G = function () { return global.RBQM_GENERATOR; };
  var charts = [];
  var PERIODS = [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['full', 'Full history']];
  var LANES = [['visit', 'Visits'], ['deviation', 'Deviations'], ['dosing', 'Dosing'], ['conmed', 'Concomitant medications'], ['ae', 'Adverse events']];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function today() { return G().iso(G().ASOF); }

  function render(contentEl, data) {
    var subjectId = ROUTER.get('subject');
    var subject = data.subjects.filter(function (s) { return s.id === subjectId; })[0] || data.subjects[0];
    var site = data.sites.filter(function (s) { return s.id === subject.siteId; })[0];
    var visits = data.visits.filter(function (v) { return v.subjectId === subject.id; }).sort(function (a, b) { return a.plannedDate < b.plannedDate ? -1 : 1; });
    var deviations = data.deviations.filter(function (d) { return d.subjectId === subject.id; });
    var aes = data.adverseEvents.filter(function (e) { return e.subjectId === subject.id; });
    var med = data.medical.bySubject[subject.id] || null;
    var state = { type: 'all', period: 'weekly', pending: null };

    function events() {
      var ev = visits.map(function (v) {
        return { type: 'visit', date: v.plannedDate, label: v.name, detail: v.missed ? 'Missed' : ('Actual ' + FMT.dateShort(v.actualDate) + ', entered ' + (v.entryDate ? FMT.dateShort(v.entryDate) : '–')), status: v.missed ? 'action' : 'ok' };
      });
      ev = ev.concat(deviations.map(function (d) {
        return { type: 'deviation', date: d.date, label: d.category, detail: d.importance + ' · ' + d.status, status: d.importance === 'Critical' ? 'action' : d.importance === 'Major' ? 'watch' : 'ok' };
      }));
      aes.forEach(function (e) { ev.push({ type: 'ae', date: e.onset, label: e.term, detail: (e.serious ? 'SAE' : 'AE') + ' · ' + e.severity + ' · ' + e.relatedness, status: e.serious ? 'action' : 'watch' }); });
      if (med) {
        med.dosing.forEach(function (d) { ev.push({ type: 'dosing', date: d.date, label: 'Dose ' + d.doseMg + ' mg', detail: d.status, status: d.status === 'Administered' ? 'ok' : 'watch' }); });
        med.conmeds.forEach(function (c) { ev.push({ type: 'conmed', date: c.start, end: c.end, label: c.drug, detail: c.indication + (c.end ? ' until ' + FMT.dateShort(c.end) : ', ongoing'), status: 'ok' }); });
      }
      return ev.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    }

    function lanesHtml(ev) {
      var t0 = new Date(subject.enrollDate).getTime(), t1 = G().ASOF.getTime(), span = Math.max(1, t1 - t0);
      function pos(d) { return Math.max(0, Math.min(100, ((new Date(d).getTime() - t0) / span) * 100)); }
      var lanes = LANES.filter(function (l) { return med || (l[0] !== 'dosing' && l[0] !== 'conmed'); });
      return '<div class="card-title" style="margin-bottom:6px">Timeline</div>' + lanes.map(function (l) {
        var items = ev.filter(function (e) { return e.type === l[0]; }).map(function (e) {
          var left = pos(e.date), title = esc(e.label + ', ' + FMT.dateShort(e.date) + ': ' + e.detail);
          if (e.type === 'conmed') return '<span class="lane-bar status-' + e.status + '" style="left:' + left + '%;width:' + Math.max(1.5, pos(e.end || today()) - left) + '%" title="' + title + '"></span>';
          return '<span class="lane-dot status-' + e.status + '" style="left:' + left + '%" title="' + title + '"></span>';
        }).join('');
        return '<div class="lane"><div class="lane-label">' + l[1] + '</div><div class="lane-track">' + items + '</div></div>';
      }).join('') + '<div class="lane"><div class="lane-label"></div><div class="lane-axis"><span>' + FMT.dateShort(subject.enrollDate) + '</span><span>' + FMT.dateShort(today()) + '</span></div></div>';
    }

    function eventRow(e) {
      var names = { visit: 'Visit', deviation: 'Deviation', dosing: 'Dosing', conmed: 'Medication', ae: 'AE' };
      return '<div class="card-head" style="padding:7px 0;border-bottom:1px solid var(--c-border)">' +
        '<div><span class="status-pill status-' + e.status + '">' + names[e.type] + '</span> <b style="margin-left:6px">' + esc(e.label) + '</b>' +
        '<div class="muted" style="font-size:10.5px">' + esc(e.detail) + '</div></div><span class="muted" style="font-size:10.5px">' + FMT.dateShort(e.date) + '</span></div>';
    }

    function vitalsHtml() {
      return '<div class="card"><div class="card-head"><div><div class="card-title">Vitals and labs</div><div class="card-subtitle">Abnormal readings are marked in red.</div></div>' +
        '<div class="seg" id="periodSeg">' + PERIODS.map(function (p) { return '<button class="btn btn-sm' + (state.period === p[0] ? ' btn-primary' : '') + '" data-period="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="grid grid-2" style="margin-top:8px">' + ['weight', 'temp', 'sbp', 'alt'].map(function (k) { return '<div class="vital-chart" id="vc-' + k + '"></div>'; }).join('') + '</div></div>';
    }

    function seriesFor(k) {
      var def = data.medical.vitalDefs[k], pts = med.vitals[k];
      if (state.period === 'weekly') pts = pts.slice(-8);
      if (state.period === 'monthly' || state.period === 'quarterly') {
        var buckets = {}, order = [];
        pts.forEach(function (p) {
          var key = state.period === 'monthly' ? p.date.slice(0, 7) : p.date.slice(0, 4) + '-Q' + (Math.floor((+p.date.slice(5, 7) - 1) / 3) + 1);
          if (!buckets[key]) { buckets[key] = []; order.push(key); }
          buckets[key].push(p.value);
        });
        pts = order.map(function (key) {
          var v = buckets[key].reduce(function (a, b) { return a + b; }, 0) / buckets[key].length;
          v = Math.round(v * 10) / 10;
          return { date: key, value: v, abnormal: (def.high != null && v > def.high) || (def.low != null && v < def.low) };
        });
      }
      return { def: def, pts: pts };
    }

    function mountCharts() {
      charts.forEach(function (c) { c.dispose(); }); charts = [];
      ['weight', 'temp', 'sbp', 'alt'].forEach(function (k) {
        var s = seriesFor(k), el = document.getElementById('vc-' + k);
        if (!el || !global.echarts) return;
        var c = global.echarts.init(el); charts.push(c);
        var lines = [];
        if (s.def.high != null) lines.push({ yAxis: s.def.high, name: 'Upper limit' });
        if (s.def.low != null) lines.push({ yAxis: s.def.low, name: 'Lower limit' });
        c.setOption({
          title: { text: s.def.label + ' (' + s.def.unit + ')', textStyle: { fontSize: 11, fontWeight: 700 }, left: 0, top: 0 },
          grid: { left: 36, right: 10, top: 26, bottom: 22 },
          tooltip: { trigger: 'axis', formatter: function (p) { var i = p[0].dataIndex, pt = s.pts[i]; return pt.date + '<br>' + s.def.label + ': <b>' + pt.value + ' ' + s.def.unit + '</b>' + (pt.abnormal ? '<br><span style="color:#f0503c">Abnormal reading</span>' : ''); } },
          xAxis: { type: 'category', data: s.pts.map(function (p) { return p.date.length > 7 ? p.date.slice(5) : p.date; }), axisLabel: { fontSize: 9 } },
          yAxis: { type: 'value', scale: true, axisLabel: { fontSize: 9 } },
          series: [{
            type: 'line', data: s.pts.map(function (p) { return { value: p.value, itemStyle: { color: p.abnormal ? '#f0503c' : '#3453ad' }, symbolSize: p.abnormal ? 9 : 5 }; }),
            lineStyle: { color: '#3453ad', width: 1.5 }, symbol: 'circle',
            markLine: lines.length ? { silent: true, symbol: 'none', lineStyle: { color: '#ffb133', type: 'dashed' }, label: { fontSize: 9 }, data: lines } : undefined
          }]
        });
      });
    }

    function reviewState(aeId) { return STORE.get('notes', 'aireview-' + aeId) || { steps: [], decision: null }; }

    function reviewHtml() {
      if (!med) return '';
      if (!aes.length) return '<div class="card" style="margin-top:10px"><div class="card-title">AI review</div><p class="muted">No adverse events recorded for this subject.</p></div>';
      return '<div class="card" style="margin-top:10px"><div class="card-head"><div class="card-title">AI review of adverse events</div><span class="ai-label"><span aria-hidden="true">&#10022;</span> AI-assisted</span></div>' +
        aes.map(function (e) {
          var r = med.reviews.filter(function (x) { return x.aeId === e.id; })[0], st = reviewState(e.id);
          var pend = state.pending && state.pending.aeId === e.id ? state.pending.step : null;
          return '<div class="review-item" data-ae="' + e.id + '"><div class="card-head"><div><b>' + esc(e.term) + '</b> <span class="muted">' + e.id + ' · ' + e.severity + ' · ' + e.relatedness + '</span></div>' +
            '<span class="status-pill status-' + (r.grade >= 3 ? 'action' : 'watch') + '">Grade ' + r.grade + '</span></div>' +
            '<p style="font-size:11.5px;margin:4px 0">' + esc(r.reasoning) + ' <span class="muted">Confidence ' + Math.round(r.confidence * 100) + '%.</span></p>' +
            (st.steps.length ? '<p class="muted" style="font-size:10.5px">Done: ' + st.steps.map(function (s) { return esc(s.step); }).join(', ') + '</p>' : '') +
            (pend ? '<div class="banner banner-ai"><div><b>' + esc(pend) + '?</b> This writes an audit trail entry and a note on ' + subject.id + '.</div>' +
              '<button class="btn btn-sm btn-primary" data-confirm="' + esc(pend) + '">Confirm</button> <button class="btn btn-sm" data-cancel="1">Cancel</button></div>'
              : '<div class="ai-chip-row">' + r.steps.map(function (s) { return '<button class="ai-chip" data-step="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div>') +
            (st.decision ? '<p style="margin-top:6px;font-size:11px"><span class="status-pill status-' + (st.decision === 'Accepted' ? 'ok' : 'watch') + '">' + st.decision + '</span>' + (st.reason ? ' <span class="muted">' + esc(st.reason) + '</span>' : '') + '</p>'
              : '<div style="margin-top:6px;display:flex;gap:6px"><button class="btn btn-sm" data-accept="1">Accept</button><button class="btn btn-sm" data-override="1">Override</button></div>') + '</div>';
        }).join('') + '</div>';
    }

    function logSubjectNote(text) {
      var cur = STORE.get('notes', 'subject-' + subject.id) || { entries: [] };
      STORE.patch('notes', 'subject-' + subject.id, { entries: cur.entries.concat([{ text: text, date: today() }]) });
    }

    function bindReview() {
      contentEl.querySelectorAll('.review-item').forEach(function (item) {
        var aeId = item.getAttribute('data-ae');
        item.querySelectorAll('[data-step]').forEach(function (b) { b.addEventListener('click', function () { state.pending = { aeId: aeId, step: b.getAttribute('data-step') }; draw(); }); });
        var cancel = item.querySelector('[data-cancel]');
        if (cancel) cancel.addEventListener('click', function () { state.pending = null; draw(); });
        var conf = item.querySelector('[data-confirm]');
        if (conf) conf.addEventListener('click', function () {
          var step = conf.getAttribute('data-confirm'), st = reviewState(aeId);
          STORE.patch('notes', 'aireview-' + aeId, { steps: st.steps.concat([{ step: step, date: today() }]) });
          STORE.logAudit('AdverseEvent', aeId, null, 'AI review step confirmed: ' + step);
          logSubjectNote(step + ' (AI review of ' + aeId + ')');
          state.pending = null; global.RBQM_TOAST.show(step + ' logged'); draw();
        });
        var acc = item.querySelector('[data-accept]');
        if (acc) acc.addEventListener('click', function () {
          STORE.patch('notes', 'aireview-' + aeId, { decision: 'Accepted', reason: '' });
          STORE.logAudit('AdverseEvent', aeId, null, 'AI review accepted'); global.RBQM_TOAST.show('Review accepted'); draw();
        });
        var ov = item.querySelector('[data-override]');
        if (ov) ov.addEventListener('click', function () {
          global.RBQM_MODAL.open({
            title: 'Override AI review of ' + aeId, confirmLabel: 'Override',
            bodyHtml: '<div class="field"><label>Reason</label><textarea class="text-input" id="ovReason" rows="3"></textarea></div>',
            onConfirm: function (m) {
              var reason = m.querySelector('#ovReason').value.trim();
              if (!reason) return false;
              STORE.patch('notes', 'aireview-' + aeId, { decision: 'Overridden', reason: reason });
              STORE.logAudit('AdverseEvent', aeId, null, 'AI review overridden: ' + reason);
              logSubjectNote('AI review of ' + aeId + ' overridden: ' + reason);
              global.RBQM_TOAST.show('Review overridden'); draw(); return true;
            }
          });
        });
      });
    }

    function draw() {
      var ev = events();
      var list = ev.filter(function (e) { return state.type === 'all' || e.type === state.type; });
      var types = [['all', 'All events']].concat(LANES.filter(function (l) { return med || (l[0] !== 'dosing' && l[0] !== 'conmed'); }));
      contentEl.innerHTML =
        '<div class="card"><div class="card-head"><div><h2 style="font-size:17px">' + subject.id + '</h2>' +
        '<p class="muted">Site ' + site.code + ', ' + site.country + ' &middot; arm ' + subject.arm + ' &middot; enrolled ' + FMT.dateShort(subject.enrollDate) + ' &middot; ' + subject.status + '</p></div>' +
        '<a class="btn btn-sm" href="site-profile.html?site=' + site.id + '">Back to site profile</a></div>' +
        (med ? '' : '<p class="muted" style="font-size:10.5px;margin-top:6px">Dosing, vitals and AI review are generated for Site 114 and three Safety review subjects only.</p>') + '</div>' +
        '<div style="height:10px"></div><div class="card">' + lanesHtml(ev) + '</div>' +
        (med ? '<div style="height:10px"></div>' + vitalsHtml() : '') + reviewHtml() +
        '<div style="height:10px"></div><div class="card"><div class="table-toolbar"><select class="select-input" id="typeFilter">' +
        types.map(function (t) { return '<option value="' + t[0] + '"' + (state.type === t[0] ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></div>' +
        list.map(eventRow).join('') + '</div>';

      document.getElementById('typeFilter').addEventListener('change', function (e) { state.type = e.target.value; draw(); });
      var seg = document.getElementById('periodSeg');
      if (seg) seg.querySelectorAll('[data-period]').forEach(function (b) { b.addEventListener('click', function () { state.period = b.getAttribute('data-period'); draw(); }); });
      if (med) { mountCharts(); bindReview(); }
    }

    global.addEventListener('resize', function () { charts.forEach(function (c) { c.resize(); }); });
    draw();
  }

  global.RBQM_PAGE_SUBJECT_DETAIL = { render: render };
})(window);
