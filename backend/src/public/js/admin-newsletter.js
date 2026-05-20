(function () {
  'use strict';

  var btn = document.getElementById('btn-copy-emails');
  if (!btn) return;

  var origHtml = btn.innerHTML;

  btn.addEventListener('click', function () {
    btn.disabled = true;
    btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Načítavam...';

    fetch('/admin/newsletter/emails', { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!data.emails || data.emails.length === 0) {
          btn.innerHTML = '<i class="bi bi-x"></i> Žiadne emaily';
          setTimeout(function () {
            btn.innerHTML = origHtml;
            btn.disabled = false;
          }, 2000);
          return;
        }

        var text = data.emails.join('; ');
        navigator.clipboard
          .writeText(text)
          .then(function () {
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Skopírované! (' + data.count + ')';
            setTimeout(function () {
              btn.innerHTML = origHtml;
              btn.disabled = false;
            }, 3000);
          })
          .catch(function () {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Skopírované! (' + data.count + ')';
            setTimeout(function () {
              btn.innerHTML = origHtml;
              btn.disabled = false;
            }, 3000);
          });
      })
      .catch(function () {
        btn.innerHTML = '<i class="bi bi-x"></i> Chyba';
        setTimeout(function () {
          btn.innerHTML = origHtml;
          btn.disabled = false;
        }, 2000);
      });
  });
})();
