/**
 * Article autosave
 *
 * Každých 30s skontroluje či sa niečo zmenilo a ak áno,
 * odošle AJAX POST na /admin/articles/:id/autosave.
 *
 * Defaultne zapnuté pre drafty, vypnuté pre published.
 * Klik na status text prepína on/off.
 */
(function () {
  'use strict';

  var form = document.querySelector('[data-article-form]');
  if (!form) return;

  var articleId = form.getAttribute('data-article-id');
  if (!articleId) return;

  var statusDot = document.querySelector('.bz-art-save-dot');
  var statusText = statusDot ? statusDot.nextElementSibling : null;
  var statusWrap = document.querySelector('.bz-art-save-status');
  var contentInput = form.querySelector('[data-content-json]');
  var csrfInput = form.querySelector('input[name="_csrf"]');
  var statusSelect = form.querySelector('[name="status"]');

  var INTERVAL = 30000;
  var lastHash = computeHash();
  var saving = false;

  // Default: zapnuté pre draft, vypnuté pre published
  var articleStatus = statusSelect ? statusSelect.value : 'draft';
  var enabled = articleStatus === 'draft' || articleStatus === 'review';

  // Toggle klik
  if (statusWrap) {
    statusWrap.style.cursor = 'pointer';
    statusWrap.title = 'Klikni pre zapnutie/vypnutie';
    statusWrap.addEventListener('click', function () {
      enabled = !enabled;
      if (enabled) {
        setStatus('idle', 'Automatické ukladanie · zapnuté');
        lastHash = computeHash();
      } else {
        setStatus('off', 'Automatické ukladanie · vypnuté');
      }
    });
  }

  // Sleduj zmenu statusu článku
  if (statusSelect) {
    statusSelect.addEventListener('change', function () {
      var newStatus = statusSelect.value;
      if (newStatus === 'published' || newStatus === 'scheduled') {
        enabled = false;
        setStatus('off', 'Automatické ukladanie · vypnuté');
      }
    });
  }

  function computeHash() {
    var data = new FormData(form);
    if (contentInput) data.set('content_json', contentInput.value);
    var parts = [];
    data.forEach(function (val, key) {
      if (key !== '_csrf') parts.push(key + '=' + val);
    });
    return parts.join('&');
  }

  function setStatus(state, text) {
    if (!statusDot || !statusText) return;
    statusDot.className = 'bz-art-save-dot';
    if (state === 'saving') {
      statusDot.classList.add('bz-art-save-dot--saving');
    } else if (state === 'saved') {
      statusDot.classList.add('bz-art-save-dot--saved');
    } else if (state === 'error') {
      statusDot.classList.add('bz-art-save-dot--error');
    } else if (state === 'off') {
      statusDot.classList.add('bz-art-save-dot--off');
    }
    statusText.textContent = text || 'Automatické ukladanie';
  }

  function collectData() {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (val, key) {
      if (key === '_csrf') return;
      if (
        key === 'category_ids' ||
        key === 'rubric_ids' ||
        key === 'tag_ids' ||
        key === 'position_ids'
      ) {
        if (!data[key]) data[key] = [];
        data[key].push(val);
      } else {
        data[key] = val;
      }
    });
    if (contentInput) data.content_json = contentInput.value;
    return data;
  }

  async function autosave() {
    if (!enabled || saving) return;

    var currentHash = computeHash();
    if (currentHash === lastHash) return;

    saving = true;
    setStatus('saving', 'Ukladám...');
    var saveStart = Date.now();

    try {
      var csrfToken = csrfInput ? csrfInput.value : '';
      var body = collectData();

      var res = await fetch('/admin/articles/' + articleId + '/autosave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });

      var result = await res.json();

      // Minimálne 1s žltá
      var elapsed = Date.now() - saveStart;
      var delay = Math.max(0, 2000 - elapsed);

      setTimeout(function () {
        if (result.ok) {
          lastHash = currentHash;
          var time = new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' });
          setStatus('saved', 'Uložené o ' + time);
        } else {
          setStatus('error', result.error || 'Chyba pri ukladaní');
        }
        saving = false;
      }, delay);
    } catch (e) {
      var elapsed2 = Date.now() - saveStart;
      setTimeout(
        function () {
          setStatus('error', 'Chyba pripojenia');
          saving = false;
        },
        Math.max(0, 1000 - elapsed2)
      );
    }
  }

  setInterval(autosave, INTERVAL);

  // Ctrl+S / Cmd+S
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (enabled) autosave();
    }
  });

  // Init stav
  if (enabled) {
    setStatus('idle', 'Automatické ukladanie · zapnuté');
  } else {
    setStatus('off', 'Automatické ukladanie · vypnuté');
  }
})();
