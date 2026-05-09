/**
 * Article block editor  (Phase 5 final + HOTFIX pre gallery/list reload)
 *
 * BUG FIX: setupGallery/setupList sa MUSIA volať AFTER container.appendChild(node),
 * pretože renderItems() volá currentIndex(node) — a tá vráti -1 ak node ešte nie je
 * v DOM-e. Pri prvom renderovaní z hidden JSON (po POST→reload) to spôsobovalo,
 * že gallery a list bloky boli prázdne, hoci v DB content boli.
 *
 * Riešenie: nový helper `setupNestedBlock(node, type)` ktorý sa volá:
 *   - v renderAll() AFTER container.appendChild(node)
 *   - v add() AFTER container.appendChild(node)
 *
 * Image a YouTube preview sa zachovali v renderBlock() — tie nezávisia od DOM pozície.
 *
 * Podporované block typy:
 *   - paragraph, heading, image, divider          (Phase 5.1)
 *   - youtube, quote                              (Phase 5.4)
 *   - gallery (vnorené items[])                   (Phase 5.6)
 *   - list (vnorené items[])                      (Phase 5.6)
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
  } catch (e) {
    blocks = [];
  }

  // Export blocks ref pre review-blocks setup
  window.__bzEditorBlocks = blocks;

  function syncHidden() {
    hiddenInput.value = JSON.stringify(blocks);
    if (emptyState) emptyState.style.display = blocks.length === 0 ? '' : 'none';
  }

  function defaultBlock(type) {
    switch (type) {
      case 'paragraph':
        return { type: 'paragraph', text: '' };
      case 'heading':
        return { type: 'heading', level: 2, text: '' };
      case 'image':
        return { type: 'image', media_id: null, alt: '', caption: '' };
      case 'divider':
        return { type: 'divider' };
      case 'youtube':
        return { type: 'youtube', video_id: '', caption: '' };
      case 'quote':
        return { type: 'quote', text: '', author: '' };
      case 'gallery':
        return { type: 'gallery', items: [] };
      case 'list':
        return { type: 'list', ordered: false, items: [''] };
      case 'section':
        return {
          type: 'section',
          layout: 'default',
          grid_title_side: 'right',
          number: '',
          eyebrow: '',
          title: '',
          title_style: 'default',
          show_divider: false,
          text: '',
          media_id: null,
          media_style: 'normal',
          video_url: '',
          caption: '',
          width: 'full',
        };
      case 'pros_cons':
        return { type: 'pros_cons', pros: [''], cons: [''], width: 'full' };
      case 'specs':
        return { type: 'specs', rows: [{ key: '', value: '' }], width: 'full' };
      case 'rating':
        return {
          type: 'rating',
          total_score: 0,
          badge: '',
          verdict_title: '',
          verdict_text: '',
        };
      case 'rating_breakdown':
        return {
          type: 'rating_breakdown',
          criteria: [{ name: '', score: 0 }],
          width: 'full',
        };
      case 'color_variants':
        return {
          type: 'color_variants',
          variants: [{ name: '', hex: '#000000', code: '', note: '', media_id: null }],
          width: 'full',
        };
      case 'review_banner':
        return {
          type: 'review_banner',
          title: '',
          subtitle: '',
          background_media_id: null,
          slider_media_ids: [],
          buttons: [],
          width: 'full',
        };

      default:
        return null;
    }
  }

  function getTemplate(type) {
    return document.querySelector('[data-block-template="' + type + '"]');
  }

  // ---- YouTube helpers ----
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
      el.innerHTML = '<span class="text-muted small">(zadaj URL alebo video ID)</span>';
      return;
    }
    el.innerHTML =
      '<div class="ratio ratio-16x9">' +
      '<iframe src="https://www.youtube.com/embed/' +
      videoId +
      '" ' +
      'title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
      'allowfullscreen></iframe></div>';
  }

  // ---- Gallery handlers ----
  function setupGallery(node) {
    var itemsContainer = node.querySelector('[data-gallery-items]');
    var addBtn = node.querySelector('[data-gallery-add]');
    if (!itemsContainer || !addBtn) return;

    function renderItems() {
      var idx = currentIndex(node);
      if (idx === -1) return; // safety, no longer triggers at initial render
      var items = blocks[idx].items || [];
      itemsContainer.innerHTML = '';
      items.forEach(function (item, i) {
        var row = document.createElement('div');
        row.className = 'bz-gallery-item';
        row.innerHTML =
          '<div class="bz-gallery-item-thumb" data-gallery-thumb></div>' +
          '<div class="bz-gallery-item-fields">' +
          '<div class="input-group input-group-sm mb-1">' +
          '<span class="input-group-text">Media ID</span>' +
          '<input type="number" class="form-control" data-gallery-media-id value="' +
          (item.media_id || '') +
          '" min="1">' +
          '<a href="/admin/media" target="_blank" class="btn btn-outline-secondary">' +
          '<i class="bi bi-images"></i></a>' +
          '</div>' +
          '<input type="text" class="form-control form-control-sm" data-gallery-caption ' +
          'placeholder="Popis (voliteľný)" maxlength="500" value="' +
          escapeAttr(item.caption || '') +
          '">' +
          '</div>' +
          '<div class="bz-gallery-item-actions">' +
          (i > 0
            ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-gallery-up><i class="bi bi-arrow-up"></i></button>'
            : '') +
          (i < items.length - 1
            ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-gallery-down><i class="bi bi-arrow-down"></i></button>'
            : '') +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-gallery-remove><i class="bi bi-x-lg"></i></button>' +
          '</div>';

        var midInput = row.querySelector('[data-gallery-media-id]');
        var capInput = row.querySelector('[data-gallery-caption]');
        var thumbEl = row.querySelector('[data-gallery-thumb]');

        if (item.media_id) updateImagePreviewToEl(thumbEl, item.media_id);
        else thumbEl.innerHTML = '<span class="text-muted small">—</span>';

        midInput.addEventListener('input', function () {
          var n = Number(midInput.value);
          var cidx = currentIndex(node);
          if (cidx === -1) return;
          blocks[cidx].items[i].media_id = Number.isInteger(n) && n > 0 ? n : null;
          if (blocks[cidx].items[i].media_id) {
            updateImagePreviewToEl(thumbEl, blocks[cidx].items[i].media_id);
          } else {
            thumbEl.innerHTML = '<span class="text-muted small">—</span>';
          }
          syncHidden();
        });
        capInput.addEventListener('input', function () {
          var cidx = currentIndex(node);
          if (cidx === -1) return;
          blocks[cidx].items[i].caption = capInput.value;
          syncHidden();
        });

        if (window.bzMediaPicker) {
          var pickerBtn = document.createElement('button');
          pickerBtn.type = 'button';
          pickerBtn.className = 'btn btn-outline-primary';
          pickerBtn.title = 'Vybrať z knižnice';
          pickerBtn.innerHTML = '<i class="bi bi-images"></i>';
          pickerBtn.addEventListener('click', function () {
            window.bzMediaPicker.open(midInput);
          });
          var existingLink = row.querySelector('a[href="/admin/media"]');
          if (existingLink) existingLink.parentNode.insertBefore(pickerBtn, existingLink);
        }

        var upBtn = row.querySelector('[data-gallery-up]');
        var downBtn = row.querySelector('[data-gallery-down]');
        var rmBtn = row.querySelector('[data-gallery-remove]');
        if (upBtn)
          upBtn.addEventListener('click', function () {
            var cidx = currentIndex(node);
            if (cidx === -1) return;
            var arr = blocks[cidx].items;
            var tmp = arr[i];
            arr[i] = arr[i - 1];
            arr[i - 1] = tmp;
            syncHidden();
            renderItems();
          });
        if (downBtn)
          downBtn.addEventListener('click', function () {
            var cidx = currentIndex(node);
            if (cidx === -1) return;
            var arr = blocks[cidx].items;
            var tmp = arr[i];
            arr[i] = arr[i + 1];
            arr[i + 1] = tmp;
            syncHidden();
            renderItems();
          });
        if (rmBtn)
          rmBtn.addEventListener('click', function () {
            var cidx = currentIndex(node);
            if (cidx === -1) return;
            blocks[cidx].items.splice(i, 1);
            syncHidden();
            renderItems();
          });

        itemsContainer.appendChild(row);
      });

      if (items.length === 0) {
        itemsContainer.innerHTML =
          '<div class="text-muted small fst-italic">Žiadne obrázky. Pridaj cez tlačidlo nižšie.</div>';
      }
    }

    addBtn.addEventListener('click', function () {
      var idx = currentIndex(node);
      if (idx === -1) return;
      if (!Array.isArray(blocks[idx].items)) blocks[idx].items = [];
      if (blocks[idx].items.length >= 30) {
        alert('Maximum 30 obrázkov v galérii.');
        return;
      }
      blocks[idx].items.push({ media_id: null, caption: '' });
      syncHidden();
      renderItems();
    });

    renderItems();
  }

  // ---- List handlers ----
  function setupList(node) {
    var itemsContainer = node.querySelector('[data-list-items]');
    var addBtn = node.querySelector('[data-list-add]');
    var orderedSel = node.querySelector('[data-field="ordered"]');
    if (!itemsContainer || !addBtn) return;

    var idx = currentIndex(node);
    if (idx !== -1) {
      orderedSel.value = blocks[idx].ordered ? '1' : '0';
    }
    orderedSel.addEventListener('input', function () {
      var cidx = currentIndex(node);
      if (cidx === -1) return;
      blocks[cidx].ordered = orderedSel.value === '1';
      syncHidden();
      renderItems(); // re-render aby sa bullety/čísla aktualizovali
    });

    function renderItems() {
      var cidx = currentIndex(node);
      if (cidx === -1) return;
      var items = blocks[cidx].items || [];
      itemsContainer.innerHTML = '';
      items.forEach(function (text, i) {
        var row = document.createElement('div');
        row.className = 'bz-list-item';
        row.innerHTML =
          '<span class="bz-list-bullet">' +
          (blocks[cidx].ordered ? i + 1 + '.' : '•') +
          '</span>' +
          '<input type="text" class="form-control form-control-sm" data-list-text ' +
          'maxlength="1000" value="' +
          escapeAttr(text) +
          '" placeholder="Položka zoznamu">' +
          '<div class="bz-list-actions">' +
          (i > 0
            ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-list-up><i class="bi bi-arrow-up"></i></button>'
            : '') +
          (i < items.length - 1
            ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-list-down><i class="bi bi-arrow-down"></i></button>'
            : '') +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-list-remove><i class="bi bi-x-lg"></i></button>' +
          '</div>';

        var input = row.querySelector('[data-list-text]');
        input.addEventListener('input', function () {
          var ci = currentIndex(node);
          if (ci === -1) return;
          blocks[ci].items[i] = input.value;
          syncHidden();
        });

        var upBtn = row.querySelector('[data-list-up]');
        var downBtn = row.querySelector('[data-list-down]');
        var rmBtn = row.querySelector('[data-list-remove]');
        if (upBtn)
          upBtn.addEventListener('click', function () {
            var ci = currentIndex(node);
            if (ci === -1) return;
            var arr = blocks[ci].items;
            var tmp = arr[i];
            arr[i] = arr[i - 1];
            arr[i - 1] = tmp;
            syncHidden();
            renderItems();
          });
        if (downBtn)
          downBtn.addEventListener('click', function () {
            var ci = currentIndex(node);
            if (ci === -1) return;
            var arr = blocks[ci].items;
            var tmp = arr[i];
            arr[i] = arr[i + 1];
            arr[i + 1] = tmp;
            syncHidden();
            renderItems();
          });
        if (rmBtn)
          rmBtn.addEventListener('click', function () {
            var ci = currentIndex(node);
            if (ci === -1) return;
            blocks[ci].items.splice(i, 1);
            if (blocks[ci].items.length === 0) blocks[ci].items.push('');
            syncHidden();
            renderItems();
          });

        itemsContainer.appendChild(row);
      });
    }

    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      if (ci === -1) return;
      if (!Array.isArray(blocks[ci].items)) blocks[ci].items = [];
      if (blocks[ci].items.length >= 100) {
        alert('Maximum 100 položiek v zozname.');
        return;
      }
      blocks[ci].items.push('');
      syncHidden();
      renderItems();
    });

    renderItems();
  }

  /**
   * Zavolá setup pre nested-item bloky. MUSÍ sa volať AFTER appendChild.
   */
  function setupNestedBlock(node, type) {
    if (type === 'gallery') setupGallery(node);
    else if (type === 'list') setupList(node);
    else if (window.__bzReviewBlocks && window.__bzReviewBlocks.setup) {
      window.__bzReviewBlocks.setup(node, type);
    }
  }

  function renderBlock(index) {
    var block = blocks[index];
    if (!block) return null;
    var tpl = getTemplate(block.type);
    if (!tpl) return null;

    var node = tpl.content.firstElementChild.cloneNode(true);

    // Section image preview
    if (block.type === 'section' && block.media_id) updateImagePreview(node, block.media_id);
    // Review banner bg preview
    if (block.type === 'review_banner' && block.background_media_id) {
      var bgPrev = node.querySelector('[data-banner-bg-preview]');
      if (bgPrev) updateImagePreviewToEl(bgPrev, block.background_media_id);
    }

    // Štandardné `data-field` polia (paragraph, heading, image, youtube, quote)
    // POZOR: pre list-u ordered tiež cez data-field, ale spravujeme ho v setupList.
    var fields = node.querySelectorAll('[data-field]');
    fields.forEach(function (f) {
      var key = f.getAttribute('data-field');
      if (block.type === 'list' && key === 'ordered') return;
      if (key === 'show_divider') return; // handled by setup

      var val = block[key];
      if (val === null || val === undefined) val = '';
      f.value = val;

      var isYoutubeUrlInput = block.type === 'youtube' && key === 'video_id';

      f.addEventListener('input', function () {
        var idx = currentIndex(node);
        if (idx === -1) return;
        var v = f.value;
        if (key === 'media_id') {
          var n = Number(v);
          blocks[idx][key] = Number.isInteger(n) && n > 0 ? n : null;
          updateImagePreview(node, blocks[idx][key]);
        } else if (key === 'level') {
          blocks[idx][key] = Number(v) === 3 ? 3 : 2;
        } else {
          blocks[idx][key] = v;
        }
        if (isYoutubeUrlInput) {
          var id = extractYtId(v);
          updateYoutubePreview(node, id);
        }
        syncHidden();
      });

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

    // image/youtube preview — bezpečné, nepoužíva currentIndex
    if (block.type === 'image' && block.media_id) updateImagePreview(node, block.media_id);
    if (block.type === 'youtube' && block.video_id) updateYoutubePreview(node, block.video_id);
    // POZOR: setupGallery/setupList sa NEvolajú tu — robí sa po appendChild!

    var actionsEl = node.querySelector('.bz-block-actions');
    if (actionsEl) {
      actionsEl.appendChild(
        makeIconBtn('arrow-up', 'Hore', function () {
          move(node, -1);
        })
      );
      actionsEl.appendChild(
        makeIconBtn('arrow-down', 'Dolu', function () {
          move(node, 1);
        })
      );
      actionsEl.appendChild(
        makeIconBtn(
          'x-lg',
          'Odstrániť',
          function () {
            remove(node);
          },
          'danger'
        )
      );
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
  function fetchMediaThumb(mediaId) {
    if (mediaCache[mediaId]) return Promise.resolve(mediaCache[mediaId]);
    return fetch('/admin/articles/media-thumb/' + mediaId, { credentials: 'same-origin' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data && data.thumbnail_path) {
          mediaCache[mediaId] = data;
          return data;
        }
        return null;
      });
  }

  function updateImagePreview(node, mediaId) {
    var el = node.querySelector('[data-image-preview]');
    if (!el) return;
    updateImagePreviewToEl(el, mediaId);
  }

  function updateImagePreviewToEl(el, mediaId) {
    if (!el) return;
    if (!mediaId) {
      el.innerHTML = '<span class="text-muted small">(žiadny)</span>';
      return;
    }
    el.innerHTML = '<span class="text-muted small">načítavam…</span>';
    fetchMediaThumb(mediaId)
      .then(function (data) {
        if (data) {
          el.innerHTML =
            '<img src="/uploads/' + data.thumbnail_path + '" class="img-fluid rounded" alt="">';
        } else {
          el.innerHTML = '<span class="text-danger small">ID neexistuje</span>';
        }
      })
      .catch(function () {
        el.innerHTML = '<span class="text-warning small">(chyba)</span>';
      });
  }

  function escapeAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function add(type) {
    var b = defaultBlock(type);
    if (!b) return;
    blocks.push(b);
    var node = renderBlock(blocks.length - 1);
    if (node) {
      container.appendChild(node);
      // CRITICAL: setupNestedBlock AFTER appendChild
      setupNestedBlock(node, type);
    }
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
    // Phase 1: vytvor a appendni všetky nodes
    var pendingSetups = [];
    for (var i = 0; i < blocks.length; i++) {
      var node = renderBlock(i);
      if (node) {
        container.appendChild(node);
        // Pamätaj si nested bloky — setup po append
        pendingSetups.push({ node: node, type: blocks[i].type });
      }
    }
    // Phase 2: setup nested bloky AFTER appendChild všetkých
    pendingSetups.forEach(function (p) {
      setupNestedBlock(p.node, p.type);
    });
    syncHidden();
  }

  document.querySelectorAll('[data-add-block]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      add(btn.getAttribute('data-add-block'));
    });
  });

  form.addEventListener('submit', function () {
    syncHidden();
  });

  renderAll();
})();
