/**
 * Bytezone — verejný frontend JS.
 */
(function () {
  'use strict';

  var btn = document.querySelector('[data-user-toggle]');
  var menu = document.querySelector('[data-user-menu]');

  if (btn && menu) {
    function close() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
    function open() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menu.hidden) open();
      else close();
    });
    document.addEventListener('click', function (e) {
      if (!menu.hidden && !menu.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }
})();
