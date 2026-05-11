(function () {
  'use strict';

  var table = document.querySelector('[data-sortable]');
  if (!table) return;
  var tbody = table.querySelector('tbody');
  var headers = table.querySelectorAll('[data-sort-col]');
  var currentCol = null;
  var currentDir = 'asc';

  // ===========================================================================
  // SORT
  // ===========================================================================

  headers.forEach(function (th) {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function () {
      var col = th.getAttribute('data-sort-col');
      if (currentCol === col) currentDir = currentDir === 'asc' ? 'desc' : 'asc';
      else { currentCol = col; currentDir = 'asc'; }

      headers.forEach(function (h) {
        var icon = h.querySelector('.sort-icon');
        if (icon) icon.textContent = h === th ? (currentDir === 'asc' ? '↑' : '↓') : '↕';
      });

      var rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort(function (a, b) {
        var va = getCellValue(a, col), vb = getCellValue(b, col);
        var result = (typeof va === 'number' && typeof vb === 'number')
          ? va - vb
          : String(va).localeCompare(String(vb), 'sk');
        return currentDir === 'desc' ? -result : result;
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    });
  });

  function getCellValue(row, col) {
    if (col === 'rank') return parseInt(row.querySelector('.rtable-rank-num').textContent, 10);
    if (col === 'name') {
      var nameEl = row.querySelector('.rtable-name');
      return nameEl ? nameEl.textContent.trim() : '';
    }
    if (col === 'score') return parseFloat(row.querySelector('.rtable-total').textContent) || 0;
    if (col === 'price') return parseFloat(row.getAttribute('data-price-raw')) || 0;
    if (col === 'date') return row.getAttribute('data-date') || '';

    // Score columns by label
    var cells = row.querySelectorAll('.rtable-score-cell');
    var ths = table.querySelectorAll('.rtable-th--score');
    for (var i = 0; i < ths.length; i++) {
      if (ths[i].getAttribute('data-sort-col') === col) {
        return parseFloat(cells[i].querySelector('.rtable-score-val').textContent) || 0;
      }
    }
    return 0;
  }

  // ===========================================================================
  // FILTER STATE
  // ===========================================================================

  var activeBrand = 'all';
  var priceMin = null, priceMax = null;
  var dateMinVal = '', dateMaxVal = ''; // format: "YYYY-MM"
  var scoreMin = null;
  var critMins = {}; // { index: minValue }

  // ===========================================================================
  // APPLY FILTERS
  // ===========================================================================

  function applyFilters() {
    var rows = tbody.querySelectorAll('tr');
    var visibleCount = 0;

    rows.forEach(function (r) {
      var show = true;

      // Brand
      if (activeBrand !== 'all' && r.getAttribute('data-brand') !== activeBrand) show = false;

      // Price
      if (show && (priceMin !== null || priceMax !== null)) {
        var price = parseFloat(r.getAttribute('data-price-raw')) || 0;
        if (priceMin !== null && price < priceMin) show = false;
        if (priceMax !== null && price > priceMax) show = false;
      }

      // Date
      if (show && (dateMinVal || dateMaxVal)) {
        var dateStr = r.getAttribute('data-date') || '';
        var dateNorm = normalizeDateToYM(dateStr);
        if (dateMinVal && dateNorm && dateNorm < dateMinVal) show = false;
        if (dateMaxVal && dateNorm && dateNorm > dateMaxVal) show = false;
        if (!dateNorm && (dateMinVal || dateMaxVal)) show = false; // no date = hide when filtering
      }

      // Total score
      if (show && scoreMin !== null) {
        var sc = parseFloat(r.querySelector('.rtable-total').textContent) || 0;
        if (sc < scoreMin) show = false;
      }

      // Per-criterion min score
      if (show) {
        var critKeys = Object.keys(critMins);
        for (var k = 0; k < critKeys.length; k++) {
          var idx = critKeys[k];
          var minVal = critMins[idx];
          if (minVal === null) continue;
          var cell = r.querySelector('.rtable-score-cell[data-crit-index="' + idx + '"]');
          if (cell) {
            var val = parseFloat(cell.querySelector('.rtable-score-val').textContent) || 0;
            if (val < minVal) { show = false; break; }
          }
        }
      }

      r.style.display = show ? '' : 'none';
      if (show) visibleCount++;
    });

    // Show "no results" message
    var noResults = document.getElementById('rtable-no-results');
    if (visibleCount === 0) {
      if (!noResults) {
        noResults = document.createElement('div');
        noResults.id = 'rtable-no-results';
        noResults.style.cssText = 'text-align:center; padding:32px; color:var(--text-muted); font-size:14px;';
        noResults.textContent = 'Žiadne produkty nezodpovedajú filtrom.';
        table.parentNode.insertBefore(noResults, table.nextSibling);
      }
      noResults.style.display = '';
    } else if (noResults) {
      noResults.style.display = 'none';
    }
  }

  /**
   * Normalizuj dátumový text na "YYYY-MM" pre porovnanie.
   * Podporuje: "Jan 2026", "2026-01", "01/2026", "január 2026"
   */
  function normalizeDateToYM(str) {
    if (!str || str === '—') return '';
    // YYYY-MM
    var m1 = str.match(/^(\d{4})-(\d{2})/);
    if (m1) return m1[1] + '-' + m1[2];
    // MM/YYYY
    var m2 = str.match(/^(\d{2})\/(\d{4})/);
    if (m2) return m2[2] + '-' + m2[1];
    // Mesiac Rok (skrátený alebo plný)
    var monthMap = {
      'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'máj': '05', 'maj': '05',
      'jún': '06', 'jun': '06', 'júl': '07', 'jul': '07', 'aug': '08', 'sep': '09',
      'okt': '10', 'nov': '11', 'dec': '12',
      'január': '01', 'február': '02', 'marec': '03', 'apríl': '04',
      'júni': '06', 'júli': '07', 'august': '08', 'september': '09',
      'október': '10', 'november': '11', 'december': '12'
    };
    var m3 = str.match(/([a-záéíóúýčďľňřšťž]+)\s+(\d{4})/i);
    if (m3) {
      var key = m3[1].toLowerCase();
      // Skús exact match, potom prefix
      var mm = monthMap[key];
      if (!mm) {
        for (var mk in monthMap) {
          if (mk.indexOf(key.slice(0, 3)) === 0) { mm = monthMap[mk]; break; }
        }
      }
      if (mm) return m3[2] + '-' + mm;
    }
    return '';
  }

  // ===========================================================================
  // EVENT LISTENERS
  // ===========================================================================

  // Brand filter buttons
  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeBrand = btn.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach(function (b) {
        b.classList.toggle('btn-primary', b.getAttribute('data-filter') === activeBrand);
      });
      applyFilters();
    });
  });

  // Price
  var priceApply = document.querySelector('[data-price-apply]');
  var priceReset = document.querySelector('[data-price-reset]');
  if (priceApply) {
    priceApply.addEventListener('click', function () {
      var minEl = document.querySelector('[data-price-min]');
      var maxEl = document.querySelector('[data-price-max]');
      priceMin = minEl.value ? parseFloat(minEl.value) : null;
      priceMax = maxEl.value ? parseFloat(maxEl.value) : null;
      applyFilters();
    });
  }
  if (priceReset) {
    priceReset.addEventListener('click', function () {
      priceMin = null; priceMax = null;
      document.querySelector('[data-price-min]').value = '';
      document.querySelector('[data-price-max]').value = '';
      applyFilters();
    });
  }

  // Date (separate month + year)
  var dateApply = document.querySelector('[data-date-apply]');
  var dateReset = document.querySelector('[data-date-reset]');
  if (dateApply) {
    dateApply.addEventListener('click', function () {
      var monthMin = document.querySelector('[data-date-month-min]').value;
      var yearMin = document.querySelector('[data-date-year-min]').value;
      var monthMax = document.querySelector('[data-date-month-max]').value;
      var yearMax = document.querySelector('[data-date-year-max]').value;

      // Ak je len rok bez mesiaca, default na Jan (min) alebo Dec (max)
      if (yearMin && !monthMin) monthMin = '01';
      if (yearMax && !monthMax) monthMax = '12';

      dateMinVal = (yearMin && monthMin) ? yearMin + '-' + monthMin : '';
      dateMaxVal = (yearMax && monthMax) ? yearMax + '-' + monthMax : '';
      applyFilters();
    });
  }
  if (dateReset) {
    dateReset.addEventListener('click', function () {
      dateMinVal = ''; dateMaxVal = '';
      document.querySelector('[data-date-month-min]').value = '';
      document.querySelector('[data-date-year-min]').value = '';
      document.querySelector('[data-date-month-max]').value = '';
      document.querySelector('[data-date-year-max]').value = '';
      applyFilters();
    });
  }

  // Total score
  var scoreApply = document.querySelector('[data-score-apply]');
  var scoreReset = document.querySelector('[data-score-reset]');
  if (scoreApply) {
    scoreApply.addEventListener('click', function () {
      var el = document.querySelector('[data-score-min]');
      scoreMin = el.value ? parseFloat(el.value) : null;
      applyFilters();
    });
  }
  if (scoreReset) {
    scoreReset.addEventListener('click', function () {
      scoreMin = null;
      document.querySelector('[data-score-min]').value = '';
      applyFilters();
    });
  }

  // Per-criterion min scores
  var critApply = document.querySelector('[data-crit-apply]');
  var critReset = document.querySelector('[data-crit-reset]');
  if (critApply) {
    critApply.addEventListener('click', function () {
      critMins = {};
      document.querySelectorAll('.rtable-crit-min').forEach(function (input) {
        var idx = input.getAttribute('data-crit-index');
        critMins[idx] = input.value ? parseFloat(input.value) : null;
      });
      applyFilters();
    });
  }
  if (critReset) {
    critReset.addEventListener('click', function () {
      critMins = {};
      document.querySelectorAll('.rtable-crit-min').forEach(function (input) { input.value = ''; });
      applyFilters();
    });
  }
})();
