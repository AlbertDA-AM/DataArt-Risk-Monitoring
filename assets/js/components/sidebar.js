/* Sidebar: grouped navigation from one config (RBQM_NAV), active item highlighted, badges. */
(function (global) {
  'use strict';
  var NAV = global.RBQM_NAV;
  var CFG = global.RBQM_CONFIG;

  function badgeValue(key, data) {
    if (!data || !data.summary) return null;
    if (key === 'openSignals') return data.summary.openSignals;
    if (key === 'overdueCapas') return data.summary.overdueCapas;
    return null;
  }

  function render(activeId, data) {
    var html = '';
    html += '<div class="sidebar-brand"><img src="../assets/img/dataart-logo-large-white.svg" alt="DataArt"></div>';
    html += '<div class="sidebar-subtitle">RBQM Risk Monitoring</div>';
    html += '<nav class="sidebar-nav" aria-label="Main navigation">';
    NAV.forEach(function (group) {
      html += '<div class="sidebar-group"><div class="sidebar-group-label">' + group.group + '</div>';
      group.items.forEach(function (item) {
        var active = item.id === activeId;
        var badge = badgeValue(item.badgeKey, data);
        html += '<a class="sidebar-item' + (active ? ' active' : '') + '" href="' + item.href + '" ' + (active ? 'aria-current="page"' : '') + '>' +
          '<span class="dot" aria-hidden="true"></span><span>' + item.label + '</span>' +
          (badge ? '<span class="sidebar-badge">' + badge + '</span>' : '') + '</a>';
      });
      html += '</div>';
    });
    html += '</nav>';
    html += '<div class="sidebar-footer"><button class="sidebar-ask-ai" id="sidebarAskAi" type="button">' +
      '<span class="title sparkle">Ask AI</span><span class="sub">Questions about your data</span></button></div>';
    return html;
  }

  global.RBQM_SIDEBAR = { render: render };
})(window);
