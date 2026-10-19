/* What changed: portfolio feed of real changes between the last two finalized snapshots
   per study (KRI status moves, QTL outcome moves) plus recent audit trail activity. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var ROUTER = global.RBQM_ROUTER;

  function lastTwoFinalized(data, studyId) {
    return data.snapshots.filter(function (s) { return s.studyId === studyId && s.status === 'Finalized'; })
      .sort(function (a, b) { return a.index - b.index; }).slice(-2);
  }

  function buildChanges(data) {
    var changes = [];

    data.studies.forEach(function (study) {
      var pair = lastTwoFinalized(data, study.id);
      if (pair.length < 2) return;
      var prev = pair[0], latest = pair[1];
      var sites = data.sites.filter(function (s) { return s.studyId === study.id && s.status === 'active'; });
      sites.forEach(function (site) {
        KRI.KRIS.filter(function (k) { return k.active; }).forEach(function (kriDef) {
          var prevRow = data.kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === kriDef.code && r.snapshotId === prev.id; })[0];
          var curRow = data.kriResults.filter(function (r) { return r.siteId === site.id && r.kriCode === kriDef.code && r.snapshotId === latest.id; })[0];
          if (prevRow && curRow && prevRow.status !== curRow.status && curRow.status !== 'insufficient' && prevRow.status !== 'insufficient') {
            changes.push({
              type: 'kri_status', date: latest.date, studyId: study.id, siteId: site.id, kriCode: kriDef.code,
              severity: curRow.status, text: 'Site ' + site.code + ': ' + kriDef.name.toLowerCase() + ' moved from ' + FMT.statusLabel(prevRow.status).toLowerCase() + ' to ' + FMT.statusLabel(curRow.status).toLowerCase() + '.',
              href: 'kri-detail.html?kri=' + kriDef.code + '&site=' + site.id
            });
          }
        });
      });
    });

    data.qtlDefs.forEach(function (def) {
      var runs = data.qtlRuns.filter(function (r) { return r.qtlId === def.id; });
      if (runs.length < 2) return;
      var prev = runs[runs.length - 2], cur = runs[runs.length - 1];
      if (prev.outcome !== cur.outcome) {
        changes.push({
          type: 'qtl', date: data.snapshots.filter(function (s) { return s.id === cur.snapshotId; })[0].date, studyId: def.studyId,
          severity: cur.outcome === 'Breached' ? 'action' : (cur.outcome === 'Near' ? 'watch' : 'ok'),
          text: def.parameter + ' (' + def.studyId + ') moved from ' + prev.outcome.toLowerCase() + ' to ' + cur.outcome.toLowerCase() + '.',
          href: 'quality-limits.html'
        });
      }
    });

    var cutoff = global.RBQM_GENERATOR.addDays(global.RBQM_GENERATOR.ASOF, -14);
    data.auditEvents.filter(function (e) { return new Date(e.timestamp) >= cutoff; }).forEach(function (e) {
      changes.push({
        type: 'audit', date: e.timestamp.slice(0, 10), studyId: null, severity: 'watch',
        text: e.entity + ' ' + e.entityId + ': ' + e.action + '.',
        href: e.entity === 'CAPA' ? 'issues-capa.html' : (e.entity === 'Signal' ? 'signals.html' : 'reports-audit.html')
      });
    });

    return changes.sort(function (a, b) { return b.date < a.date ? -1 : 1; });
  }

  function render(contentEl, data) {
    var all = buildChanges(data);
    var filters = { type: 'all', study: 'all', severity: 'all' };

    function draw() {
      var filtered = all.filter(function (c) {
        if (filters.type !== 'all' && c.type !== filters.type) return false;
        if (filters.study !== 'all' && c.studyId && c.studyId !== filters.study) return false;
        if (filters.severity !== 'all' && c.severity !== filters.severity) return false;
        return true;
      });
      var counts = { kri_status: 0, qtl: 0, audit: 0 };
      all.forEach(function (c) { counts[c.type]++; });

      contentEl.innerHTML =
        '<div class="banner banner-ai"><span aria-hidden="true">&#10022;</span><div><b>AI summary of the week.</b> ' +
        counts.kri_status + ' indicator status changes, ' + counts.qtl + ' quality limit movements, ' + counts.audit + ' recent actions since the last snapshot.</div></div>' +
        '<div style="height:10px"></div><div class="card">' +
        '<div class="table-toolbar">' +
        '<select class="select-input" id="typeFilter"><option value="all">All types</option><option value="kri_status">Indicator changes</option><option value="qtl">Quality limits</option><option value="audit">Recent actions</option></select>' +
        '<select class="select-input" id="studyFilterLocal"><option value="all">All studies</option>' + data.studies.map(function (s) { return '<option value="' + s.id + '">' + s.id + '</option>'; }).join('') + '</select>' +
        '<select class="select-input" id="severityFilter"><option value="all">All severities</option><option value="action">Action needed</option><option value="watch">Watch</option><option value="ok">On track</option></select>' +
        '</div>' +
        (filtered.length ? filtered.map(rowHtml).join('') :
          '<div class="empty-state"><h3>Nothing matches these filters</h3><p>Try a wider date range or another country.</p></div>') +
        '</div>';

      document.getElementById('typeFilter').value = filters.type;
      document.getElementById('typeFilter').addEventListener('change', function (e) { filters.type = e.target.value; draw(); });
      document.getElementById('studyFilterLocal').addEventListener('change', function (e) { filters.study = e.target.value; draw(); });
      document.getElementById('severityFilter').addEventListener('change', function (e) { filters.severity = e.target.value; draw(); });
    }

    function rowHtml(c) {
      return '<a href="' + c.href + '" style="display:block;color:inherit;text-decoration:none">' +
        '<div class="card-head" style="padding:7px 0;border-bottom:1px solid var(--c-border)">' +
        '<div><span class="status-pill status-' + c.severity + '">' + FMT.statusLabel(c.severity) + '</span> ' +
        '<span style="margin-left:6px">' + c.text + '</span></div>' +
        '<span class="muted" style="font-size:10.5px;white-space:nowrap">' + FMT.dateShort(c.date) + '</span>' +
        '</div></a>';
    }

    draw();
  }

  global.RBQM_PAGE_WHAT_CHANGED = { render: render };
})(window);
