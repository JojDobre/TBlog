(function () {
  var KEY = 'bz_consent';
  if (localStorage.getItem(KEY)) return;

  var el = document.getElementById('cookie-consent');
  if (!el) return;
  el.style.display = '';

  el.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-consent]');
    if (!btn) return;
    var v = btn.getAttribute('data-consent');
    localStorage.setItem(KEY, v);
    document.cookie = KEY + '=' + v + ';path=/;max-age=31536000;SameSite=Lax';
    el.style.display = 'none';

    if (typeof gtag === 'function') {
      if (v === 'all') {
        gtag('consent', 'update', {
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
          analytics_storage: 'granted',
        });
      } else {
        gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
      }
    }
  });
})();
