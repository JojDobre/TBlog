/**
 * Article status toggle  (Phase 5.2)
 *
 * Pri zmene status select-u zobrazí/skryje datetime picker pre scheduled_at.
 */

(function () {
  'use strict';
  var sel = document.querySelector('[data-status-select]');
  var wrap = document.querySelector('[data-scheduled-at-wrap]');
  if (!sel || !wrap) return;

  function update() {
    wrap.style.display = sel.value === 'scheduled' ? '' : 'none';
  }

  sel.addEventListener('change', update);
  update();
})();
