/* Generic sortable/searchable table. columns: [{key,label,sortable,render(row)}].
   State (sort, search) is kept in the DOM dataset so repeated renders stay simple. */
(function (global) {
  'use strict';

  function render(columns, rows, opts) {
    opts = opts || {};
    var thead = columns.map(function (c) {
      return '<th class="' + (c.sortable === false ? 'no-sort' : '') + '" data-key="' + c.key + '">' + c.label + '<span class="arrow"></span></th>';
    }).join('');
    var tbody = rows.map(function (row, idx) {
      var cells = columns.map(function (c) {
        var val = c.render ? c.render(row) : (row[c.key] != null ? row[c.key] : '–');
        return '<td>' + val + '</td>';
      }).join('');
      return '<tr class="' + (opts.onRowClick ? 'clickable' : '') + '" data-row-index="' + idx + '">' + cells + '</tr>';
    }).join('');
    var empty = rows.length === 0
      ? '<div class="empty-state"><h3>' + (opts.emptyTitle || 'Nothing matches these filters') + '</h3><p>' + (opts.emptyBody || 'Try a wider date range or another country.') + '</p></div>'
      : '';
    return '<table class="table"><thead><tr>' + thead + '</tr></thead><tbody>' + tbody + '</tbody></table>' + empty;
  }

  /** Binds sort-on-click to table headers; expects fresh render on each sort (caller re-renders). */
  function bindSort(containerEl, rows, columns, onSort) {
    var state = { key: null, dir: 1 };
    containerEl.querySelectorAll('th[data-key]').forEach(function (th) {
      th.addEventListener('click', function () {
        var key = th.dataset.key;
        if (state.key === key) state.dir *= -1; else { state.key = key; state.dir = 1; }
        var col = columns.filter(function (c) { return c.key === key; })[0];
        var sorted = rows.slice().sort(function (a, b) {
          var av = col && col.sortValue ? col.sortValue(a) : a[key];
          var bv = col && col.sortValue ? col.sortValue(b) : b[key];
          if (av == null) av = '';
          if (bv == null) bv = '';
          if (av < bv) return -1 * state.dir;
          if (av > bv) return 1 * state.dir;
          return 0;
        });
        onSort(sorted, key, state.dir);
      });
    });
  }

  function bindRowClick(containerEl, rows, onRowClick) {
    containerEl.querySelectorAll('tr[data-row-index]').forEach(function (tr) {
      tr.addEventListener('click', function () { onRowClick(rows[Number(tr.dataset.rowIndex)]); });
    });
  }

  function toCsv(columns, rows) {
    var header = columns.map(function (c) { return '"' + c.label.replace(/"/g, '""') + '"'; }).join(',');
    var lines = rows.map(function (row) {
      return columns.map(function (c) {
        var val = c.csvValue ? c.csvValue(row) : (c.render ? stripTags(c.render(row)) : row[c.key]);
        return '"' + String(val != null ? val : '').replace(/"/g, '""') + '"';
      }).join(',');
    });
    return [header].concat(lines).join('\n');
  }

  function stripTags(html) { return String(html).replace(/<[^>]*>/g, ''); }

  function downloadCsv(filename, columns, rows) {
    var csv = toCsv(columns, rows);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = url; a.download = filename;
    global.document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  global.RBQM_TABLE = { render: render, bindSort: bindSort, bindRowClick: bindRowClick, toCsv: toCsv, downloadCsv: downloadCsv };
})(window);
