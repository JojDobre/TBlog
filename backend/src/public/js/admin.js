/**
 * Bytezone Admin — client JS
 *
 * Zatiaľ minimum: zatvorí offcanvas sidebar po kliknutí na link na mobile,
 * a flash auto-dismiss. Postupne sem pribudnú handlery pre konkrétne stránky.
 */

(function () {
  'use strict';

  // ------------------------------------------------------------------------
  // Sidebar: po kliknutí na link na mobile zatvor offcanvas
  // ------------------------------------------------------------------------
  const sidebar = document.getElementById('bzSidebar');
  if (sidebar && window.bootstrap && window.bootstrap.Offcanvas) {
    sidebar.querySelectorAll('a.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        // len ak je v offcanvas režime (mobile)
        if (window.matchMedia('(max-width: 991.98px)').matches) {
          const oc = window.bootstrap.Offcanvas.getInstance(sidebar);
          if (oc) oc.hide();
        }
      });
    });
  }

  // ------------------------------------------------------------------------
  // Auto-dismiss flash alerts po 5s
  // ------------------------------------------------------------------------
  document.querySelectorAll('.alert.bz-flash').forEach((alert) => {
    setTimeout(() => {
      if (window.bootstrap && window.bootstrap.Alert) {
        window.bootstrap.Alert.getOrCreateInstance(alert).close();
      }
    }, 5000);
  });
})();
