/* Site heartbeat (Addendum v0.5, item 2): period selector, Key figures strip, Indicator history status strips and the
   Risks and tickets list for the Site profile. Weekly history and key figures exist only for 15 demo sites
   (9 high-risk and 6 others); every other site shows "No history in this demo". Single source: data.heartbeat. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var ROUTER = global.RBQM_ROUTER;
  var CATS = ['Safety', 'Data management', 'Protocol compliance', 'Enrollment', 'Data quality'];
  var RANK = { ok: 0, watch: 1, action: 2 };
  var KF = [['aes', 'AEs', true], ['saes', 'SAEs', true], ['deviations', 'Protocol deviations', true], ['enrolled', 'Enrolled', false], ['screeningFailures', 'Screening failures', true], ['overdueQueries', 'Overdue queries', true]];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function hasHistory(data, siteId) { return !!data.heartbeat.bySite[siteId]; }
  function noHistory() { return '<div class="empty-state"><h3>No history in this demo</h3><p>Weekly history is generated for 15 demo sites only.</p></div>'; }

  /** Snapshots (finalized) that fall inside the 12 weekly points, for "Select period within available snapshots". */
  function snapshotsInRange(data, site) {
    var w = data.heartbeat.weeks;
    return data.snapshots.filter(function (s) { return s.studyId === site.studyId && s.status === 'Finalized' && s.date >= w[0] && s.date <= w[11]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  function weekIndex(weeks, date) {
    var best = 0;
    weeks.forEach(function (w, i) { if (Math.abs(new Date(w) - new Date(date)) < Math.abs(new Date(weeks[best]) - new Date(date))) best = i; });
    return best;
  }

  /** The active period: granularity (week or month), the first and last week index, and the step used for "previous period". */
  function period(data, site) {
    var weeks = data.heartbeat.weeks, mode = ROUTER.get('period', 'weekly'), snaps = snapshotsInRange(data, site);
    var out = { mode: mode, gran: mode === 'monthly' ? 'month' : 'week', s: 0, e: 11, step: mode === 'monthly' ? 4 : 1, label: mode === 'monthly' ? 'Last 12 weeks, by month' : 'Last 12 weeks, by week' };
    if (mode === 'custom' && snaps.length >= 2) {
      var from = ROUTER.get('from', snaps[0].date), to = ROUTER.get('to', snaps[snaps.length - 1].date);
      var s = weekIndex(weeks, from), e = weekIndex(weeks, to);
      if (e < s) { var t = s; s = e; e = t; }
      out.s = s; out.e = e; out.label = FMT.dateShort(weeks[s]) + ' to ' + FMT.dateShort(weeks[e]);
    } else if (mode === 'custom') out.mode = 'weekly';
    return out;
  }

  function periodHtml(data, site) {
    if (!hasHistory(data, site.id)) return '';
    var p = period(data, site), snaps = snapshotsInRange(data, site);
    var o = function (v, t) { return '<option value="' + v + '"' + (p.mode === v ? ' selected' : '') + '>' + t + '</option>'; };
    var opts = function (cur) { return snaps.map(function (s) { return '<option value="' + s.date + '"' + (s.date === cur ? ' selected' : '') + '>' + FMT.dateShort(s.date) + '</option>'; }).join(''); };
    return '<div class="period-sel" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><label class="muted" style="font-size:10.5px">Period ' +
      '<select class="select-input" id="periodSel">' + o('weekly', 'Weekly') + o('monthly', 'Monthly') + (snaps.length >= 2 ? o('custom', 'Select period') : '') + '</select></label>' +
      (p.mode === 'custom' ? '<select class="select-input" id="periodFrom" aria-label="From snapshot">' + opts(ROUTER.get('from', snaps[0].date)) + '</select><span class="muted">to</span>' +
        '<select class="select-input" id="periodTo" aria-label="To snapshot">' + opts(ROUTER.get('to', snaps[snaps.length - 1].date)) + '</select>' : '') + '</div>';
  }

  function bindPeriod(contentEl, onChange) {
    var sel = contentEl.querySelector('#periodSel');
    if (!sel) return;
    sel.addEventListener('change', function () { ROUTER.set({ period: sel.value === 'weekly' ? null : sel.value, from: null, to: null }); onChange(); });
    ['periodFrom', 'periodTo'].forEach(function (id) {
      var el = contentEl.querySelector('#' + id);
      if (el) el.addEventListener('change', function () { var p = {}; p[id === 'periodFrom' ? 'from' : 'to'] = el.value; ROUTER.set(p); onChange(); });
    });
  }

  function keyFiguresHtml(data, site) {
    if (!hasHistory(data, site.id)) return '<div class="card"><div class="card-title">Key figures</div>' + noHistory() + '</div>';
    var kf = data.heartbeat.bySite[site.id].keyFigures, p = period(data, site), unit = p.gran === 'month' ? 'month' : 'week';
    var cards = KF.map(function (k) {
      var series = kf[k[0]], cur = series[p.e], prev = p.e - p.step >= 0 ? series[p.e - p.step] : null, d = prev == null ? null : cur - prev;
      var text = d == null ? 'No previous ' + unit : (d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : 'No change') + ' vs previous ' + unit;
      var tone = d == null || d === 0 ? '' : ((d > 0) === k[2] ? 'up-bad' : 'down-good');
      return global.RBQM_KPI_CARD.render({ label: k[1], value: cur, trend: series.slice(p.s, p.e + 1), deltaText: text, deltaTone: tone, color: tone === 'up-bad' ? '#f0503c' : '#3453ad' });
    }).join('');
    return '<div class="card"><div class="card-head"><div class="card-title" data-term="Key figures" data-help="Six counts for this site, with the change since the previous period and a trend line.">Key figures</div><span class="muted" style="font-size:10.5px">' + esc(p.label) + '</span></div><div class="grid grid-6">' + cards + '</div></div>';
  }

  function worst(cells) {
    return cells.reduce(function (acc, c) { return c.status !== 'insufficient' && (acc == null || RANK[c.status] > RANK[acc]) ? c.status : acc; }, null) || 'insufficient';
  }

  function historyHtml(data, site) {
    if (!hasHistory(data, site.id)) return '<div class="card">' + noHistory() + '</div>';
    var hb = data.heartbeat, ind = hb.bySite[site.id].indicators, p = period(data, site), weeks = hb.weeks;
    var blocks = [];
    if (p.gran === 'month') { for (var e = p.e; e - 3 >= 0 && blocks.length < 3; e -= 4) blocks.unshift({ from: e - 3, to: e }); }
    else for (var i = p.s; i <= p.e; i++) blocks.push({ from: i, to: i });
    var snapDate = function (id) { var s = data.snapshots.filter(function (x) { return x.id === id; })[0]; return s ? s.date : ''; };
    var groups = CATS.map(function (cat) {
      var codes = hb.indicatorCodes.filter(function (c) { return KRI.byCode(c) && KRI.byCode(c).category === cat; });
      if (!codes.length) return '';
      return '<div class="strip-cat">' + cat + '</div>' + codes.map(function (code) {
        var def = KRI.byCode(code);
        var cells = blocks.map(function (b) {
          var slice = ind[code].slice(b.from, b.to + 1), last = slice[slice.length - 1], st = b.from === b.to ? last.status : worst(slice);
          var when = b.from === b.to ? 'Week ending ' + FMT.dateShort(weeks[b.to]) : '4 weeks to ' + FMT.dateShort(weeks[b.to]);
          var tip = when + ': ' + (last.value == null ? 'no value' : global.RBQM_CALC.fmtKri(def, last.value)) + ', ' + FMT.statusLabel(st);
          var link = def.active && last.value != null ? ' data-href="kri-detail.html?kri=' + code + '&site=' + site.id + '&snapshot=' + snapDate(last.snapshotId) + '"' : ' disabled';
          return '<button class="strip-cell strip-' + st + '" title="' + esc(tip) + '" aria-label="' + esc(def.name + ', ' + tip) + '"' + link + '></button>';
        }).join('');
        return '<div class="strip-row"><div class="strip-label">' + esc(def.name) + (def.active ? '' : ' <span class="status-pill status-inactive">Inactive</span>') + '</div><div class="strip-cells">' + cells + '</div></div>';
      }).join('');
    }).join('');
    return '<div class="card"><div class="card-head"><div><div class="card-title" data-term="Status strip" data-help="Each cell is one period for one indicator: green on track, amber watch, red action needed, grey not enough data.">Status strip</div><div class="card-subtitle">One row per indicator, one cell per ' + p.gran + '. Click a cell to open the indicator at that snapshot.</div></div>' +
      '<div class="legend"><span><i class="strip-cell strip-ok" style="display:inline-block;width:12px;height:10px"></i> On track</span> <span><i class="strip-cell strip-watch" style="display:inline-block;width:12px;height:10px"></i> Watch</span> ' +
      '<span><i class="strip-cell strip-action" style="display:inline-block;width:12px;height:10px"></i> Action needed</span> <span><i class="strip-cell strip-insufficient" style="display:inline-block;width:12px;height:10px"></i> Insufficient data</span></div></div>' + groups + '</div>';
  }

  function bindHistory(el) {
    el.querySelectorAll('.strip-cell[data-href]').forEach(function (b) { b.addEventListener('click', function () { global.location.href = b.getAttribute('data-href'); }); });
  }

  /** Risks from the register that mention this site or its study, plus the site's signals, CAPAs and deviations, as one list. */
  function ticketsHtml(data, site) {
    var weeks = data.heartbeat.weeks, p = hasHistory(data, site.id) ? period(data, site) : { s: 0, e: 11 };
    var from = weeks[p.s], to = weeks[p.e];
    var filterOn = hasHistory(data, site.id);
    var inWin = function (d) { return !filterOn || !d || (d >= from && d <= to); };
    var risks = global.RBQM_RISKS.risks(data).filter(function (r) { return r.studyId === site.studyId || r.description.indexOf('Site ' + site.code) !== -1; });
    var items = [];
    risks.forEach(function (r) { items.push({ type: 'Risk', id: r.id, title: r.name, date: '', state: r.status + ', score ' + r.score, tone: r.band === 'high' ? 'action' : r.band === 'medium' ? 'watch' : 'ok', risk: r.id }); });
    data.signals.filter(function (s) { return s.siteId === site.id; }).forEach(function (s) { items.push({ type: 'Signal', id: s.id, title: s.description || s.kriCode, date: s.created, state: s.status, tone: s.severity === 'action' ? 'action' : 'watch', href: 'kri-detail.html?kri=' + s.kriCode + '&site=' + site.id }); });
    data.capas.filter(function (c) { return c.siteId === site.id; }).forEach(function (c) { items.push({ type: 'CAPA', id: c.id, title: c.rootCause ? c.rootCause.slice(0, 80) : c.id, date: c.due, state: c.state, tone: 'watch', href: 'issues-capa.html' }); });
    data.deviations.filter(function (d) { return d.siteId === site.id; }).forEach(function (d) { items.push({ type: 'Deviation', id: d.id, title: d.category, date: d.detectedDate || d.date, state: d.importance + ', ' + d.status, tone: d.importance === 'Critical' ? 'action' : d.importance === 'Major' ? 'watch' : 'ok', href: 'protocol-deviations.html' }); });
    items = items.filter(function (i) { return i.type === 'Risk' || inWin(i.date); }).sort(function (a, b) { return (b.date || '9999') < (a.date || '9999') ? -1 : 1; }).slice(0, 60);
    var rows = items.map(function (i) {
      var link = i.risk ? '<a href="#" data-risk="' + i.risk + '">' + i.id + '</a>' : '<a href="' + i.href + '">' + esc(i.id) + '</a>';
      return '<tr><td><span class="status-pill status-insufficient">' + i.type + '</span></td><td>' + link + '</td><td>' + esc(i.title) + '</td><td>' + (i.date ? FMT.dateShort(i.date) : '–') + '</td><td><span class="status-pill status-' + i.tone + '">' + esc(i.state) + '</span></td></tr>';
    }).join('');
    return '<div class="card"><div class="card-title" data-help="Risks for this study or site, plus signals, CAPAs and deviations for the site, in one list.">Risks and tickets</div><div class="card-subtitle">Risks for ' + site.studyId + ' or this site, with its signals, CAPAs and deviations' + (p.mode === 'custom' ? ' in the selected period' : '') + '.</div>' +
      (rows ? '<table class="table"><thead><tr><th class="no-sort">Type</th><th class="no-sort">ID</th><th class="no-sort">Item</th><th class="no-sort">Date</th><th class="no-sort">State</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="empty-state"><h3>Nothing in this period</h3></div>') + '</div>';
  }

  function bindTickets(el, data, redraw) {
    el.querySelectorAll('[data-risk]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); global.RBQM_RISKS.openDetail(data, a.getAttribute('data-risk'), redraw); }); });
  }

  global.RBQM_SITE_HEARTBEAT = { hasHistory: hasHistory, period: period, periodHtml: periodHtml, bindPeriod: bindPeriod, keyFiguresHtml: keyFiguresHtml, historyHtml: historyHtml, bindHistory: bindHistory, ticketsHtml: ticketsHtml, bindTickets: bindTickets };
})(window);
