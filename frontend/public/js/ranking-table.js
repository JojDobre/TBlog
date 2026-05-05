(function () {
  'use strict';

  var table = document.querySelector('[data-sortable]');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  var headers = table.querySelectorAll('[data-sort-col]');
  var currentCol = null;
  var currentDir = 'asc';

  // ---- SORT ----
  headers.forEach(function (th) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function () {
      var col = th.getAttribute('data-sort-col');
      if (currentCol === col) currentDir = currentDir === 'asc' ? 'desc' : 'asc';
      else {
        currentCol = col;
        currentDir = 'asc';
      }
      headers.forEach(function (h) {
        var icon = h.querySelector('.sort-icon');
        if (icon) icon.textContent = h === th ? (currentDir === 'asc' ? '↑' : '↓') : '↕';
      });
      var rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort(function (a, b) {
        var va = getCellValue(a, col),
          vb = getCellValue(b, col);
        var result =
          typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'sk');
        return currentDir === 'desc' ? -result : result;
      });
      rows.forEach(function (r) {
        tbody.appendChild(r);
      });
    });
  });

  function getCellValue(row, col) {
    if (col === 'rank') return parseInt(row.querySelector('.rtable-rank-num').textContent, 10);
    if (col === 'name') return row.querySelector('.rtable-name').textContent.trim();
    if (col === 'score') return parseFloat(row.querySelector('.rtable-total').textContent);
    if (col === 'price')
      return (
        parseInt(row.querySelector('.rtable-price-cell').textContent.replace(/[^0-9]/g, ''), 10) ||
        0
      );
    if (col === 'released') return row.querySelector('.rtable-date-cell').textContent.trim();
    var cells = row.querySelectorAll('.rtable-score-cell');
    var ths = table.querySelectorAll('.rtable-th--score');
    for (var i = 0; i < ths.length; i++) {
      if (ths[i].getAttribute('data-sort-col') === col)
        return parseFloat(cells[i].querySelector('.rtable-score-val').textContent);
    }
    return 0;
  }

  // ---- FILTER: combined ----
  var activeBrand = 'all';
  var priceMin = null,
    priceMax = null;
  var dateMin = '',
    dateMax = '';
  var scoreMin = null;

  function applyFilters() {
    var rows = tbody.querySelectorAll('tr');
    rows.forEach(function (r) {
      var show = true;

      // Brand
      if (activeBrand !== 'all' && r.getAttribute('data-brand') !== activeBrand) show = false;

      // Price
      if (show && (priceMin !== null || priceMax !== null)) {
        var price =
          parseInt(r.querySelector('.rtable-price-cell').textContent.replace(/[^0-9]/g, ''), 10) ||
          0;
        if (priceMin !== null && price < priceMin) show = false;
        if (priceMax !== null && price > priceMax) show = false;
      }

      // Date — porovnáme textovo (mesiac/rok)
      if (show && (dateMin || dateMax)) {
        var dateText = r.querySelector('.rtable-date-cell').textContent.trim();
        var dateVal = parseDateText(dateText);
        if (dateMin && dateVal < dateMin) show = false;
        if (dateMax && dateVal > dateMax) show = false;
      }

      // Score
      if (show && scoreMin !== null) {
        var sc = parseFloat(r.querySelector('.rtable-total').textContent);
        if (sc < scoreMin) show = false;
      }

      r.style.display = show ? '' : 'none';
    });
  }

  // "Márc 2026" → "2026-03"
  var MONTHS = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Már: '03',
    Márc: '03',
    Apr: '04',
    Máj: '05',
    Jún: '06',
    Júl: '07',
    Aug: '08',
    Sep: '09',
    Okt: '10',
    Nov: '11',
    Dec: '12',
  };
  function parseDateText(text) {
    if (!text || text === '—') return '0000-00';
    var parts = text.trim().split(/\s+/);
    if (parts.length < 2) return '0000-00';
    var month = MONTHS[parts[0]] || '01';
    return parts[1] + '-' + month;
  }

  // Brand filter
  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (b) {
        b.classList.remove('btn-primary');
      });
      btn.classList.add('btn-primary');
      activeBrand = btn.getAttribute('data-filter');
      applyFilters();
    });
  });

  // Price filter
  var priceApply = document.querySelector('[data-price-apply]');
  var priceReset = document.querySelector('[data-price-reset]');
  if (priceApply)
    priceApply.addEventListener('click', function () {
      var minEl = document.querySelector('[data-price-min]');
      var maxEl = document.querySelector('[data-price-max]');
      priceMin = minEl.value ? Number(minEl.value) : null;
      priceMax = maxEl.value ? Number(maxEl.value) : null;
      applyFilters();
    });
  if (priceReset)
    priceReset.addEventListener('click', function () {
      priceMin = null;
      priceMax = null;
      document.querySelector('[data-price-min]').value = '';
      document.querySelector('[data-price-max]').value = '';
      applyFilters();
    });

  // Date filter
  var dateApply = document.querySelector('[data-date-apply]');
  var dateReset = document.querySelector('[data-date-reset]');
  if (dateApply)
    dateApply.addEventListener('click', function () {
      dateMin = document.querySelector('[data-date-min]').value || '';
      dateMax = document.querySelector('[data-date-max]').value || '';
      applyFilters();
    });
  if (dateReset)
    dateReset.addEventListener('click', function () {
      dateMin = '';
      dateMax = '';
      document.querySelector('[data-date-min]').value = '';
      document.querySelector('[data-date-max]').value = '';
      applyFilters();
    });

  // Score filter
  var scoreApply = document.querySelector('[data-score-apply]');
  var scoreReset = document.querySelector('[data-score-reset]');
  if (scoreApply)
    scoreApply.addEventListener('click', function () {
      var el = document.querySelector('[data-score-min]');
      scoreMin = el.value ? Number(el.value) : null;
      applyFilters();
    });
  if (scoreReset)
    scoreReset.addEventListener('click', function () {
      scoreMin = null;
      document.querySelector('[data-score-min]').value = '';
      applyFilters();
    });
})();
