(function () {
  'use strict';

  // Confirm dialógy na formulároch s data-confirm
  document.querySelectorAll('[data-confirm]').forEach(function (el) {
    el.addEventListener('submit', function (e) {
      if (!window.confirm(el.getAttribute('data-confirm'))) {
        e.preventDefault();
      }
    });
  });

  // Alert close — globálny delegovaný handler
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.bz-art-alert-close, .bz-dash-alert-close');
    if (!btn) return;
    var alert = btn.closest('.bz-art-alert, .bz-dash-alert');
    if (alert) alert.remove();
  });

  // Auto-dismiss flash alerts po 8s
  document.querySelectorAll('.bz-art-alert-success').forEach(function (alert) {
    setTimeout(function () {
      alert.remove();
    }, 8000);
  });
})();
