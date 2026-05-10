(function () {
  var t = localStorage.getItem('theme');
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
})();

function updateThemeIcon() {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var iconDark = document.getElementById('theme-icon-dark');
  var iconLight = document.getElementById('theme-icon-light');
  if (iconDark) iconDark.style.display = isLight ? 'none' : '';
  if (iconLight) iconLight.style.display = isLight ? '' : 'none';
}

function toggleTheme() {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var next = isLight ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeIcon();
}

document.addEventListener('DOMContentLoaded', function () {
  updateThemeIcon();
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  var menuBtn = document.getElementById('user-menu-btn');
  var menu = document.getElementById('user-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = menu.classList.toggle('is-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function () {
      if (menu.classList.contains('is-open')) {
        menu.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) {
        menu.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        menuBtn.focus();
      }
    });
  }
});
