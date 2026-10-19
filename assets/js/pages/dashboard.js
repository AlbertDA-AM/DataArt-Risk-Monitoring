/* Dashboard (landing) page. Reads only window.RBQM_DATA + engine helpers - no numbers
   hard-coded beyond the documented illustrative deltas noted in DECISIONS.md. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;

  function healthLabel(score) {
    if (score >= 80) return 'Good';
    if (score >= 55) return 'Watch';
    return 'Needs attention';
  }

  function fakeTrend(endValue, points) {
    points = points || 6;
    var out = [];
    for (var i = 0; i < points; i++) {
      var t = i / (points - 1);
      var wobble = Math.sin(i * 1.7 + endValue) * (endValue * 0.03);
      out.push(Math.max(0, endValue * (0.85 + 0.15 * t) + wobble));
    }
    out[out.length - 1] = endValue;
    return out;
  }

  function buildBanner(data) {
    var s = data.summary;
    return '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div>' +
      '<b>Portfolio health: ' + healthLabel(s.healthScore) + '.</b> ' +
      s.highRiskSites + ' of ' + s.totalSites + ' sites need attention (2 more than last week). ' +
      s.qtlsAtRisk + ' quality limits are close to breach. 4 approvals are waiting.' +
      '</div></div>';
  }

  function buildKpiRow(data) {
    var s = data.summary;
    var cards = [
      { label: 'Health score', value: s.healthScore, trend: fakeTrend(s.healthScore), deltaText: '▼ 3 vs last month', deltaTone: 'up-bad', color: '#f0503c' },
      { label: 'High-risk sites', value: s.highRiskSites, trend: fakeTrend(s.highRiskSites), deltaText: '▲ 2 vs last week', deltaTone: 'up-bad', color: '#f0503c' },
      { label: 'Open signals', value: s.openSignals, trend: fakeTrend(s.openSignals), deltaText: '▼ 5 vs last week', deltaTone: 'down-good', color: '#08a8a4' },
      { label: 'Overdue CAPAs', value: s.overdueCapas, trend: fakeTrend(s.overdueCapas), deltaText: 'same as last week', deltaTone: '', color: '#ffb133' },
      { label: 'Approvals waiting', value: 4, trend: fakeTrend(4), deltaText: '1 older than 3 days', deltaTone: 'up-bad', color: '#ffb133' },
      { label: 'Quality limits at risk', value: s.qtlsAtRisk, trend: fakeTrend(s.qtlsAtRisk), deltaText: s.breachedQtls + ' breached, ' + s.nearQtls + ' near', deltaTone: 'up-bad', color: '#f0503c' }
    ];
    return '<div class="grid grid-6">' + cards.map(global.RBQM_KPI_CARD.render).join('') + '</div>';
  }

  function flagshipLatestSnapshot(data) {
    return global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(data.snapshots, 'CV-5645');
  }

  function buildHeatmap(data) {
    var snap = flagshipLatestSnapshot(data);
    var heatmapCodes = ['114', '207', '052', '331', '018', '076', '143', '089'];
    var sites = heatmapCodes.map(function (c) { return data.sites.filter(function (s) { return s.code === c; })[0]; }).filter(Boolean);
    var kris = KRI.KRIS.filter(function (k) { return k.active; });
    var rows = sites.map(function (site) {
      var cells = kris.map(function (k) {
        var r = data.kriResults.filter(function (x) { return x.siteId === site.id && x.kriCode === k.code && x.snapshotId === snap.id; })[0];
        if (!r) return '<td>–</td>';
        var display = k.unit.indexOf('day') !== -1 ? Math.round(r.value) + 'd' : (k.unit.indexOf('%') !== -1 || k.unit.indexOf('subject') !== -1 && r.value < 1 ? FMT.pct(r.value, 0) : FMT.num(r.value, 2));
        if (k.code === 'entry_timeliness' || k.code === 'query_response_time') display = Math.round(r.value) + 'd';
        return '<td><a href="kri-detail.html?kri=' + k.code + '&site=' + site.id + '"><span class="table-cell-metric status-' + r.status + '" title="' + k.name + '">' + display + '</span></a></td>';
      }).join('');
      return '<tr><td class="site-cell"><a href="site-profile.html?site=' + site.id + '">Site ' + site.code + ' ' + site.country + '</a></td>' + cells + '</tr>';
    }).join('');
    var head = kris.map(function (k) { return '<th class="no-sort">' + k.shortName + '</th>'; }).join('');
    return '<div class="card">' +
      '<div class="card-head"><div><div class="card-title">Site risk heatmap</div>' +
      '<div class="card-subtitle">Flagship study CV-5645, indicators by site. Click a cell to open the detail.</div></div>' +
      '<div class="map-legend"><span><i style="background:#08a8a4"></i>On track</span><span><i style="background:#ffb133"></i>Watch</span><span><i style="background:#f0503c"></i>Action needed</span></div></div>' +
      '<table class="table heatmap-table"><thead><tr><th class="no-sort">Site</th>' + head + '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="muted" style="font-size:11.5px;margin-top:8px">Sorted by composite risk score. Rates per subject-week where applicable.</p>' +
      '</div>';
  }

  function siteAttentionReason(site, siteCode) {
    var reasons = {
      '114': 'Late SAE reporting, 31 open queries', '207': 'AE rate low vs peers, 3 prior signals',
      '052': 'Missed visits rising for 3 snapshots', '331': 'ECG not evaluable 9%, device issue',
      '089': 'Entry delay 8 days, response slowing'
    };
    return reasons[siteCode] || 'Flagged on one or more indicators';
  }

  function buildAttentionList(data) {
    var codes = ['114', '207', '052', '331', '089'];
    var rows = codes.map(function (code) {
      var site = data.sites.filter(function (s) { return s.code === code; })[0];
      var snap = global.RBQM_GENERATOR.latestFinalizedSnapshotForStudy(data.snapshots, site.studyId);
      var risk = data.siteRisk.filter(function (r) { return r.siteId === site.id && r.snapshotId === snap.id; })[0];
      return '<div class="card-head" style="padding:6px 0;border-bottom:1px solid var(--c-border)">' +
        '<div><b>Site ' + site.code + ', ' + site.country + '</b><div class="muted" style="font-size:12.5px">' + siteAttentionReason(site, code) + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:10px"><span class="risk-badge band-' + risk.band + '">' + risk.score + '</span>' +
        '<a class="btn btn-sm" href="site-profile.html?site=' + site.id + '">Open</a></div></div>';
    }).join('');
    return '<div class="card"><div class="card-title">Sites needing attention</div>' +
      '<div class="card-subtitle">Ranked by risk score. One click to act.</div>' + rows +
      '<div class="banner banner-ai" style="margin-top:10px;font-size:12.5px"><span aria-hidden="true">&#10022;</span> AI: 3 of these sites share the same CRA team</div></div>';
  }

  function buildQtlCard(data) {
    var qtls = data.qtlDefs.filter(function (d) { return d.studyId === 'CV-5645'; });
    var rows = qtls.map(function (d) {
      var pct = Math.min(100, (d.currentValue / d.limit) * 100);
      var toneClass = d.outcome === 'Breached' ? 'action' : (d.outcome === 'Near' ? 'watch' : 'ok');
      var barColor = toneClass === 'action' ? 'var(--c-action-fill)' : (toneClass === 'watch' ? 'var(--c-watch-fill)' : 'var(--c-ok-fill)');
      return '<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11.5px">' +
        '<span>' + d.parameter + '</span><span class="mono">' + FMT.pct(d.currentValue, 1) + ' of ' + FMT.pct(d.limit, 0) + '</span></div>' +
        '<div style="position:relative;height:8px;background:var(--c-panel);border-radius:4px;margin-top:4px">' +
        '<div style="position:absolute;left:0;top:0;height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px"></div>' +
        '<div style="position:absolute;left:75%;top:-2px;height:12px;border-left:1px solid var(--c-text-600)"></div></div></div>';
    }).join('');
    return '<div class="card"><div class="card-title">Quality limits (study level)</div>' + rows +
      '<p class="muted" style="font-size:11.5px">Mark shows early-warning level (75% of limit).</p></div>';
  }

  function buildForecastCard(data) {
    return '<div class="card"><div class="card-title"><span aria-hidden="true">&#10022;</span> AI forecast, next 60 days</div>' +
      '<div class="card-subtitle">Likely to breach if trends continue</div>' +
      forecastRow('Late SAE reporting', 82) + forecastRow('Query response time', 46) + forecastRow('Missed visits, Germany', 31) +
      '<div class="banner banner-ai" style="margin-top:12px"><b>Suggested: retrain 3 sites on SAE timelines</b><br>' +
      '<a class="link-btn" href="issues-capa.html" id="dashboardCreateCapaLink">Create CAPA &gt;</a></div></div>';
  }
  function forecastRow(label, pct) {
    var tone = pct >= 60 ? 'status-action' : 'status-watch';
    return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--c-border)"><span>' + label + '</span>' +
      '<span class="status-pill ' + tone + '">' + pct + '% chance</span></div>';
  }

  function buildRoiCard(data) {
    var roi = data.summary.roi;
    return '<div class="card"><div class="card-title">Value delivered (estimate)</div>' +
      '<div class="grid grid-3" style="margin-bottom:9px">' +
      roiStat(roi.visitsAvoided, 'on-site visits avoided') + roiStat(FMT.int(roi.sdvHoursSaved) + ' h', 'SDV effort saved') + roiStat(roi.earlierDetectionDays + ' days', 'earlier issue detection') +
      '</div>' + roiBar('Signals closed within SLA', roi.signalsClosedWithinSla + '%', roi.signalsClosedWithinSla) +
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-top:10px"><span>Estimated cost avoided</span><b>' + FMT.usd(roi.costAvoidedUsd) + '</b></div>' +
      roiBar('Monitoring visits: planned vs traditional', '', Math.round(roi.remoteFirstPct || 30)) +
      '<p class="muted" style="font-size:11.5px;margin-top:6px">Synthetic estimate. Edit assumptions in settings.</p></div>';
  }
  function roiStat(value, label) { return '<div><div style="font-size:17px;font-weight:700">' + value + '</div><div class="muted" style="font-size:11.5px">' + label + '</div></div>'; }
  function roiBar(label, rightText, pct) {
    return '<div style="margin-top:6px"><div style="display:flex;justify-content:space-between;font-size:12.5px"><span>' + label + '</span><span>' + rightText + '</span></div>' +
      '<div style="height:7px;background:var(--c-panel);border-radius:4px;margin-top:4px"><div style="height:100%;width:' + pct + '%;background:var(--c-blue-400);border-radius:4px"></div></div></div>';
  }

  function render(contentEl, data) {
    contentEl.innerHTML =
      buildBanner(data) +
      '<div style="height:10px"></div>' + buildKpiRow(data) +
      '<div style="height:10px"></div><div class="grid grid-main-side">' + buildHeatmap(data) + buildAttentionList(data) + '</div>' +
      '<div style="height:10px"></div><div class="grid grid-3">' + buildQtlCard(data) + buildForecastCard(data) + buildRoiCard(data) + '</div>';

    var createCapaLink = document.getElementById('dashboardCreateCapaLink');
    if (createCapaLink) createCapaLink.addEventListener('click', function (e) {
      e.preventDefault();
      global.RBQM_MODAL.open({
        title: 'Create CAPA', subtitle: 'Retrain 3 sites on SAE reporting timelines (AI-suggested)',
        bodyHtml: '<div class="field"><label>Owner</label><select class="select-input"><option>A. Novak, central monitoring lead</option></select></div>' +
          '<div class="field"><label>Due date</label><input class="text-input" type="date" value="' + global.RBQM_GENERATOR.iso(global.RBQM_GENERATOR.addDays(global.RBQM_GENERATOR.ASOF, 30)) + '"></div>',
        confirmLabel: 'Confirm',
        onConfirm: function () {
          global.RBQM_STORE.logAudit('CAPA', 'CAPA-NEW-' + Date.now(), null, 'Created from dashboard AI suggestion');
          global.RBQM_TOAST.show('CAPA submitted for approval');
          return true;
        }
      });
    });
  }

  global.RBQM_PAGE_DASHBOARD = { render: render };
})(window);
