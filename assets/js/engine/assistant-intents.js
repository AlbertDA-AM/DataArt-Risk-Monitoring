/* The 46 simulated-AI intents (prep-docs/02-ai-response-library.md). Each run(entities, data,
   store, ctx) returns {text, basedOn, actions, followUps}. Answers are computed from
   window.RBQM_DATA only - never invented. Loaded after engine/assistant.js. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var KRI = global.RBQM_KRI_CATALOG;
  var G = global.RBQM_GENERATOR;
  var SIGNALS_ENGINE = global.RBQM_SIGNALS;
  var CAPA_ENGINE = global.RBQM_CAPA;
  var FORECAST = global.RBQM_FORECAST;
  var CFG = global.RBQM_CONFIG;

  function latestSnap(data, studyId) { return G.latestFinalizedSnapshotForStudy(data.snapshots, studyId); }
  function kriRow(data, siteId, code, snapId) { return data.kriResults.filter(function (r) { return r.siteId === siteId && r.kriCode === code && r.snapshotId === snapId; })[0]; }
  function studyAvg(data, studyId, code, snapId) {
    var siteIds = data.sites.filter(function (s) { return s.studyId === studyId; }).map(function (s) { return s.id; });
    var vals = siteIds.map(function (id) { var r = kriRow(data, id, code, snapId); return r && r.value != null ? r.value : null; }).filter(function (v) { return v != null; });
    return vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
  }
  function siteRiskAt(data, siteId, snapId) { return data.siteRisk.filter(function (r) { return r.siteId === siteId && r.snapshotId === snapId; })[0]; }
  function defaultSite(data, e) { return e.site || data.sites.filter(function (s) { return s.code === '114'; })[0]; }
  function defaultKri(e) { return e.kri || KRI.byCode('ae_rate'); }
  function basedOn(snap, extra) { return 'Based on snapshot ' + FMT.dateShort(snap.date) + (extra ? ', ' + extra : '.'); }

  var I = [];
  function def(id, keywords, requiresEntity, example, run) { I.push({ id: id, keywords: keywords, requiresEntity: requiresEntity || [], example: example, run: run }); }

  // ---------- Investigate ----------
  def('why_site_flagged', [['why'], ['flagged', 'wrong with']], ['site'], 'Why is Site 114 flagged?', function (e, data) {
    var site = defaultSite(data, e); var snap = latestSnap(data, site.studyId);
    var risk = siteRiskAt(data, site.id, snap.id);
    var drivers = (risk.drivers || []).slice(0, 4);
    return {
      text: 'Site ' + site.code + ' has a risk score of ' + risk.score + ' (' + risk.band + '). Top drivers: ' +
        drivers.map(function (d) { return KRI.byCode(d.kriCode).name + ' (' + d.status + ')'; }).join(', ') + '.',
      basedOn: basedOn(snap), viewHref: 'site-profile.html?site=' + site.id,
      actions: [{ id: 'open_signal', label: 'Open signal', site: site }, { id: 'create_capa', label: 'Create CAPA', site: site }, { id: 'watchlist_add', label: 'Watchlist', site: site }],
      followUps: ['Show similar sites', 'What if it closes?', 'Plan a targeted visit']
    };
  });
  def('risk_score_drivers', [['drives', 'driver'], ['risk score']], ['site'], 'What drives the risk score for Site 114?', function (e, data) {
    var site = defaultSite(data, e); var snap = latestSnap(data, site.studyId); var risk = siteRiskAt(data, site.id, snap.id);
    return {
      text: risk.drivers.map(function (d) { return KRI.byCode(d.kriCode).name + ': weight ' + d.weight + ', ' + d.status; }).join('; ') + '.',
      basedOn: basedOn(snap), viewHref: 'site-profile.html?site=' + site.id, followUps: ['Why is this site flagged?']
    };
  });
  def('similar_sites', [['similar sites']], ['site'], 'Show me similar sites', function (e, data) {
    var site = defaultSite(data, e);
    var peers = data.sites.filter(function (s) { return s.id !== site.id && s.craTeam === site.craTeam && s.studyId === site.studyId; }).slice(0, 4);
    return { text: peers.length ? 'Sites sharing CRA team ' + site.craTeam + ': ' + peers.map(function (p) { return 'Site ' + p.code; }).join(', ') + '.' : 'No sites share this site’s CRA team.', basedOn: 'Based on the current roster.', followUps: ['Why is Site 114 flagged?'] };
  });
  def('explain_signal', [['explain']], ['signal'], 'Explain this signal', function (e, data) {
    var sig = e.signal || data.signals.filter(function (s) { return s.id === 'SIG-0412'; })[0];
    return { text: sig.description, basedOn: 'Based on snapshot ' + FMT.dateShort(data.snapshots.filter(function (s) { return s.id === sig.snapshotId; })[0].date) + '.', actions: [{ id: 'create_capa', label: 'Create CAPA', signal: sig }, { id: 'assign_owner', label: 'Assign owner', signal: sig }], followUps: ['Why is this flagged?'] };
  });
  def('explain_kri_status', [['why'], ['red', 'status']], ['kri', 'site'], 'Why is AE rate red for Site 114?', function (e, data) {
    var site = defaultSite(data, e), k = defaultKri(e); var snap = latestSnap(data, site.studyId);
    var r = kriRow(data, site.id, k.code, snap.id); var avg = studyAvg(data, site.studyId, k.code, snap.id);
    return { text: k.name + ' at Site ' + site.code + ' is ' + FMT.num(r.value, 2) + ' vs study average ' + FMT.num(avg, 2) + '. Status: ' + FMT.statusLabel(r.status) + '.', basedOn: basedOn(snap), viewHref: 'kri-detail.html?kri=' + k.code + '&site=' + site.id, followUps: ['Show the trend'] };
  });
  def('site_summary', [['summarize'], ['summary']], ['site'], 'Summarize Site 114', function (e, data) {
    var site = defaultSite(data, e); var snap = latestSnap(data, site.studyId); var risk = siteRiskAt(data, site.id, snap.id);
    var openSignals = data.signals.filter(function (s) { return s.siteId === site.id && SIGNALS_ENGINE.isOpen(s.status); }).length;
    var openCapas = data.capas.filter(function (c) { return c.siteId === site.id && c.state !== 'Closed'; }).length;
    var plan = data.monitoringPlan.filter(function (p) { return p.siteId === site.id; })[0];
    return { text: 'Site ' + site.code + ', ' + site.country + '. Risk ' + risk.score + ' (' + risk.band + '). ' + openSignals + ' open signals, ' + openCapas + ' open CAPAs. Next step: ' + (plan ? plan.recommendedType : 'none recommended') + '.', basedOn: basedOn(snap), viewHref: 'site-profile.html?site=' + site.id };
  });
  def('kri_drivers_subjects', [['which subjects', 'drive this']], ['kri', 'site'], 'Which subjects drive this?', function (e, data) {
    var site = defaultSite(data, e);
    var subs = data.subjects.filter(function (s) { return s.siteId === site.id; }).slice(0, 5);
    return { text: 'Top subjects at Site ' + site.code + ': ' + subs.map(function (s) { return s.id; }).join(', ') + '.', basedOn: 'Based on the current roster.', viewHref: 'site-profile.html?site=' + site.id };
  });

  def('sites_most_at_risk', [['most at risk'], ['which sites']], [], 'Which sites are most at risk?', function (e, data) {
    var rows = [];
    data.studies.forEach(function (study) {
      var snap = latestSnap(data, study.id);
      data.sites.filter(function (s) { return s.studyId === study.id && s.status === 'active'; }).forEach(function (site) {
        var risk = siteRiskAt(data, site.id, snap.id);
        if (risk && risk.score != null) rows.push({ site: site, score: risk.score, band: risk.band });
      });
    });
    var top = rows.sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    return {
      text: top.map(function (r) { return 'Site ' + r.site.code + ' (' + r.score + ')'; }).join(', ') + '.',
      basedOn: 'Based on the latest finalized snapshot per study.', viewHref: 'sites.html',
      followUps: ['Why is Site ' + top[0].site.code + ' flagged?', 'Compare Poland and Germany on data entry']
    };
  });

  // ---------- Compare ----------
  def('compare_countries', [['compare'], ['countries', 'country']], ['country', 'kri'], 'Compare Poland and Germany on data entry', function (e, data) {
    var k = defaultKri(e) || KRI.byCode('entry_timeliness');
    var countries = data.countries.slice(0, 2).map(function (c) { return c.iso; });
    if (e.country) countries = [e.country.iso];
    var lines = countries.map(function (iso) {
      var siteIds = data.sites.filter(function (s) { return s.country === iso; }).map(function (s) { return s.id; });
      var vals = siteIds.map(function (id) { var s = data.sites.filter(function (x) { return x.id === id; })[0]; var snap = latestSnap(data, s.studyId); var r = kriRow(data, id, k.code, snap.id); return r ? r.value : null; }).filter(function (v) { return v != null; });
      var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
      return (global.RBQM_REFERENCE.countryByIso(iso) || { name: iso }).name + ': ' + (avg != null ? FMT.num(avg, 2) : '–');
    });
    return { text: k.name + ' - ' + lines.join(', ') + '.', basedOn: 'Based on the latest snapshot per study.', viewHref: 'benchmarking.html' };
  });
  def('compare_cros', [['which cro', 'slowest'], ['compare cro']], [], 'Which CRO is slowest on queries?', function (e, data) {
    var rows = data.cros.map(function (c) {
      var siteIds = data.sites.filter(function (s) { return s.croId === c.id; }).map(function (s) { return s.id; });
      var vals = siteIds.map(function (id) { var s = data.sites.filter(function (x) { return x.id === id; })[0]; var snap = latestSnap(data, s.studyId); var r = kriRow(data, id, 'query_response_time', snap.id); return r ? r.value : null; }).filter(function (v) { return v != null; });
      return { name: c.name, avg: vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0 };
    }).sort(function (a, b) { return b.avg - a.avg; });
    return { text: rows.map(function (r) { return r.name + ': ' + FMT.num(r.avg, 1) + 'd'; }).join(', ') + '. ' + rows[0].name + ' is slowest.', basedOn: 'Based on the latest snapshots.', viewHref: 'cro-oversight.html' };
  });
  def('compare_sites', [['compare site']], ['site'], 'Compare Site 114 and Site 207', function (e, data) {
    var siteA = defaultSite(data, e);
    var siteB = data.sites.filter(function (s) { return s.code === '207'; })[0];
    var snapA = latestSnap(data, siteA.studyId), snapB = latestSnap(data, siteB.studyId);
    var lines = KRI.KRIS.filter(function (k) { return k.active; }).map(function (k) {
      var rA = kriRow(data, siteA.id, k.code, snapA.id), rB = kriRow(data, siteB.id, k.code, snapB.id);
      return k.shortName + ': ' + (rA ? FMT.num(rA.value, 2) : '–') + ' vs ' + (rB ? FMT.num(rB.value, 2) : '–');
    });
    return { text: 'Site ' + siteA.code + ' vs Site ' + siteB.code + ' - ' + lines.join(', ') + '.', basedOn: 'Based on the latest snapshot per site.' };
  });
  def('benchmark_vs_portfolio', [['vs portfolio', 'benchmark']], ['site', 'country', 'cro'], 'How does Site 114 compare to the portfolio?', function (e, data) {
    var site = defaultSite(data, e); var snap = latestSnap(data, site.studyId);
    var rows = KRI.KRIS.filter(function (k) { return k.active; }).map(function (k) {
      var r = kriRow(data, site.id, k.code, snap.id); var avg = studyAvg(data, site.studyId, k.code, snap.id);
      return k.shortName + ' ' + (r && r.value > avg ? 'above' : 'below') + ' average';
    });
    return { text: 'Site ' + site.code + ': ' + rows.join(', ') + '.', basedOn: basedOn(snap), viewHref: 'benchmarking.html' };
  });
  def('worst_kri', [['worst indicator', 'which indicator']], [], 'Which indicator is worst overall?', function (e, data) {
    var counts = {};
    KRI.KRIS.filter(function (k) { return k.active; }).forEach(function (k) { counts[k.code] = 0; });
    data.studies.forEach(function (study) {
      var snap = latestSnap(data, study.id);
      data.kriResults.filter(function (r) { return r.snapshotId === snap.id && r.status === 'action'; }).forEach(function (r) { if (counts[r.kriCode] != null) counts[r.kriCode]++; });
    });
    var worst = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
    return { text: KRI.byCode(worst).name + ' has the most red sites (' + counts[worst] + ').', basedOn: 'Based on the latest snapshot per study.', viewHref: 'kri-detail.html?kri=' + worst };
  });

  // ---------- Predict ----------
  def('forecast_breach', [['breach in 30', 'breach in 60', 'breach in 90', 'will breach']], [], 'Which KRIs will breach in 60 days?', function (e, data) {
    var hm = (e.rawText || '').match(/\b(30|60|90)\b/), horizon = hm ? parseInt(hm[1], 10) : 60;
    var rows = data.qtlDefs.map(function (d) {
      var runs = data.qtlRuns.filter(function (r) { return r.qtlId === d.id; }).map(function (r) { return { value: r.value }; });
      var f = FORECAST.forecastBreach(runs, d.limit, 'high', horizon);
      return { name: d.parameter + ' (' + d.studyId + ')', p: f.probability };
    }).sort(function (a, b) { return b.p - a.p; }).slice(0, 3);
    return { text: rows.map(function (r) { return r.name + ' ' + Math.round(r.p * 100) + '%'; }).join(', ') + ' (' + horizon + ' days).', basedOn: 'Based on the trend across finalized snapshots.', actions: [{ id: 'create_capa', label: 'Create CAPA for top item' }], viewHref: 'quality-limits.html' };
  });
  def('qtl_forecast', [['will the', 'limit breach'], ['qtl forecast']], [], 'Will the SAE limit breach this quarter?', function (e, data) {
    var d = data.qtlDefs.filter(function (x) { return x.parameter.indexOf('SAE') !== -1; })[0];
    var runs = data.qtlRuns.filter(function (r) { return r.qtlId === d.id; }).map(function (r) { return { value: r.value }; });
    var f = FORECAST.forecastBreach(runs, d.limit, 'high');
    return { text: d.parameter + ' is ' + FMT.pct(d.currentValue, 1) + ' vs ' + FMT.pct(d.limit, 0) + ' limit. ' + Math.round(f.probability * 100) + '% chance of breach in 60 days.', basedOn: 'Based on the trend across finalized snapshots.', viewHref: 'quality-limits.html' };
  });
  def('site_trend_forecast', [['where is', 'heading']], ['site'], 'Where is Site 114 heading?', function (e, data) {
    var site = defaultSite(data, e); var k = defaultKri(e);
    var snaps = data.snapshots.filter(function (s) { return s.studyId === site.studyId && s.status === 'Finalized'; }).sort(function (a, b) { return a.index - b.index; });
    var series = snaps.map(function (s, i) { var r = kriRow(data, site.id, k.code, s.id); return { x: i, y: r ? r.value : 0 }; });
    var fit = FORECAST.linearFit(series);
    return { text: 'Site ' + site.code + ' ' + k.name.toLowerCase() + ' is ' + (fit.slope > 0 ? 'rising' : 'falling') + ' snapshot over snapshot.', basedOn: 'Based on the trend across finalized snapshots.', viewHref: 'kri-detail.html?kri=' + k.code + '&site=' + site.id };
  });

  // ---------- What-if ----------
  def('whatif_site_closes', [['what if'], ['closes', 'close']], ['site'], 'What if Site 114 closes?', function (e, data) {
    var site = defaultSite(data, e); var snap = latestSnap(data, site.studyId); var risk = siteRiskAt(data, site.id, snap.id);
    var subs = data.subjects.filter(function (s) { return s.siteId === site.id; }).length;
    return { text: 'Closing Site ' + site.code + ' would remove ' + (risk && risk.band === 'high' ? 'one high-risk site' : 'one site') + ' and ' + subs + ' subjects to transfer.', basedOn: basedOn(snap), viewHref: 'scenario-view.html', actions: [{ id: 'save_scenario', label: 'Save scenario' }] };
  });
  def('whatif_threshold', [['what if i tighten', 'tighten']], ['kri'], 'What if I tighten missed visits to 4%?', function (e, data) {
    var k = e.kri || KRI.byCode('missed_visits');
    var numMatch = (e.rawText || '').match(/(\d+(\.\d+)?)%/);
    var newRed = numMatch ? parseFloat(numMatch[1]) / 100 : k.red;
    var changed = 0;
    data.studies.forEach(function (study) {
      var snap = latestSnap(data, study.id);
      data.kriResults.filter(function (r) { return r.kriCode === k.code && r.snapshotId === snap.id; }).forEach(function (r) {
        var ns = r.value > newRed ? 'action' : (r.value > k.amber ? 'watch' : 'ok');
        if (ns !== r.status) changed++;
      });
    });
    return { text: changed + ' sites would change status if the red threshold for ' + k.name + ' moved to ' + FMT.pct(newRed, 0) + '.', basedOn: 'Based on the latest snapshot per study.', viewHref: 'kri-detail.html?kri=' + k.code };
  });
  def('whatif_enrollment_slip', [['what if'], ['enrollment slip', 'enrollment slips']], [], 'What if enrollment slips 2 months?', function () {
    return { text: 'A 2-month enrollment slip shifts exposure (and forecasts) by about 60 days; monitoring visits due in that window would move out by the same amount.', basedOn: 'Illustrative estimate.', viewHref: 'scenario-view.html' };
  });
  def('whatif_cro_change', [['cro performance drops', 'cro change']], ['cro'], 'What if CRO-B performance drops 10%?', function (e, data) {
    var cro = e.cro || data.cros[1];
    var affected = data.sites.filter(function (s) { return s.croId === cro.id; }).length;
    return { text: 'A 10% drop at ' + cro.name + ' would likely affect ' + affected + ' sites’ query response and entry timeliness.', basedOn: 'Illustrative estimate.', viewHref: 'scenario-view.html' };
  });

  // ---------- Act (always confirmation first - handled by ai-panel.js) ----------
  def('create_capa', [['create a capa', 'create capa']], ['site', 'signal'], 'Create a CAPA for it', function (e, data, store, ctx) {
    var site = e.site || ctx.lastSite; var sig = e.signal || ctx.lastSignal;
    return { text: 'Ready to create a CAPA' + (site ? ' for Site ' + site.code : '') + '. Confirm to continue.', basedOn: 'Owner defaults to the central monitoring lead, due in 30 days.', actions: [{ id: 'create_capa', label: 'Confirm', site: site, signal: sig }] };
  });
  def('assign_owner', [['assign'], ['to']], ['signal', 'site'], 'Assign this signal to someone', function (e, data) {
    return { text: 'Choose an owner to assign.', basedOn: 'Writes to the audit trail once confirmed.', actions: [{ id: 'assign_owner', label: 'Choose owner', signal: e.signal }] };
  });
  def('watchlist_add', [['watchlist', 'watch list']], ['site'], 'Put Site 114 on the watchlist', function (e, data, store, ctx) {
    var site = e.site || ctx.lastSite;
    return { text: (site ? 'Site ' + site.code : 'This item') + ' will be set to Watch and rechecked next snapshot.', basedOn: 'Writes to the audit trail once confirmed.', actions: [{ id: 'watchlist_add', label: 'Confirm', site: site }] };
  });
  def('raise_edc_queries', [['raise queries', 'raise edc']], ['site'], 'Raise queries for the open items at Site 114', function (e, data) {
    var site = defaultSite(data, e);
    var openQueries = 10;
    return { text: 'This will simulate raising ' + openQueries + ' queries in EDC for Site ' + site.code + ' and log it.', basedOn: 'Simulated push, no live EDC connection.', actions: [{ id: 'raise_edc_queries', label: 'Confirm', site: site }] };
  });
  def('dismiss_signal', [['dismiss']], ['signal'], 'Dismiss this signal', function (e, data, store, ctx) {
    var sig = e.signal || ctx.lastSignal;
    return { text: 'Enter a reason before dismissing' + (sig ? ' ' + sig.id : '') + '.', basedOn: 'Writes to the audit trail once confirmed.', actions: [{ id: 'dismiss_signal', label: 'Dismiss', signal: sig }] };
  });
  def('approve_capa', [['approve']], ['capa'], 'Approve this CAPA', function (e) {
    return { text: 'Switch to the Quality approver view on Issues and CAPA to approve with an e-signature.', basedOn: 'Approval requires the Quality approver role.', viewHref: 'issues-capa.html' };
  });
  def('schedule_visit', [['schedule a visit', 'targeted visit']], ['site'], 'Schedule a targeted visit to Site 114', function (e, data) {
    var site = defaultSite(data, e);
    return { text: 'This will simulate a CTMS task for a targeted visit to Site ' + site.code + ' and log it.', basedOn: 'Simulated push, no live CTMS connection.', actions: [{ id: 'schedule_visit', label: 'Confirm', site: site }] };
  });

  // ---------- Plan ----------
  def('draft_monitoring_plan', [['plan monitoring', 'draft the plan', 'monitoring visits for next month']], [], 'Plan monitoring visits for next month', function (e, data) {
    var onsite = data.monitoringPlan.filter(function (p) { return p.recommendedType.indexOf('on-site') !== -1 || p.recommendedType.indexOf('On-site') !== -1 || p.recommendedType.indexOf('Targeted') !== -1 || p.recommendedType.indexOf('Follow-up') !== -1; }).length;
    var remote = data.monitoringPlan.filter(function (p) { return p.recommendedType === 'Remote check'; }).length;
    return { text: onsite + ' on-site visits and ' + remote + ' remote checks are recommended.', basedOn: 'Based on the current risk bands and open CAPAs.', viewHref: 'monitoring-plan.html', actions: [{ id: 'open_page', label: 'Open planner', href: 'monitoring-plan.html' }] };
  });
  def('sites_skip_visit', [['skip an on-site', 'skip a visit']], [], 'Which sites can skip an on-site visit?', function (e, data) {
    var sites = data.monitoringPlan.filter(function (p) { return p.recommendedType === 'Remote check'; }).slice(0, 8);
    return { text: sites.length + ' sites are low risk with no open signals, so a remote check is enough.', basedOn: 'Based on the current risk bands.', viewHref: 'monitoring-plan.html' };
  });
  def('sdv_scope', [['sdv scope', 'what sdv']], ['site'], 'What SDV scope should Site 114 have?', function (e, data) {
    var site = defaultSite(data, e);
    var plan = data.monitoringPlan.filter(function (p) { return p.siteId === site.id; })[0];
    return { text: plan ? plan.sdvScope + '. ' + plan.rationale : 'No recommendation available.', basedOn: 'Based on the current monitoring plan.', viewHref: 'monitoring-plan.html' };
  });

  // ---------- Write ----------
  def('weekly_summary', [['weekly summary', 'write the weekly']], [], 'Write the weekly summary', function (e, data) {
    var s = data.summary;
    return { text: 'Portfolio health ' + s.healthScore + ', ' + s.highRiskSites + ' high-risk sites, ' + s.openSignals + ' open signals, ' + s.overdueCapas + ' overdue CAPAs.', basedOn: 'Based on the latest finalized snapshots.', actions: [{ id: 'copy', label: 'Copy' }, { id: 'add_to_report', label: 'Add to report' }] };
  });
  def('exec_brief', [['executive brief', 'draft the brief']], [], 'Draft the executive brief', function () {
    return { text: 'Opening the executive brief.', basedOn: 'Based on the latest finalized snapshots.', viewHref: 'reports-audit.html' };
  });
  def('capa_root_cause', [['root cause']], ['capa', 'site'], 'Write the root cause for this CAPA', function (e, data) {
    var site = e.site || data.sites.filter(function (s) { return s.code === '114'; })[0];
    return { text: 'Draft: site staff unaware of the reporting rule after staff turnover. Corrective: retrain staff and add a monitoring check. Preventive: add the check to the next visit template.', basedOn: 'Drafted from signal facts for Site ' + site.code + '.', viewHref: 'issues-capa.html' };
  });
  def('site_brief', [['brief on', 'steering meeting']], ['site'], 'Prepare a brief on Site 114 for the steering meeting', function (e, data) {
    var site = defaultSite(data, e); var snap = latestSnap(data, site.studyId); var risk = siteRiskAt(data, site.id, snap.id);
    return { text: 'Site ' + site.code + ': risk ' + risk.score + ' (' + risk.band + '). See the site profile for full chart references.', basedOn: basedOn(snap), viewHref: 'site-profile.html?site=' + site.id };
  });

  // ---------- Prepare ----------
  def('inspection_readiness', [['inspection ready', 'inspection-ready']], [], 'Are we inspection-ready?', function (e, data) {
    return { text: 'Open the Inspection readiness page for the current checklist and completeness score.', basedOn: 'Computed from current CAPAs, QTLs and risk assessments.', viewHref: 'inspection-readiness.html' };
  });

  // ---------- Summarize ----------
  def('what_changed', [['what changed', 'since the last snapshot']], [], 'What changed since the last snapshot?', function () {
    return { text: 'Opening What changed for the full feed.', basedOn: 'Based on the last two finalized snapshots per study.', viewHref: 'what-changed.html' };
  });
  def('overdue_items', [['what is overdue', 'overdue']], [], 'What is overdue?', function (e, data) {
    var overdue = data.capas.filter(function (c) { return CAPA_ENGINE.isOverdue(c, CFG.asOfDate); });
    return { text: overdue.length + ' CAPAs overdue: ' + overdue.map(function (c) { return c.id + ' (' + CAPA_ENGINE.daysOverdue(c, CFG.asOfDate) + 'd)'; }).join(', ') + '.', basedOn: 'Based on today’s date.', viewHref: 'issues-capa.html' };
  });
  def('approvals_waiting', [['waiting for my approval', 'approvals waiting']], [], 'What is waiting for my approval?', function (e, data) {
    var submitted = data.capas.filter(function (c) { return c.state === 'Submitted'; });
    return { text: submitted.length + ' CAPAs are waiting for approval: ' + submitted.map(function (c) { return c.id; }).join(', ') + '.', basedOn: 'Based on current CAPA states.', viewHref: 'issues-capa.html' };
  });
  def('morning_briefing', [['morning briefing', 'briefing']], [], 'Morning briefing', function (e, data) {
    var newSignals = data.signals.filter(function (s) { return s.status === 'New'; }).length;
    var nearQtl = data.summary.nearQtls;
    var submitted = data.capas.filter(function (c) { return c.state === 'Submitted'; }).length;
    return { text: newSignals + ' new signals, ' + nearQtl + ' quality limit near breach, ' + submitted + ' approvals waiting.', basedOn: 'Based on the latest finalized snapshots.', viewHref: 'dashboard.html' };
  });
  def('study_status', [['how is', 'doing']], ['study'], 'How is CV-5645 doing?', function (e, data) {
    var study = e.study || data.studies[0]; var snap = latestSnap(data, study.id);
    var sites = data.sites.filter(function (s) { return s.studyId === study.id; });
    var highRisk = sites.filter(function (s) { var r = siteRiskAt(data, s.id, snap.id); return r && r.band === 'high'; }).length;
    var openSignals = data.signals.filter(function (s) { return s.studyId === study.id && SIGNALS_ENGINE.isOpen(s.status); }).length;
    return { text: study.id + ': ' + highRisk + ' high-risk sites, ' + openSignals + ' open signals.', basedOn: basedOn(snap), viewHref: 'study-detail.html?study=' + study.id };
  });

  // ---------- Navigate ----------
  def('open_page', [['open'], ['take me to'], ['show the']], ['site', 'country', 'kri'], 'Open signals for Poland', function (e, data) {
    var href = 'dashboard.html'; var params = {};
    if (e.country) { href = 'sites.html'; params.country = e.country.iso; }
    if (e.kri) { href = 'kri-detail.html'; params.kri = e.kri.code; }
    if (e.site) { href = 'site-profile.html'; params.site = e.site.id; }
    var qs = Object.keys(params).map(function (k) { return k + '=' + params[k]; }).join('&');
    return { text: 'Opening ' + href.replace('.html', '').replace('-', ' ') + (qs ? ' filtered.' : '.'), basedOn: 'Navigation only, no data changed.', viewHref: href + (qs ? '?' + qs : '') };
  });

  // ---------- Explain ----------
  def('glossary_term', [['what is a', 'what is', 'what does'], ['mean']], [], 'What is a funnel plot?', function (e, data) {
    var text = ' ' + (e.rawText || '') + ' ';
    var best = null, bestLen = 0;
    (global.GLOSSARY || []).forEach(function (g) {
      [g.term, g.term.replace(/\s*\(.*\)\s*$/, '')].concat(g.aliases || []).forEach(function (k) {
        var kk = k.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (kk.length > bestLen && text.indexOf(' ' + kk + ' ') !== -1) { best = g; bestLen = kk.length; }
      });
    });
    if (!best) return { text: 'I could not find that term. The Glossary and help page lists all terms.', basedOn: 'From the product glossary.', viewHref: 'glossary-help.html' };
    return { text: best.definition + ' Why it matters: ' + best.why, basedOn: 'From the product glossary (' + best.category + ').', viewHref: 'glossary-help.html#term=' + best.term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), followUps: (best.related || []).slice(0, 2).map(function (r) { return 'What is ' + r + '?'; }) };
  });
  def('regulatory_e6r3', [['e6', 'r3'], ['regulatory']], [], 'What does E6(R3) require?', function () {
    return { text: 'A risk-proportionate approach, pre-specified critical-to-quality factors and acceptable ranges, and sponsor accountability for oversight even when work is delegated. This prototype is not a validated system.', basedOn: 'General regulatory background, not legal advice.' };
  });
  def('how_scored', [['how is the risk score', 'how scored'], ['calculated', 'calculate', 'work', 'works']], [], 'How is the risk score calculated?', function () {
    return { text: 'A weighted average of indicator statuses (0/55/100 for on track/watch/action needed), with safety indicators weighted highest. Bands: low 0-30, medium 31-60, high 61-100. Thresholds and weights are illustrative defaults.', basedOn: 'From engine/scoring.js.', viewHref: 'glossary-help.html' };
  });

  // ---------- Configure ----------
  def('show_thresholds', [['show thresholds', 'thresholds for']], ['kri'], 'Show thresholds for SAE', function (e, data) {
    var k = e.kri || KRI.byCode('sae_rate');
    return { text: k.name + ': amber ' + k.amber + ', red ' + k.red + ' (' + k.method + ').', basedOn: 'From the KRI catalog.', viewHref: 'kri-detail.html?kri=' + k.code };
  });
  def('toggle_kri', [['turn off', 'turn on']], ['kri'], 'Turn off enrollment rate', function (e, data) {
    var k = e.kri || KRI.byCode('enrollment_rate');
    return { text: 'This will toggle ' + k.name + (k.active ? ' off' : ' on') + '.', basedOn: 'Writes to the audit trail once confirmed.', actions: [{ id: 'toggle_kri', label: 'Confirm', kri: k }] };
  });
  def('change_threshold', [['set'], ['threshold to']], ['kri'], 'Set missed visits red threshold to 8%', function (e, data) {
    var k = e.kri || KRI.byCode('missed_visits');
    var numMatch = (e.rawText || '').match(/(\d+(\.\d+)?)%/);
    var newRed = numMatch ? parseFloat(numMatch[1]) / 100 : k.red;
    return { text: 'Preview: set ' + k.name + ' red threshold to ' + FMT.pct(newRed, 0) + '.', basedOn: 'Shows how many sites would change status before saving.', viewHref: 'kri-detail.html?kri=' + k.code };
  });

  // ---------- Addendum v0.4 ----------
  function medFor(data, id) { return data.medical.bySubject[id] || null; }

  def('subject_summary', [['subject', 'subj'], ['summarize', 'summary', 'summarise', 'tell me about']], ['site'], 'Summarize subject SUBJ-114-005', function (e, data) {
    var subj = e.subject || data.subjects.filter(function (s) { return s.id === data.medical.ranked[0].subjectId; })[0];
    var site = data.sites.filter(function (s) { return s.id === subj.siteId; })[0];
    var devs = data.deviations.filter(function (d) { return d.subjectId === subj.id; }).length;
    var aes = data.adverseEvents.filter(function (x) { return x.subjectId === subj.id; });
    var m = medFor(data, subj.id), text = subj.id + ' (Site ' + site.code + ', arm ' + subj.arm + ', ' + subj.status + ') enrolled ' + FMT.dateShort(subj.enrollDate) + '. ' + devs + ' protocol deviation' + (devs === 1 ? '' : 's') + ', ' + aes.length + ' adverse event' + (aes.length === 1 ? '' : 's') + ' (' + aes.filter(function (x) { return x.serious; }).length + ' serious).';
    if (m) {
      var r = data.medical.ranked.filter(function (x) { return x.subjectId === subj.id; })[0];
      text += ' ' + m.dosing.filter(function (d) { return d.status !== 'Administered'; }).length + ' missed or reduced doses, ' + r.abnormalReadings + ' abnormal readings in the last 30 days.';
    } else text += ' Dosing and vitals are only generated for Site 114 and three Safety review subjects.';
    return { text: text, basedOn: 'Based on subject records up to ' + FMT.dateShort(G.iso(G.ASOF)) + '.', viewHref: 'subject-detail.html?subject=' + subj.id, actions: [{ id: 'open_page', label: 'Open subject', href: 'subject-detail.html?subject=' + subj.id }], followUps: ['Which subjects need medical review first?'] };
  });
  def('medical_review_priority', [['medical review', 'needs review', 'need review', 'need medical'], ['subjects', 'subject', 'first', 'priority']], [], 'Which subjects need medical review first?', function (e, data) {
    var top = data.medical.ranked.slice(0, 3);
    return { text: top.map(function (r) { return r.subjectId + ' (score ' + r.priority + ': ' + r.openSaes + ' SAEs, ' + r.abnormalReadings + ' abnormal readings, ' + r.lateReports + ' late reports)'; }).join('; ') + '.',
      basedOn: 'Priority score = open SAEs x 3 + abnormal readings in 30 days + late reports x 2. Covers Site 114 and three listed subjects.', viewHref: 'safety-review.html',
      actions: [{ id: 'open_page', label: 'Open top subject', href: 'subject-detail.html?subject=' + top[0].subjectId }], followUps: ['Summarize subject ' + top[0].subjectId] };
  });
  def('protocol_complexity', [['complexity', 'complex'], ['protocol']], [], 'How complex is the protocol?', function (e, data) {
    var a = data.protocolAnalysis, top = a.drivers.slice().sort(function (x, y) { return y.points / y.max - x.points / x.max; }).slice(0, 2);
    return { text: a.studyId + ' scores ' + a.complexityScore + ' of 100 for complexity against a portfolio median of ' + a.portfolioMedian + '. Biggest drivers: ' + top.map(function (d) { return d.label.toLowerCase() + ' (' + d.points + ' of ' + d.max + ')'; }).join(' and ') + '. Top hot spot: ' + a.hotSpots[0].title + ' (' + Math.round(a.hotSpots[0].probability * 100) + '%).',
      basedOn: 'Based on the simulated protocol analysis ' + a.protocolVersion + '.', viewHref: 'protocol-intelligence.html', actions: [{ id: 'open_page', label: 'Open Protocol intelligence', href: 'protocol-intelligence.html' }], followUps: ['What is a hot spot?'] };
  });
  def('risk_library_suggest', [['library', 'template', 'suggest'], ['risk', 'risks']], ['study'], 'Suggest risks from the library for oncology', function (e, data) {
    var LIB = global.RBQM_RISK_LIBRARY, t = e.rawText || '';
    var ind = LIB.indications.filter(function (i) { return t.indexOf(i.toLowerCase()) !== -1 || (i === 'Cardiovascular' && t.indexOf('cardio') !== -1) || (i === 'Metabolic' && t.indexOf('diabet') !== -1); })[0] || (e.study ? e.study.indication : 'Cardiovascular');
    var list = LIB.templates.filter(function (x) { return x.indication === ind; });
    var study = e.study || data.studies.filter(function (s) { return s.indication === ind; })[0];
    return { text: ind + ' templates: ' + list.map(function (x) { return x.description + ' (score ' + (x.probability * x.impact) + ')'; }).join('; ') + '.', basedOn: 'From the risk library (' + list.length + ' templates). Nothing is added until you confirm.', viewHref: 'risk-register.html',
      actions: [{ id: 'add_library_risk', label: 'Add top template as draft', template: list[0], studyId: study.id }], followUps: ['Open the Risk register'] };
  });
  def('enrollment_forecast', [['enrollment', 'enrolment', 'last subject'], ['forecast', 'projected', 'on track', 'when', 'will']], ['study'], 'When will enrollment finish?', function (e, data) {
    var days = (e.rawText || '').match(/\b(30|60|90)\b/), h = days ? parseInt(days[1], 10) : 60;
    var list = e.study ? data.enrollment.filter(function (x) { return x.studyId === e.study.id; }) : data.enrollment;
    return { text: list.map(function (x) {
      var f = FORECAST.forecastEnrollment(x.series, x.target, x.plannedLastSubjectIn, h);
      return x.studyId + ': ' + FMT.int(x.enrolled) + ' of ' + FMT.int(x.target) + ' enrolled, ' + FMT.int(f.projected) + ' in ' + h + ' days (range ' + FMT.int(f.band.low) + ' to ' + FMT.int(f.band.high) + ')' +
        (f.projectedLastSubjectIn ? ', last subject in ' + FMT.dateShort(f.projectedLastSubjectIn) + ' against a plan of ' + FMT.dateShort(x.plannedLastSubjectIn) + ' (' + Math.round(f.onTrackProbability * 100) + '% chance of meeting it)' : ', stalled');
    }).join('. ') + '.', basedOn: 'Based on the enrollment trend over the last 6 months.', viewHref: 'studies.html', followUps: ['Which KRIs will breach in 60 days?'] };
  });
  def('explain_calculation', [['calculation', 'calculated', 'calculate', 'formula'], ['explain', 'how is', 'how was', 'show', 'how do']], ['site', 'kri'], 'How is the health score calculated?', function (e, data) {
    var t = e.rawText || '', id = 'health', C = global.RBQM_CALC;
    var site = e.site || data.sites.filter(function (s) { return s.code === '114'; })[0];
    if (t.indexOf('risk score') !== -1) id = 'siterisk|' + site.id;
    else if (e.kri) id = 'kri|' + site.id + '|' + e.kri.code;
    else if (/\b(roi|saving|savings|cost)\b/.test(t)) id = 'roi|cost';
    else if (t.indexOf('visits avoided') !== -1) id = 'roi|visits';
    else if (/\b(limit|qtl)\b/.test(t)) id = 'qtl|' + data.qtlDefs[0].id;
    var c = C.resolve(id);
    return { text: c.title + ': ' + c.resultValue + '. ' + c.formula + ' Inputs: ' + c.inputs.map(function (i) { return i.label + ' ' + i.value; }).join('; ') + '.', basedOn: 'Based on ' + c.subtitle + '. Sources: ' + c.sources.join(', ') + '.',
      actions: [{ id: 'show_calculation', label: 'Show calculation', calcId: id }], followUps: ['How is the risk score for Site 114 calculated?'] };
  });
  def('page_help', [['this page'], ['what', 'help', 'explain', 'about']], [], 'What is this page?', function (e, data) {
    var title = global.document ? global.document.title.split('|')[0].trim() : '', key = global.RBQM_GLOSSARY_TIP ? global.RBQM_GLOSSARY_TIP.helpKey({ title: title }) : null, h = key && global.PAGE_HELP[key];
    if (!h) return { text: 'I do not have help text for this page. The Glossary and help page explains every page and term.', basedOn: 'From the page help.', viewHref: 'glossary-help.html' };
    return { text: key + '. What it shows: ' + h.what + ' What to do: ' + h.use + ' Tip: ' + h.tip, basedOn: 'From the page help.', viewHref: 'glossary-help.html', followUps: ['What is a funnel plot?'] };
  });

  // ---------- Addendum v0.5 ----------
  function riskList(data) { return global.RBQM_RISKS ? global.RBQM_RISKS.risks(data) : []; }

  def('risk_links', [['which indicators', 'indicators watch', 'watch', 'monitor', 'linked'], ['indicators', 'indicator']], ['riskId'], 'Which indicators watch R-01?', function (e, data) {
    var id = e.riskId || 'R-01', r = riskList(data).filter(function (x) { return x.id === id; })[0];
    if (!r) return { text: 'I could not find ' + id + '. The Risk register lists every risk.', basedOn: 'From the risk register.', viewHref: 'risk-register.html' };
    return { text: r.id + ' (' + r.name + ') is watched by ' + (r.links.map(function (l) { var k = KRI.byCode(l.kriCode); return (k ? k.name : l.kriCode) + ' (' + l.likelihoodPct + '% if it fires' + (k && !k.active ? ', inactive' : '') + ')'; }).join(', ') || 'no indicators') +
      '. Detection coverage is ' + r.coverage + '%, with ' + r.undetectedPct + '% likelihood that the risk is present and not detected.',
      basedOn: 'Based on the associated indicators saved for ' + r.id + '.', viewHref: 'risk-register.html?q=' + r.id,
      actions: [{ id: 'open_page', label: 'Open Risk register', href: 'risk-register.html?q=' + r.id }], followUps: ['Which risks have no active mitigation?'] };
  });
  def('mitigation_status', [['mitigation', 'mitigations'], ['no active', 'without', 'which risks', 'active']], [], 'Which risks have no active mitigation?', function (e, data) {
    var all = riskList(data), none = all.filter(function (r) { return !r.mitigations.some(function (m) { return m.status === 'Active'; }); }), acc = none.filter(function (r) { return r.status === 'Accepted'; });
    var open = none.filter(function (r) { return r.status !== 'Accepted'; }).sort(function (a, b) { return b.score - a.score; });
    return { text: none.length + ' of ' + all.length + ' risks have no active mitigation (' + acc.length + ' are accepted). Highest scores first: ' + open.slice(0, 4).map(function (r) { return r.id + ' (score ' + r.score + ', ' + r.status.toLowerCase() + ')'; }).join(', ') + '.',
      basedOn: 'Based on mitigation status in the risk register.', viewHref: 'risk-register.html', actions: [{ id: 'open_page', label: 'Open Risk register', href: 'risk-register.html' }], followUps: ['Which indicators watch ' + (open[0] ? open[0].id : 'R-01') + '?'] };
  });
  def('site_assessment', [['reassessed', 'reassess', 'assessment'], ['sites', 'site', 'show']], [], 'Show reassessed sites', function (e, data, store) {
    var notes = (store && store.get('notes')) || {}, keys = Object.keys(notes).filter(function (k) { return k.indexOf('assess-') === 0; });
    if (!keys.length) return { text: 'No sites have been reassessed yet. Open a Site profile and use Reassess to record your own rating.', basedOn: 'Based on your saved assessments.', viewHref: 'sites.html' };
    var rows = keys.map(function (k) {
      var siteId = k.slice(7), site = data.sites.filter(function (s) { return s.id === siteId; })[0], snap = latestSnap(data, site.studyId), risk = siteRiskAt(data, siteId, snap.id), a = notes[k];
      return 'Site ' + site.code + ': you rated ' + a.rating + ', system rating ' + (risk ? risk.band : 'n/a') + (risk && risk.band !== a.rating ? ' (differs)' : '') + ', reason: ' + a.reason;
    });
    return { text: keys.length + ' site' + (keys.length === 1 ? '' : 's') + ' reassessed. ' + rows.join('; ') + '.', basedOn: 'Based on your saved assessments. They do not change risk scores.', viewHref: 'sites.html' };
  });
  def('anomalies_summary', [['anomaly', 'anomalies'], ['any', 'data', 'show', 'summary', 'what']], [], 'Any data anomalies?', function (e, data, store) {
    var SG = global.RBQM_SIGNALS, rows = data.anomalies.rows.map(function (a) { return SG.effectiveAnomaly(a, store); }), isNew = rows.filter(function (a) { return a.status === 'New'; }), top = rows.filter(function (a) { return a.status !== 'Dismissed'; }).sort(function (a, b) { return b.score - a.score; });
    return { text: rows.length + ' data anomalies, ' + isNew.length + ' new. Highest: ' + top.slice(0, 2).map(function (a) { var s = data.sites.filter(function (x) { return x.id === a.siteId; })[0]; return 'Site ' + s.code + ', ' + a.variable.toLowerCase() + ' (' + a.type.toLowerCase() + ', score ' + a.score + ')'; }).join('; ') +
      '. ' + data.anomalies.visibilityGaps.length + ' sites have too little data to test. Anomalies need human review and do not imply misconduct.', basedOn: 'Based on statistical checks on entered data.', viewHref: 'signals.html?tab=anomalies',
      actions: [{ id: 'open_page', label: 'Open Data anomalies', href: 'signals.html?tab=anomalies' }], followUps: ['What is digit preference?'] };
  });

  global.RBQM_ASSISTANT_INTENTS = I;
})(window);
