/* Glossary and help: Getting started, FAQ, and the searchable glossary built from window.GLOSSARY
   (prep-docs/06-glossary.json). Search matches term, alias and definition; category chips and the
   A to Z bar narrow the list; each entry has page links, related terms and a "Copy link" (URL hash). */
(function (global) {
  'use strict';
  var ROUTER = global.RBQM_ROUTER;
  var A11Y = global.RBQM_A11Y;

  var PAGE_LINKS = { 'KRI detail': 'kri-detail.html', 'Site profile': 'site-profile.html', 'Study detail': 'study-detail.html', 'Subject drill-down': 'subject-detail.html' };

  var STEPS = [
    'Start on the Dashboard. The health score and the Signals list tell you where to look first.',
    'Open Sites and pick a site with a high risk score. The site profile shows which indicators drive it.',
    'Open a risk indicator to see the funnel plot, the trend and the forecast.',
    'Review the signal, assign an owner, and create a CAPA if the problem needs a documented fix.',
    'Use Reports and audit to save the evidence for an inspection.'
  ];
  var FAQ = [
    ['Is this real data?', 'No. All data is synthetic and the AI assistant is simulated. Nothing leaves your browser.'],
    ['How do I undo my changes?', 'Use Reset demo data (the circular arrow in the header). It returns every page to the seed data.'],
    ['What does Beginner hints do?', 'It underlines terms with a dotted line and shows a short definition on hover. Turn it off in the header any time.'],
    ['Where do the numbers come from?', 'Use Show calculation next to a value to see its formula, inputs, thresholds and data sources.'],
    ['Can I use this for a real study?', 'No. This is a prototype, not validated for regulated use.']
  ];

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function slug(t) { return global.RBQM_GLOSSARY_TIP ? global.RBQM_GLOSSARY_TIP.slug(t) : String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

  function pageHref(label) {
    if (PAGE_LINKS[label]) return PAGE_LINKS[label];
    var nav = (global.RBQM_NAV || []).reduce(function (a, g) { return a.concat(g.items || [g]); }, []);
    var item = nav.filter(function (n) { return n.label.toLowerCase() === label.toLowerCase(); })[0];
    return item ? item.href : null;
  }

  function findEntry(name) {
    var n = name.toLowerCase();
    return global.GLOSSARY.filter(function (e) {
      return e.term.toLowerCase() === n || e.term.replace(/\s*\(.*\)\s*$/, '').toLowerCase() === n || (e.aliases || []).some(function (a) { return a.toLowerCase() === n; });
    })[0];
  }

  function matches(e, q) {
    if (!q) return true;
    return e.term.toLowerCase().indexOf(q) !== -1 || e.definition.toLowerCase().indexOf(q) !== -1 ||
      (e.aliases || []).some(function (a) { return a.toLowerCase().indexOf(q) !== -1; });
  }

  function entryHtml(e) {
    var where = e.where.split(',').map(function (w) {
      w = w.trim(); var href = pageHref(w);
      return href ? '<a href="' + href + '">' + esc(w) + '</a>' : esc(w);
    }).join('');
    var related = (e.related || []).map(function (r) {
      var t = findEntry(r);
      return t ? '<a href="#term=' + slug(t.term) + '" data-rel="' + slug(t.term) + '">' + esc(r) + '</a>' : '<span>' + esc(r) + '</span>';
    }).join(', ');
    return '<div class="gl-entry" id="gl-' + slug(e.term) + '" data-slug="' + slug(e.term) + '">' +
      '<h3>' + esc(e.term) + ' <span class="gl-meta">' + esc(e.category) + '</span>' +
      '<button class="btn btn-ghost btn-sm" data-copy="' + slug(e.term) + '" aria-label="Copy link to ' + esc(e.term) + '">Copy link</button></h3>' +
      '<p>' + esc(e.definition) + '</p>' +
      '<p class="muted"><b>Why it matters.</b> ' + esc(e.why) + '</p>' +
      '<p class="gl-links muted"><b>Where you see it.</b> ' + where + '</p>' +
      (related ? '<p class="gl-links muted"><b>Related.</b> ' + related + '</p>' : '') + '</div>';
  }

  function intro() {
    return '<div class="grid grid-2" style="margin-bottom:10px">' +
      '<details class="card" open><summary class="card-title" style="cursor:pointer">Getting started</summary><ol style="font-size:11.5px;margin:6px 0 0 16px;padding:0">' +
      STEPS.map(function (s) { return '<li style="margin-bottom:3px">' + esc(s) + '</li>'; }).join('') + '</ol></details>' +
      '<details class="card"><summary class="card-title" style="cursor:pointer">FAQ</summary>' +
      FAQ.map(function (f) { return '<p style="font-size:11.5px;margin:6px 0 0"><b>' + esc(f[0]) + '</b><br>' + esc(f[1]) + '</p>'; }).join('') + '</details></div>';
  }

  function render(contentEl) {
    var all = global.GLOSSARY.slice().sort(function (a, b) { return a.term.toLowerCase() < b.term.toLowerCase() ? -1 : 1; });
    var cats = Array.from(new Set(global.GLOSSARY.map(function (e) { return e.category; })));
    var state = { q: ROUTER.get('q', ''), cat: ROUTER.get('cat', 'all') };

    function focusHash() {
      var m = /term=([a-z0-9-]+)/.exec(global.location.hash || '');
      if (!m) return;
      var el = document.getElementById('gl-' + m[1]);
      if (!el) return;
      el.scrollIntoView({ block: 'start' });
      el.classList.add('flash');
      setTimeout(function () { el.classList.remove('flash'); }, 2200);
    }

    function draw() {
      var focus = A11Y.captureFocus('glossarySearch');
      var q = state.q.toLowerCase();
      var list = all.filter(function (e) { return (state.cat === 'all' || e.category === state.cat) && matches(e, q); });
      var letters = {};
      list.forEach(function (e) { letters[e.term.charAt(0).toUpperCase()] = true; });
      var bar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (l) {
        return letters[l] ? '<a href="#" data-letter="' + l + '">' + l + '</a>' : '<span>' + l + '</span>';
      }).join('');
      var last = '';
      var body = list.map(function (e) {
        var l = e.term.charAt(0).toUpperCase(), head = '';
        if (l !== last) { head = '<div class="gl-letter" id="gl-letter-' + l + '">' + l + '</div>'; last = l; }
        return head + entryHtml(e);
      }).join('');
      contentEl.innerHTML = intro() +
        '<div class="card"><div class="gl-toolbar"><input class="search-input" id="glossarySearch" placeholder="Search terms, aliases and definitions" style="width:100%;max-width:340px" value="' + esc(state.q) + '">' +
        '<span class="muted" style="font-size:10.5px">' + list.length + ' of ' + all.length + ' terms</span></div>' +
        '<div class="ai-chip-row" style="margin:0 0 8px"><button class="ai-chip' + (state.cat === 'all' ? ' active' : '') + '" data-cat="all">All</button>' +
        cats.map(function (c) { return '<button class="ai-chip' + (state.cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
        '<div class="gl-az" aria-label="Jump to letter">' + bar + '</div>' +
        '<div data-no-tip>' + (list.length ? body : '<div class="empty-state"><h3>Nothing matches these filters</h3><p>Try a different term or category.</p></div>') + '</div></div>';
      bind();
      A11Y.restoreFocus(focus);
    }

    function bind() {
      document.getElementById('glossarySearch').addEventListener('input', function (e) {
        state.q = e.target.value; ROUTER.set({ q: state.q || undefined }); draw();
      });
      Array.prototype.forEach.call(contentEl.querySelectorAll('[data-cat]:not([data-copy])'), function (b) {
        b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); ROUTER.set({ cat: state.cat === 'all' ? undefined : state.cat }); draw(); });
      });
      Array.prototype.forEach.call(contentEl.querySelectorAll('[data-letter]'), function (a) {
        a.addEventListener('click', function (e) { e.preventDefault(); var t = document.getElementById('gl-letter-' + a.getAttribute('data-letter')); if (t) t.scrollIntoView({ block: 'start' }); });
      });
      Array.prototype.forEach.call(contentEl.querySelectorAll('[data-rel]'), function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var s = a.getAttribute('data-rel');
          if (!document.getElementById('gl-' + s) || state.q || state.cat !== 'all') { state.q = ''; state.cat = 'all'; ROUTER.set({ q: undefined, cat: undefined }); }
          global.location.hash = 'term=' + s;
          draw(); focusHash();
        });
      });
      Array.prototype.forEach.call(contentEl.querySelectorAll('[data-copy]'), function (b) {
        b.addEventListener('click', function () {
          var url = global.location.href.split('#')[0] + '#term=' + b.getAttribute('data-copy');
          var done = function () { global.RBQM_TOAST.show('Link copied'); };
          if (global.navigator.clipboard && global.navigator.clipboard.writeText) global.navigator.clipboard.writeText(url).then(done, done);
          else done();
        });
      });
    }

    draw();
    focusHash();
    global.addEventListener('hashchange', focusHash);
  }

  global.RBQM_PAGE_GLOSSARY_HELP = { render: render };
})(window);
