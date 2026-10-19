/* Subject drill-down (sub-page, reached from Site profile). Timeline of visits and
   protocol deviations, filterable by event type - used to verify a signal against records. */
(function (global) {
  'use strict';
  var FMT = global.RBQM_FORMAT;
  var ROUTER = global.RBQM_ROUTER;

  function render(contentEl, data) {
    var subjectId = ROUTER.get('subject');
    var subject = data.subjects.filter(function (s) { return s.id === subjectId; })[0] || data.subjects[0];
    var site = data.sites.filter(function (s) { return s.id === subject.siteId; })[0];
    var visits = data.visits.filter(function (v) { return v.subjectId === subject.id; }).sort(function (a, b) { return a.plannedDate < b.plannedDate ? -1 : 1; });
    var deviations = data.deviations.filter(function (d) { return d.subjectId === subject.id; });

    var filters = { type: 'all' };

    function draw() {
      var events = buildEvents(visits, deviations).filter(function (e) { return filters.type === 'all' || e.type === filters.type; });

      contentEl.innerHTML =
        '<div class="card"><div class="card-head"><div><h2 style="font-size:17px">' + subject.id + '</h2>' +
        '<p class="muted">Site ' + site.code + ', ' + site.country + ' &middot; arm ' + subject.arm + ' &middot; enrolled ' + FMT.dateShort(subject.enrollDate) + ' &middot; ' + subject.status + '</p></div>' +
        '<a class="btn btn-sm" href="site-profile.html?site=' + site.id + '">Back to site profile</a></div></div>' +
        '<div style="height:10px"></div><div class="card">' +
        '<div class="table-toolbar"><select class="select-input" id="typeFilter">' +
        '<option value="all">All events</option><option value="visit">Visits</option><option value="deviation">Protocol deviations</option></select></div>' +
        events.map(eventRow).join('') +
        '</div>';

      document.getElementById('typeFilter').addEventListener('change', function (e) { filters.type = e.target.value; draw(); });
    }

    function buildEvents(visits, deviations) {
      var ev = visits.map(function (v) {
        return { type: 'visit', date: v.plannedDate, label: v.name, detail: v.missed ? 'Missed' : ('Actual ' + FMT.dateShort(v.actualDate) + ', entered ' + (v.entryDate ? FMT.dateShort(v.entryDate) : '–')), status: v.missed ? 'action' : 'ok' };
      });
      ev = ev.concat(deviations.map(function (d) {
        return { type: 'deviation', date: d.date, label: d.category, detail: d.importance + ' · ' + d.status, status: d.importance === 'Critical' ? 'action' : d.importance === 'Major' ? 'watch' : 'ok' };
      }));
      return ev.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    }

    function eventRow(e) {
      return '<div class="card-head" style="padding:7px 0;border-bottom:1px solid var(--c-border)">' +
        '<div><span class="status-pill status-' + e.status + '">' + (e.type === 'visit' ? 'Visit' : 'Deviation') + '</span> <b style="margin-left:6px">' + e.label + '</b>' +
        '<div class="muted" style="font-size:10.5px">' + e.detail + '</div></div>' +
        '<span class="muted" style="font-size:10.5px">' + FMT.dateShort(e.date) + '</span></div>';
    }

    draw();
  }

  global.RBQM_PAGE_SUBJECT_DETAIL = { render: render };
})(window);
