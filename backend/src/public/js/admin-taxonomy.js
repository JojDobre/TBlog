/**
 * Admin taxonomy — JS pre rubriky, kategórie, tagy
 *
 * Phase 4.1
 *
 * Funkcionalita:
 *   1. Confirm pri delete formulároch (forma má data-confirm="text")
 *   2. Color picker pre tag formulár — synchronizuje 3 prvky (color input,
 *      text input, preview pill) + paletové buttons + náhodný button
 *
 * CSP-friendly: žiadne inline handlery, len addEventListener.
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Delete confirms — formuláre s `data-confirm="..."`
  // -------------------------------------------------------------------------
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      var msg = form.getAttribute('data-confirm') || 'Naozaj?';
      if (!window.confirm(msg)) {
        e.preventDefault();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 2. Color picker pre tag formulár
  // -------------------------------------------------------------------------
  var form = document.querySelector('[data-tag-form]');
  if (!form) return;

  var colorInput = form.querySelector('[data-color-input]');     // <input type="color">
  var colorText = form.querySelector('[data-color-text]');        // <input type="text">
  var preview = form.querySelector('[data-color-preview]');       // span s --bz-tag-color
  var nameInput = form.querySelector('[data-color-name-source]'); // <input name="name">
  var clearBtn = form.querySelector('[data-color-clear]');
  var chips = form.querySelectorAll('[data-color-chip]');

  if (!colorInput || !colorText || !preview) return;

  var DEFAULT_COLOR = '#9ca3af'; // neutrálna sivá pre náhľad keď nie je farba

  function setPreview(color) {
    preview.style.setProperty('--bz-tag-color', color || DEFAULT_COLOR);
  }

  // Pri zmene <input type="color"> → text + preview
  colorInput.addEventListener('input', function () {
    colorText.value = colorInput.value;
    setPreview(colorInput.value);
  });

  // Pri písaní v texte → color input + preview (s validáciou hex)
  colorText.addEventListener('input', function () {
    var v = colorText.value.trim();
    var isHex = /^#[0-9a-fA-F]{6}$/.test(v);
    if (isHex) {
      colorInput.value = v.toLowerCase();
      setPreview(v);
    } else if (v === '') {
      colorInput.value = DEFAULT_COLOR;
      setPreview('');
    }
    // ak je v rozpracované (napr. "#3b8") — neresetuj, nech môže dopísať
  });

  // Paletové chip buttony
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var c = chip.getAttribute('data-color-chip');
      if (!c) return;
      colorText.value = c;
      colorInput.value = c;
      setPreview(c);
    });
  });

  // "Náhodná" button — vyprázdni text (server vyberie pri uložení)
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      colorText.value = '';
      colorInput.value = DEFAULT_COLOR;
      setPreview('');
    });
  }

  // Náhľad reaguje aj na zmenu mena
  if (nameInput) {
    nameInput.addEventListener('input', function () {
      preview.textContent = nameInput.value || 'náhľad';
    });
  }
})();
