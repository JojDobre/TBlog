/**
 * Admin banner editor  — real-time type switching + template fields
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Type switching (image / template / custom)
  // -------------------------------------------------------------------------
  var radios = document.querySelectorAll('[data-type-radio]');
  var panels = document.querySelectorAll('[data-type-panel]');
  var labels = document.querySelectorAll('.bz-type-option');

  function switchType(val) {
    panels.forEach(function (p) {
      if (p.getAttribute('data-type-panel') === val) {
        p.removeAttribute('hidden');
        p.style.display = '';
      } else {
        p.setAttribute('hidden', '');
        p.style.display = 'none';
      }
    });
    labels.forEach(function (l) {
      var inp = l.querySelector('input');
      if (inp && inp.value === val) {
        l.style.background = 'oklch(0.3 0.04 200)';
        l.style.borderColor = 'var(--art-accent)';
      } else {
        l.style.background = '';
        l.style.borderColor = 'var(--art-border)';
      }
    });
  }

  // Klik na label aj na radio
  labels.forEach(function (label) {
    label.addEventListener('click', function () {
      var inp = label.querySelector('input');
      if (inp) {
        inp.checked = true;
        switchType(inp.value);
      }
    });
  });

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      switchType(r.value);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Template select — show/hide field groups
  // -------------------------------------------------------------------------
  var tplSelect = document.querySelector('[data-template-select]');
  var fieldGroups = document.querySelectorAll('[data-template-fields]');

  function switchTemplate(key) {
    fieldGroups.forEach(function (g) {
      var active = g.getAttribute('data-template-fields') === key;
      if (active) {
        g.removeAttribute('hidden');
        g.style.display = '';
      } else {
        g.setAttribute('hidden', '');
        g.style.display = 'none';
      }
      // Disable/enable inputs — rovnaké name (td_title) vo viacerých šablónach
      g.querySelectorAll('input, textarea, select').forEach(function (inp) {
        inp.disabled = !active;
      });
    });
  }

  if (tplSelect) {
    tplSelect.addEventListener('change', function () {
      switchTemplate(tplSelect.value);
    });
  }

  // -------------------------------------------------------------------------
  // 3. Init — nastav správny stav pri načítaní stránky
  // -------------------------------------------------------------------------
  var checked = document.querySelector('[data-type-radio]:checked');
  if (checked) {
    switchType(checked.value);
  }
  if (tplSelect && tplSelect.value) {
    switchTemplate(tplSelect.value);
  }
})();
