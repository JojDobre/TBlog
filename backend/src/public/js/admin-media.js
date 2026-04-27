/**
 * Bytezone admin — media library client-side helpers.
 */
(function () {
  'use strict';

  var input = document.querySelector('[data-multi-file-input]');
  if (!input) return;

  var form = input.closest('form');
  if (!form) return;

  var maxFiles = parseInt(form.getAttribute('data-max-files'), 10) || 20;
  var info = form.querySelector('[data-file-count-info]');

  function updateInfo() {
    if (!info) return;
    var count = input.files ? input.files.length : 0;
    if (count === 0) {
      info.textContent = 'Vyber viacero súborov naraz (Ctrl/Shift + klik).';
      info.className = 'form-text';
      return;
    }
    if (count > maxFiles) {
      info.textContent = 'Vybraných ' + count + ' — max je ' + maxFiles + '. Odošli max ' + maxFiles + '.';
      info.className = 'form-text text-danger';
    } else {
      info.textContent = 'Vybraných: ' + count;
      info.className = 'form-text text-success';
    }
  }

  input.addEventListener('change', updateInfo);

  form.addEventListener('submit', function (e) {
    if (input.files && input.files.length > maxFiles) {
      e.preventDefault();
      alert('Naraz môžeš nahrať maximálne ' + maxFiles + ' súborov. Vybraných: ' + input.files.length);
    }
  });
})();
