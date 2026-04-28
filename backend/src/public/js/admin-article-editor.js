/**
 * Article block editor  (Phase 5.1)
 *
 * State: hidden <input data-content-json> drží JSON pole blokov.
 * Render: pre každý blok vytvoríme klon zo <template data-block-template="{type}">.
 *
 * Akcie:
 *   - Add block (data-add-block="{type}")     → pridá nový block na koniec
 *   - Move up / down                          → preusporiada
 *   - Remove                                  → vymaže
 *   - Edit field (input/change)               → updatne JSON
 *
 * Pri submit formulára sa odošle hidden input s aktuálnym JSONom — server
 * ho parsuje, sanitizuje a uloží.
 *
 * CSP-safe: žiadny inline JS, len addEventListener, žiadny eval.
 */

(function () {
  'use strict';

  var form = document.querySelector('[data-article-form]');
  if (!form) return;

  var hiddenInput = form.querySelector('[data-content-json]');
  var container = form.querySelector('[data-blocks-container]');
  var emptyState = form.querySelector('[data-empty-state]');
  if (!hiddenInput || !container) return;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  var blocks = [];
  try {
    blocks = JSON.parse(hiddenInput.value || '[]');
    if (!Array.isArray(blocks)) blocks = [];
  } catch (e) {
    blocks = [];
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  function syncHidden() {
    hiddenInput.value = JSON.stringify(blocks);
    if (emptyState) {
      emptyState.style.display = blocks.length === 0 ? '' : 'none';
    }
  }

  function defaultBlock(type) {
    switch (type) {
      case 'paragraph': return { type: 'paragraph', text: '' };
      case 'heading':   return { type: 'heading', level: 2, text: '' };
      case 'image':     return { type: 'image', media_id: null, alt: '', caption: '' };
      case 'divider':   return { type: 'divider' };
      default: return null;
    }
  }

  function getTemplate(type) {
    return document.querySelector('[data-block-template="' + type + '"]');
  }

  // -------------------------------------------------------------------------
  // Render single block from blocks[index]
  // -------------------------------------------------------------------------
  function renderBlock(index) {
    var block = blocks[index];
    if (!block) return null;
    var tpl = getTemplate(block.type);
    if (!tpl) return null;

    // <template>.content je DocumentFragment — naklonujeme prvý element
    var node = tpl.content.firstElementChild.cloneNode(true);

    // Naplň polia
    var fields = node.querySelectorAll('[data-field]');
    fields.forEach(function (f) {
      var key = f.getAttribute('data-field');
      var val = block[key];
      if (val === null || val === undefined) val = '';
      f.value = val;

      f.addEventListener('input', function () {
        // Find current index from DOM (môže sa zmeniť po move)
        var idx = currentIndex(node);
        if (idx === -1) return;
        var v = f.value;
        if (key === 'media_id') {
          var n = Number(v);
          blocks[idx][key] = (Number.isInteger(n) && n > 0) ? n : null;
          updateImagePreview(node, blocks[idx][key]);
        } else if (key === 'level') {
          blocks[idx][key] = Number(v) === 3 ? 3 : 2;
        } else {
          blocks[idx][key] = v;
        }
        syncHidden();
      });
    });

    // Image preview
    if (block.type === 'image' && block.media_id) {
      updateImagePreview(node, block.media_id);
    }

    // Action buttons (move up / down / remove)
    var actionsEl = node.querySelector('.bz-block-actions');
    if (actionsEl) {
      actionsEl.appendChild(makeIconBtn('arrow-up', 'Hore', function () { move(node, -1); }));
      actionsEl.appendChild(makeIconBtn('arrow-down', 'Dolu', function () { move(node, 1); }));
      actionsEl.appendChild(makeIconBtn('x-lg', 'Odstrániť', function () { remove(node); }, 'danger'));
    }

    node.setAttribute('data-block-index', String(index));
    return node;
  }

  function makeIconBtn(icon, title, onClick, variant) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-' + (variant || 'secondary');
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = '<i class="bi bi-' + icon + '"></i>';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function currentIndex(node) {
    var children = Array.prototype.slice.call(container.children);
    return children.indexOf(node);
  }

  function reindexDom() {
    Array.prototype.forEach.call(container.children, function (n, i) {
      n.setAttribute('data-block-index', String(i));
    });
  }

  // -------------------------------------------------------------------------
  // Image preview
  // -------------------------------------------------------------------------
  // Cache (avoid re-fetching same media)
  var mediaCache = {};

  function updateImagePreview(node, mediaId) {
    var el = node.querySelector('[data-image-preview]');
    if (!el) return;

    if (!mediaId) {
      el.innerHTML = '<span class="text-muted small">(žiadny)</span>';
      return;
    }

    if (mediaCache[mediaId]) {
      el.innerHTML = mediaCache[mediaId];
      return;
    }

    el.innerHTML = '<span class="text-muted small">načítavam…</span>';

    fetch('/admin/articles/media-thumb/' + mediaId, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.thumbnail_path) {
          var html = '<img src="/uploads/' + data.thumbnail_path + '" class="img-fluid rounded" alt="">';
          mediaCache[mediaId] = html;
          el.innerHTML = html;
        } else {
          el.innerHTML = '<span class="text-danger small">ID neexistuje</span>';
        }
      })
      .catch(function () {
        el.innerHTML = '<span class="text-warning small">(náhľad nedostupný)</span>';
      });
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------
  function add(type) {
    var b = defaultBlock(type);
    if (!b) return;
    blocks.push(b);
    var node = renderBlock(blocks.length - 1);
    if (node) container.appendChild(node);
    reindexDom();
    syncHidden();
    // Focus first input v novom bloku (ak existuje)
    var first = node && node.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  function move(node, dir) {
    var idx = currentIndex(node);
    if (idx === -1) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;

    // Swap v JSON
    var tmp = blocks[idx];
    blocks[idx] = blocks[newIdx];
    blocks[newIdx] = tmp;

    // Swap v DOM
    if (dir === -1) {
      container.insertBefore(node, container.children[newIdx]);
    } else {
      container.insertBefore(node, container.children[newIdx].nextSibling);
    }

    reindexDom();
    syncHidden();
  }

  function remove(node) {
    var idx = currentIndex(node);
    if (idx === -1) return;
    if (!window.confirm('Odstrániť tento blok?')) return;
    blocks.splice(idx, 1);
    container.removeChild(node);
    reindexDom();
    syncHidden();
  }

  // -------------------------------------------------------------------------
  // Init: render existing blocks, wire add buttons
  // -------------------------------------------------------------------------
  function renderAll() {
    container.innerHTML = '';
    for (var i = 0; i < blocks.length; i++) {
      var node = renderBlock(i);
      if (node) container.appendChild(node);
    }
    syncHidden();
  }

  document.querySelectorAll('[data-add-block]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      add(btn.getAttribute('data-add-block'));
    });
  });

  // Pri submit ešte raz syncneme — istota
  form.addEventListener('submit', function () {
    syncHidden();
  });

  renderAll();
})();
