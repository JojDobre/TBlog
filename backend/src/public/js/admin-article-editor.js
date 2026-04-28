/**
 * Article block editor  (Phase 5.4)
 *
 * Pridaná podpora pre block typy: youtube, quote.
 *
 * YouTube blok: pri opustení URL inputu sa hodnota normalizuje na video_id
 * (extrahuje z URL); preview ukáže `https://www.youtube.com/embed/{id}`.
 */

(function () {
  'use strict';

  var form = document.querySelector('[data-article-form]');
  if (!form) return;

  var hiddenInput = form.querySelector('[data-content-json]');
  var container = form.querySelector('[data-blocks-container]');
  var emptyState = form.querySelector('[data-empty-state]');
  if (!hiddenInput || !container) return;

  var blocks = [];
  try {
    blocks = JSON.parse(hiddenInput.value || '[]');
    if (!Array.isArray(blocks)) blocks = [];
  } catch (e) { blocks = []; }

  function syncHidden() {
    hiddenInput.value = JSON.stringify(blocks);
    if (emptyState) emptyState.style.display = blocks.length === 0 ? '' : 'none';
  }

  function defaultBlock(type) {
    switch (type) {
      case 'paragraph': return { type: 'paragraph', text: '' };
      case 'heading':   return { type: 'heading', level: 2, text: '' };
      case 'image':     return { type: 'image', media_id: null, alt: '', caption: '' };
      case 'divider':   return { type: 'divider' };
      case 'youtube':   return { type: 'youtube', video_id: '', caption: '' };
      case 'quote':     return { type: 'quote', text: '', author: '' };
      default: return null;
    }
  }

  function getTemplate(type) {
    return document.querySelector('[data-block-template="' + type + '"]');
  }

  // ---- YouTube ID extraction (rovnaká logika ako server) ----
  var YT_RE = /^[a-zA-Z0-9_-]{11}$/;
  function extractYtId(input) {
    if (!input) return null;
    var s = String(input).trim();
    if (!s) return null;
    if (YT_RE.test(s)) return s;
    var m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/youtube\.com\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
    return null;
  }

  function updateYoutubePreview(node, videoId) {
    var el = node.querySelector('[data-youtube-preview]');
    if (!el) return;
    if (!videoId) {
      el.innerHTML = '<span class="text-muted small">(zadaj YouTube URL alebo video ID)</span>';
      return;
    }
    el.innerHTML =
      '<div class="ratio ratio-16x9">' +
      '<iframe src="https://www.youtube.com/embed/' + videoId + '" ' +
      'title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      'allowfullscreen></iframe></div>';
  }

  function renderBlock(index) {
    var block = blocks[index];
    if (!block) return null;
    var tpl = getTemplate(block.type);
    if (!tpl) return null;

    var node = tpl.content.firstElementChild.cloneNode(true);

    var fields = node.querySelectorAll('[data-field]');
    fields.forEach(function (f) {
      var key = f.getAttribute('data-field');
      var val = block[key];
      if (val === null || val === undefined) val = '';
      f.value = val;

      // YouTube URL input — pri blur normalizuj URL na video_id
      var isYoutubeUrlInput =
        block.type === 'youtube' && key === 'video_id';

      f.addEventListener('input', function () {
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
        // Live preview pre YouTube — len ak je už 11-znakové ID
        if (isYoutubeUrlInput) {
          var id = extractYtId(v);
          updateYoutubePreview(node, id);
        }
        syncHidden();
      });

      // Pri opustení YouTube inputu — normalizuj URL na video_id
      if (isYoutubeUrlInput) {
        f.addEventListener('blur', function () {
          var idx = currentIndex(node);
          if (idx === -1) return;
          var id = extractYtId(f.value);
          if (id) {
            f.value = id;
            blocks[idx].video_id = id;
            updateYoutubePreview(node, id);
            syncHidden();
          }
        });
      }
    });

    if (block.type === 'image' && block.media_id) updateImagePreview(node, block.media_id);
    if (block.type === 'youtube' && block.video_id) updateYoutubePreview(node, block.video_id);

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

  function add(type) {
    var b = defaultBlock(type);
    if (!b) return;
    blocks.push(b);
    var node = renderBlock(blocks.length - 1);
    if (node) container.appendChild(node);
    reindexDom();
    syncHidden();
    var first = node && node.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  function move(node, dir) {
    var idx = currentIndex(node);
    if (idx === -1) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    var tmp = blocks[idx];
    blocks[idx] = blocks[newIdx];
    blocks[newIdx] = tmp;
    if (dir === -1) container.insertBefore(node, container.children[newIdx]);
    else container.insertBefore(node, container.children[newIdx].nextSibling);
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

  function renderAll() {
    container.innerHTML = '';
    for (var i = 0; i < blocks.length; i++) {
      var node = renderBlock(i);
      if (node) container.appendChild(node);
    }
    syncHidden();
  }

  document.querySelectorAll('[data-add-block]').forEach(function (btn) {
    btn.addEventListener('click', function () { add(btn.getAttribute('data-add-block')); });
  });

  form.addEventListener('submit', function () { syncHidden(); });

  renderAll();
})();
