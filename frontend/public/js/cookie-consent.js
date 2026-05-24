(function () {
  var KEY = 'bz_consent';
  if (localStorage.getItem(KEY)) return;
  var el = document.getElementById('cookie-consent');
  if (el) el.style.display = '';

  el.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-consent]');
    if (!btn) return;
    var v = btn.getAttribute('data-consent');
    localStorage.setItem(KEY, v);
    document.cookie = KEY + '=' + v + ';path=/;max-age=31536000;SameSite=Lax';
    el.style.display = 'none';
  });
})();
