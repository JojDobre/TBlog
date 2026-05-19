(function(){
  var KEY = 'bz_consent';
  if (localStorage.getItem(KEY)) return;
  var el = document.getElementById('cookie-consent');
  if (el) el.style.display = '';
  window.cookieConsent = function(v) {
    localStorage.setItem(KEY, v);
    document.cookie = KEY + '=' + v + ';path=/;max-age=31536000;SameSite=Lax';
    if (el) el.style.display = 'none';
  };
})();
