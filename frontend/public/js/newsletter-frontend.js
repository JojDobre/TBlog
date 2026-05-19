/**
 * Newsletter subscribe — AJAX odoslanie formulárov
 *
 * Hľadá všetky .newsletter-form na stránke a pridáva submit handler.
 */
(function () {
  'use strict';

  var forms = document.querySelectorAll('.newsletter-form');
  if (!forms.length) return;

  forms.forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var btn = form.querySelector('button');
    var note = form.querySelector('.newsletter-note');
    if (!input || !btn) return;

    btn.addEventListener('click', function (e) {
      e.preventDefault();

      var email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.style.borderColor = 'oklch(0.65 0.2 25)';
        input.focus();
        return;
      }

      btn.disabled = true;
      var origHtml = btn.innerHTML;
      btn.textContent = 'Odosiela sa...';

      fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, source: 'website' }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.ok) {
            input.value = '';
            input.style.borderColor = '';
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> ' +
              (data.message || 'Prihlásený!');
            btn.style.background = 'oklch(0.45 0.15 155)';
            if (note) note.textContent = data.message || 'Ďakujeme za prihlásenie!';
          } else {
            btn.innerHTML = origHtml;
            btn.disabled = false;
            if (note) {
              note.textContent = data.error || 'Nastala chyba.';
              note.style.color = 'oklch(0.7 0.2 25)';
            }
          }
        })
        .catch(function () {
          btn.innerHTML = origHtml;
          btn.disabled = false;
          if (note) {
            note.textContent = 'Nastala chyba, skús to znova.';
            note.style.color = 'oklch(0.7 0.2 25)';
          }
        });
    });

    // Reset border on input
    input.addEventListener('input', function () {
      input.style.borderColor = '';
    });
  });
})();
