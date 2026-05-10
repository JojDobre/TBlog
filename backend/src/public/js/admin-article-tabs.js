/**
 * Article edit page — tab switcher + revision restore
 * Extracted to external file (CSP blocks inline scripts).
 */
(function () {
  'use strict';

  function showTab(target) {
    document.querySelectorAll('[data-bz-tab]').forEach(function (b) {
      b.classList.toggle('active', b.dataset.bzTab === target);
    });
    document.querySelectorAll('[data-bz-pane]').forEach(function (p) {
      p.classList.toggle('bz-art-pane-active', p.dataset.bzPane === target);
    });
  }

  // Init: show first tab
  var firstTab = document.querySelector('[data-bz-tab]');
  if (firstTab) showTab(firstTab.dataset.bzTab);

  // Tab click handlers
  document.querySelectorAll('[data-bz-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showTab(btn.dataset.bzTab);
    });
  });

  // Revision restore (dynamic form to avoid nested <form> inside article-form)
  document.querySelectorAll('[data-restore-url]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!confirm('Obnoviť túto revíziu? Aktuálny stav sa uloží ako nová revízia.')) return;
      var f = document.createElement('form');
      f.method = 'POST';
      f.action = btn.dataset.restoreUrl;
      f.style.display = 'none';
      var csrf = document.createElement('input');
      csrf.type = 'hidden';
      csrf.name = '_csrf';
      csrf.value = btn.dataset.restoreCsrf;
      f.appendChild(csrf);
      document.body.appendChild(f);
      f.submit();
    });
  });
})();
