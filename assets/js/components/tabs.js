/* Tabs: simple tab strip bound to [data-tab] buttons + [data-tab-panel] panels. */
(function (global) {
  'use strict';

  function init(containerEl, onChange) {
    var tabs = containerEl.querySelectorAll('.tab');
    var panels = containerEl.parentElement.querySelectorAll('[data-tab-panel]');
    function activate(name) {
      tabs.forEach(function (t) { t.classList.toggle('active', t.dataset.tab === name); });
      panels.forEach(function (p) { p.hidden = p.dataset.tabPanel !== name; });
      if (onChange) onChange(name);
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { activate(t.dataset.tab); });
    });
    var initial = containerEl.querySelector('.tab.active');
    if (initial) activate(initial.dataset.tab);
    return { activate: activate };
  }

  global.RBQM_TABS = { init: init };
})(window);
