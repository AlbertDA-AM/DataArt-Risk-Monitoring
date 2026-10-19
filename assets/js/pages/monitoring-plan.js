/* Monitoring plan: List + Calendar tabs, accept/override, impact panel (spec section 6, 8). */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var STORE = global.RBQM_STORE;

  function effective(item) { return Object.assign({}, item, STORE.get('monitoringPlan', item.siteId)); }

  function render(contentEl, data) {
    var view = 'list';

    function draw() {
      var items = data.monitoringPlan.map(effective);
      var roi = data.summary.roi;

      contentEl.innerHTML =
        '<div class="banner banner-watch"><span aria-hidden="true">&#9888;</span><div>' +
        '<b>' + items.filter(function (i) { return i.recommendedType.indexOf('On-site') !== -1 || i.recommendedType.indexOf('Targeted') !== -1; }).length + ' on-site visits are recommended this month.</b> ' +
        items.filter(function (i) { return i.recommendedType === 'Remote check'; }).length + ' can be done remotely.</div></div>' +
        '<div style="height:10px"></div>' +
        '<div class="grid grid-main-side">' +
        '<div><div class="tabs" id="planTabs"><button class="tab active" data-tab="list">List</button><button class="tab" data-tab="calendar">Calendar</button></div>' +
        '<div data-tab-panel="list">' + listHtml(items) + '</div>' +
        '<div data-tab-panel="calendar" hidden>' + calendarHtml(items) + '</div></div>' +
        impactPanel(roi, items) +
        '</div>';

      global.RBQM_TABS.init(document.getElementById('planTabs'));
      bindListActions(items);

      var bulkBtn = document.getElementById('bulkAcceptBtn');
      if (bulkBtn) bulkBtn.addEventListener('click', function () {
        items.filter(function (i) { return i.status === 'Recommended'; }).forEach(function (i) { STORE.patch('monitoringPlan', i.siteId, { status: 'Accepted' }); });
        STORE.logAudit('MonitoringPlan', 'bulk', null, 'Bulk accepted recommendations');
        global.RBQM_TOAST.show('Recommendations accepted');
        draw();
      });
    }

    function bindListActions(items) {
      document.querySelectorAll('.plan-accept-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          STORE.patch('monitoringPlan', b.dataset.site, { status: 'Accepted' });
          STORE.logAudit('MonitoringPlan', b.dataset.site, null, 'Recommendation accepted');
          global.RBQM_TOAST.show('Recommendation accepted');
          draw();
        });
      });
      document.querySelectorAll('.plan-override-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          global.RBQM_MODAL.open({
            title: 'Override with reason', confirmLabel: 'Save',
            bodyHtml: '<div class="field"><label>Reason</label><textarea class="text-input" id="overrideReason" rows="3"></textarea><div class="error" id="overrideErr" hidden>Enter a reason before dismissing</div></div>',
            onConfirm: function (modalEl) {
              var val = modalEl.querySelector('#overrideReason').value.trim();
              if (!val) { modalEl.querySelector('#overrideErr').hidden = false; return false; }
              STORE.patch('monitoringPlan', b.dataset.site, { status: 'Overridden', overrideReason: val });
              STORE.logAudit('MonitoringPlan', b.dataset.site, null, 'Overridden: ' + val);
              global.RBQM_TOAST.show('Override saved');
              draw(); return true;
            }
          });
        });
      });
    }

    var columns;
    function listHtml(items) {
      columns = [
        { key: 'site', label: 'Site', render: function (r) { var s = data.sites.filter(function (x) { return x.id === r.siteId; })[0]; return 'Site ' + s.code + ', ' + s.country; } },
        { key: 'type', label: 'Recommended', render: function (r) { return r.recommendedType; } },
        { key: 'due', label: 'Next due', render: function (r) { return FMT.dateShort(r.due); } },
        { key: 'sdv', label: 'SDV scope', render: function (r) { return r.sdvScope; } },
        { key: 'status', label: 'Status', render: function (r) { return '<span class="status-pill ' + (r.status === 'Accepted' ? 'status-ok' : r.status === 'Overridden' ? 'status-watch' : 'status-insufficient') + '">' + r.status + '</span>'; } },
        { key: 'actions', label: '', sortable: false, render: function (r) {
            return r.status === 'Recommended' ? '<button class="btn btn-sm plan-accept-btn" data-site="' + r.siteId + '">Accept</button> <button class="btn btn-sm plan-override-btn" data-site="' + r.siteId + '">Override</button>' : '–';
          } }
      ];
      return '<div class="card"><div class="table-toolbar"><div class="card-title">Recommended visits</div><div class="spacer"></div>' +
        '<button class="btn" id="bulkAcceptBtn">Bulk accept</button></div>' +
        global.RBQM_TABLE.render(columns, items) + '</div>';
    }

    function calendarHtml(items) {
      var byMonth = {};
      items.forEach(function (i) {
        var m = FMT.dateMonthYear(i.due);
        (byMonth[m] = byMonth[m] || []).push(i);
      });
      return '<div class="card">' + Object.keys(byMonth).map(function (m) {
        return '<div style="margin-bottom:10px"><b>' + m + '</b>' + byMonth[m].map(function (i) {
          var s = data.sites.filter(function (x) { return x.id === i.siteId; })[0];
          var tone = i.recommendedType.indexOf('Targeted') !== -1 ? 'action' : i.recommendedType === 'Remote check' ? 'ok' : 'watch';
          return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--c-border);font-size:11.5px">' +
            '<span><span class="status-dot status-' + tone + '"></span> Site ' + s.code + ' - ' + i.recommendedType + '</span><span class="muted">' + FMT.dateShort(i.due) + '</span></div>';
        }).join('') + '</div>';
      }).join('') + '</div>';
    }

    function impactPanel(roi, items) {
      var remote = items.filter(function (i) { return i.recommendedType === 'Remote check'; }).length;
      return '<div class="card"><div class="card-title">Impact</div><div class="card-subtitle">Planned vs traditional 100% SDV schedule.</div>' +
        '<div style="font-size:21px;font-weight:700">' + remote + '</div><div class="muted" style="font-size:10.5px;margin-bottom:8px">sites recommended remote-only this cycle</div>' +
        '<div style="font-size:15px;font-weight:700">' + roi.visitsAvoided + '</div><div class="muted" style="font-size:10.5px;margin-bottom:8px">on-site visits avoided (portfolio)</div>' +
        '<div style="font-size:15px;font-weight:700">' + FMT.int(roi.sdvHoursSaved) + ' h</div><div class="muted" style="font-size:10.5px">SDV effort saved</div>' +
        '<p class="muted" style="font-size:10.5px;margin-top:8px">Synthetic estimate.</p></div>';
    }

    draw();
  }

  global.RBQM_PAGE_MONITORING_PLAN = { render: render };
})(window);
