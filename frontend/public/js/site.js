/**
 * Bytezone — verejný frontend JS.
 *
 * Toto je TVOJ priestor pre vlastný JS. Aktuálne tu je len logika
 * dropdown menu pre prihláseného usera v hlavičke (otvor/zavri,
 * Escape, klik mimo).
 *
 * Servuje sa z frontend/public/js/site.js → /js/site.js
 * Nahrávané v partials/head.ejs cez <script src="/js/site.js" defer>.
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // User dropdown v hlavičke
  // ------------------------------------------------------------------------
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
