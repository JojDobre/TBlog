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
        return { type: 'paragraph', text: '', format: 'html' };
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
      case 'banner':
        return { type: 'banner', banner_id: null };
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
        return { type: 'pros_cons', eyebrow: '', title: '', pros: [''], cons: [''], width: 'full' };
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

      case 'rvx_glance':
        return {
          type: 'rvx_glance',
          eyebrow: '',
          title: '',
          items: [{ icon: 'check', title: '', text: '' }],
        };
      case 'rvx_keyspecs':
        return { type: 'rvx_keyspecs', eyebrow: '', title: '', items: [{ num: '', label: '' }] };
      case 'rvx_quickstrip':
        return { type: 'rvx_quickstrip', items: [{ label: '', value: '', style: '' }] };
      case 'rvx_connect':
        return { type: 'rvx_connect', eyebrow: '', title: '', items: [''] };
      case 'rvx_quotes':
        return { type: 'rvx_quotes', eyebrow: '', title: '', items: [{ text: '', author: '' }] };
      case 'rvx_versus':
        return {
          type: 'rvx_versus',
          eyebrow: '',
          title: '',
          items: [{ name: '', desc: '', score: 0, pros: [], cons: [] }],
        };
      case 'rvx_gallery_full':
        return {
          type: 'rvx_gallery_full',
          eyebrow: '',
          title: '',
          items: [{ media_id: null, caption: '' }],
        };
      case 'rvx_gallery_exif':
        return {
          type: 'rvx_gallery_exif',
          eyebrow: '',
          title: '',
          items: [{ media_id: null, title: '', focal: '', aperture: '', iso: '', shutter: '' }],
        };
      case 'rvx_gallery_compare':
        return {
          type: 'rvx_gallery_compare',
          eyebrow: '',
          title: '',
          items: [
            {
              before_media_id: null,
              after_media_id: null,
              label: '',
              before_label: 'PRED',
              after_label: 'PO',
            },
          ],
        };
      case 'rvx_gallery_modes':
        return {
          type: 'rvx_gallery_modes',
          eyebrow: '',
          title: '',
          items: [{ media_id: null, title: '', desc: '', icon: 'image' }],
        };
      case 'rvx_gallery_samples':
        return {
          type: 'rvx_gallery_samples',
          eyebrow: '',
          title: '',
          items: [{ media_id: null, caption: '', settings: '' }],
        };
      case 'rvx_gallery_hero':
        return {
          type: 'rvx_gallery_hero',
          eyebrow: '',
          title: '',
          items: [{ media_id: null, caption: '' }],
        };
      case 'rvx_buyers':
        return { type: 'rvx_buyers', eyebrow: '', title: '', yes: [''], maybe: [''], no: [''] };
      case 'rvx_deepdive':
        return {
          type: 'rvx_deepdive',
          eyebrow: '',
          title: '',
          items: [{ tab_title: '', text: '' }],
        };
      case 'rvx_bench':
        return {
          type: 'rvx_bench',
          eyebrow: '',
          title: '',
          items: [{ name: '', score: 0, max: 100, label: '' }],
        };
      case 'rvx_timeline':
        return {
          type: 'rvx_timeline',
          eyebrow: '',
          title: '',
          items: [{ day: '', title: '', text: '' }],
        };
      case 'rvx_pricing':
        return {
          type: 'rvx_pricing',
          eyebrow: '',
          title: '',
          items: [{ name: '', price: '', specs: '', url: '' }],
        };
      case 'rvx_hilo':
        return { type: 'rvx_hilo', eyebrow: '', title: '', highs: [''], lows: [''] };
      case 'rvx_generations':
        return {
          type: 'rvx_generations',
          eyebrow: '',
          title: '',
          headers: [''],
          rows: [{ cells: [''] }],
        };
      case 'rvx_profile':
        return { type: 'rvx_profile', eyebrow: '', title: '', items: [{ label: '', value: '' }] };
      case 'rvx_awards':
        return {
          type: 'rvx_awards',
          eyebrow: '',
          title: '',
          items: [{ title: '', org: '', year: '' }],
        };
      case 'rvx_box':
        return { type: 'rvx_box', eyebrow: '', title: '', items: [{ icon: 'category', text: '' }] };
      case 'rvx_experts':
        return {
          type: 'rvx_experts',
          eyebrow: '',
          title: '',
          items: [{ name: '', role: '', text: '', score: null }],
        };
      case 'rvx_usecases':
        return {
          type: 'rvx_usecases',
          eyebrow: '',
          title: '',
          items: [{ icon: 'check', title: '', text: '', verdict: 'yes' }],
        };
      case 'rvx_battery':
        return {
          type: 'rvx_battery',
          eyebrow: '',
          title: '',
          items: [{ scenario: '', hours: '', pct: 0 }],
        };
      case 'rvx_software':
        return { type: 'rvx_software', eyebrow: '', title: '', items: [{ title: '', text: '' }] };
      case 'rvx_design':
        return {
          type: 'rvx_design',
          eyebrow: '',
          title: '',
          text: '',
          items: [{ label: '', value: '' }],
        };
      case 'rvx_sustain':
        return { type: 'rvx_sustain', eyebrow: '', title: '', items: [{ label: '', value: '' }] };
      case 'rvx_accessories':
        return {
          type: 'rvx_accessories',
          eyebrow: '',
          title: '',
          items: [{ name: '', price: '', url: '', note: '', media_id: null }],
        };
      case 'rvx_repair':
        return {
          type: 'rvx_repair',
          eyebrow: '',
          title: '',
          score: 0,
          items: [{ label: '', value: '' }],
        };
      case 'rvx_buy':
        return {
          type: 'rvx_buy',
          eyebrow: '',
          title: '',
          items: [{ shop: '', price: '', url: '' }],
        };
      case 'rvx_faq':
        return { type: 'rvx_faq', eyebrow: '', title: '', items: [{ q: '', a: '' }] };
      case 'rvx_alts':
        return {
          type: 'rvx_alts',
          eyebrow: '',
          title: '',
          items: [{ name: '', score: null, reason: '', url: '', slug: '' }],
        };
      case 'rvx_pricehist':
        return { type: 'rvx_pricehist', eyebrow: '', title: '', note: '', url: '' };
      case 'rvx_editornote':
        return { type: 'rvx_editornote', text: '', author: '' };
      case 'rvx_method':
        return { type: 'rvx_method', eyebrow: '', title: '', text: '', items: [''] };

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

  // ---- Quill paragraph editor ----
  function setupParagraph(node) {
    var editorEl = node.querySelector('[data-quill-editor]');
    if (!editorEl || editorEl.getAttribute('data-quill-init')) return;
    editorEl.setAttribute('data-quill-init', '1');

    // Wait for Quill to load (deferred script)
    function tryInit() {
      if (typeof Quill === 'undefined') {
        setTimeout(tryInit, 100);
        return;
      }

      var quill = new Quill(editorEl, {
        theme: 'snow',
        placeholder: 'Text odseku…',
        modules: {
          toolbar: [
            [{ header: [2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ color: [] }, { background: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'clean'],
          ],
        },
      });

      // Load existing content
      var ci = currentIndex(node);
      if (ci !== -1 && blocks[ci]) {
        var text = blocks[ci].text || '';
        if (text) {
          if (blocks[ci].format === 'html') {
            quill.root.innerHTML = text;
          } else {
            // Convert old markdown to HTML
            var html = text
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.+?)\*/g, '<em>$1</em>')
              .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
              .replace(/\n\n+/g, '</p><p>')
              .replace(/\n/g, '<br>');
            quill.root.innerHTML = '<p>' + html + '</p>';
          }
        }
      }

      // Sync on change
      quill.on('text-change', function () {
        var idx = currentIndex(node);
        if (idx === -1) return;
        var html = quill.root.innerHTML;
        // Clean empty content
        if (html === '<p><br></p>' || html === '<p></p>') html = '';
        blocks[idx].text = html;
        blocks[idx].format = 'html';
        syncHidden();
      });
    }
    tryInit();
  }

  /**
   * Zavolá setup pre nested-item bloky. MUSÍ sa volať AFTER appendChild.
   */
  function setupNestedBlock(node, type) {
    if (type === 'paragraph') setupParagraph(node);
    else if (type === 'gallery') setupGallery(node);
    else if (type === 'list') setupList(node);
    else if (window.__bzReviewBlocks && window.__bzReviewBlocks.setup) {
      window.__bzReviewBlocks.setup(node, type);
    }
    if (window.__bzRvxBlocks1 && window.__bzRvxBlocks1.setup) {
      window.__bzRvxBlocks1.setup(node, type);
    }
    if (window.__bzRvxBlocks && window.__bzRvxBlocks.setup) {
      window.__bzRvxBlocks.setup(node, type);
    }
    if (type === 'banner' && window.__bzBannerBlock) {
      window.__bzBannerBlock.setup(node, blocks[currentIndex(node)].banner_id);
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
      // Collapse toggle
      var collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'bz-block-collapse';
      collapseBtn.title = 'Zbaliť/Rozbaliť';
      collapseBtn.innerHTML = '<i class="bi bi-chevron-down"></i>';
      collapseBtn.addEventListener('click', function () {
        node.classList.toggle('bz-block--collapsed');
        collapseBtn.innerHTML = node.classList.contains('bz-block--collapsed')
          ? '<i class="bi bi-chevron-right"></i>'
          : '<i class="bi bi-chevron-down"></i>';
        saveCollapseState();
      });
      actionsEl.insertBefore(collapseBtn, actionsEl.firstChild);

      // Drag handle
      var grip = document.createElement('span');
      grip.className = 'bz-block-grip';
      grip.title = 'Presunúť';
      grip.innerHTML = '<i class="bi bi-grip-vertical"></i>';
      actionsEl.insertBefore(grip, collapseBtn.nextSibling);

      // Drag only via grip handle
      grip.addEventListener('mousedown', function () {
        node.setAttribute('draggable', 'true');
      });
      grip.addEventListener('mouseup', function () {
        node.setAttribute('draggable', 'false');
      });
      grip.addEventListener('mouseleave', function () {
        if (dragSrcIdx === -1) node.setAttribute('draggable', 'false');
      });

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

    // Drag & drop — only via grip handle
    node.setAttribute('draggable', 'false');
    node.addEventListener('dragstart', function (e) {
      dragSrcIdx = currentIndex(node);
      node.classList.add('bz-block--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragSrcIdx));
      // Auto-collapse all blocks for smooth dragging
      savedCollapseState = [];
      container.querySelectorAll('[data-block-type]').forEach(function (n) {
        savedCollapseState.push(n.classList.contains('bz-block--collapsed'));
        n.classList.add('bz-block--collapsed');
      });
      node.classList.remove('bz-block--collapsed');
    });
    node.addEventListener('dragend', function () {
      node.classList.remove('bz-block--dragging');
      node.setAttribute('draggable', 'false');
      clearDropIndicator();
      dragSrcIdx = -1;
      // Restore collapse state
      if (savedCollapseState.length) {
        container.querySelectorAll('[data-block-type]').forEach(function (n, i) {
          if (savedCollapseState[i]) n.classList.add('bz-block--collapsed');
          else n.classList.remove('bz-block--collapsed');
        });
        savedCollapseState = [];
      }
    });
    node.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      var rect = node.getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      var idx = currentIndex(node);
      showDropIndicator(e.clientY < mid ? idx : idx + 1);
    });
    node.addEventListener('drop', function (e) {
      e.preventDefault();
      if (dragSrcIdx === -1) return;
      var rect = node.getBoundingClientRect();
      var mid = rect.top + rect.height / 2;
      var targetIdx = currentIndex(node);
      if (e.clientY >= mid) targetIdx++;
      if (targetIdx > dragSrcIdx) targetIdx--;
      if (targetIdx === dragSrcIdx) {
        clearDropIndicator();
        return;
      }
      var moved = blocks.splice(dragSrcIdx, 1)[0];
      blocks.splice(targetIdx, 0, moved);
      clearDropIndicator();
      savedCollapseState = [];
      renderAll();
      refreshInserters();
      syncHidden();
    });

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
    var children = Array.prototype.slice.call(container.querySelectorAll('[data-block-type]'));
    return children.indexOf(node);
  }

  function reindexDom() {
    Array.prototype.forEach.call(container.querySelectorAll('[data-block-type]'), function (n, i) {
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

  // ---- Collapse persistence ----
  var articleId = form.getAttribute('data-article-id') || '';
  var collapseKey = articleId ? 'bz-collapsed-' + articleId : '';

  function saveCollapseState() {
    if (!collapseKey) return;
    var collapsed = [];
    container.querySelectorAll('[data-block-type]').forEach(function (n, i) {
      if (n.classList.contains('bz-block--collapsed')) collapsed.push(i);
    });
    try {
      localStorage.setItem(collapseKey, JSON.stringify(collapsed));
    } catch (e) {}
  }

  function restoreCollapseState() {
    if (!collapseKey) return;
    try {
      var saved = JSON.parse(localStorage.getItem(collapseKey) || '[]');
      if (!Array.isArray(saved) || !saved.length) return;
      container.querySelectorAll('[data-block-type]').forEach(function (n, i) {
        if (saved.indexOf(i) !== -1) {
          n.classList.add('bz-block--collapsed');
          var btn = n.querySelector('.bz-block-collapse');
          if (btn) btn.innerHTML = '<i class="bi bi-chevron-right"></i>';
        }
      });
    } catch (e) {}
  }

  // ---- Drag & drop state ----
  var dragSrcIdx = -1;
  var savedCollapseState = [];
  var dropIndicator = null;

  function showDropIndicator(beforeIdx) {
    clearDropIndicator();
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'bz-block-drop-indicator';
    var children = Array.prototype.slice.call(container.querySelectorAll('[data-block-type]'));
    if (beforeIdx >= children.length) container.appendChild(dropIndicator);
    else container.insertBefore(dropIndicator, children[beforeIdx]);
  }

  function clearDropIndicator() {
    if (dropIndicator && dropIndicator.parentNode)
      dropIndicator.parentNode.removeChild(dropIndicator);
    dropIndicator = null;
  }

  // ---- Inserters between blocks ----
  function createInserter(position) {
    var ins = document.createElement('div');
    ins.className = 'bz-block-inserter';
    ins.setAttribute('data-insert-pos', String(position));
    ins.innerHTML =
      '<button type="button" class="bz-block-inserter-btn" title="Pridať blok"><i class="bi bi-plus-lg"></i></button>';
    ins.querySelector('button').addEventListener('click', function () {
      toggleInserterPalette(ins, position);
    });
    return ins;
  }

  function toggleInserterPalette(ins, position) {
    var existing = ins.querySelector('.bz-block-inserter-palette');
    if (existing) {
      existing.remove();
      return;
    }
    // Close all other palettes
    container.querySelectorAll('.bz-block-inserter-palette').forEach(function (p) {
      p.remove();
    });
    var palette = document.createElement('div');
    palette.className = 'bz-block-inserter-palette';
    // Copy all add-block buttons
    document.querySelectorAll('[data-add-block]').forEach(function (btn) {
      var clone = document.createElement('button');
      clone.type = 'button';
      clone.className = 'bz-art-btn bz-art-btn-sm';
      clone.innerHTML = btn.innerHTML;
      clone.addEventListener('click', function () {
        var type = btn.getAttribute('data-add-block');
        insertAt(type, position);
        palette.remove();
      });
      palette.appendChild(clone);
    });
    ins.appendChild(palette);
  }

  function insertAt(type, position) {
    var b = defaultBlock(type);
    if (!b) return;
    blocks.splice(position, 0, b);
    renderAll();
    refreshInserters();
    syncHidden();
    // Focus new block
    var children = Array.prototype.slice.call(container.querySelectorAll('[data-block-type]'));
    if (children[position]) {
      children[position].scrollIntoView({ behavior: 'smooth', block: 'center' });
      var first = children[position].querySelector('input, textarea, select');
      if (first)
        setTimeout(function () {
          first.focus();
        }, 200);
    }
  }

  function refreshInserters() {
    // Remove old inserters
    container.querySelectorAll('.bz-block-inserter').forEach(function (i) {
      i.remove();
    });
    // Add inserter before first block
    var blockNodes = Array.prototype.slice.call(container.querySelectorAll('[data-block-type]'));
    if (blockNodes.length > 0) {
      container.insertBefore(createInserter(0), blockNodes[0]);
    }
    // Add inserter after each block
    blockNodes.forEach(function (node, i) {
      var ins = createInserter(i + 1);
      if (node.nextSibling) container.insertBefore(ins, node.nextSibling);
      else container.appendChild(ins);
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
    refreshInserters();
    var first = node && node.querySelector('input, textarea, select');
    if (first) first.focus();
  }

  function move(node, dir) {
    var blockNodes = Array.prototype.slice.call(container.querySelectorAll('[data-block-type]'));
    var idx = blockNodes.indexOf(node);
    if (idx === -1) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    var tmp = blocks[idx];
    blocks[idx] = blocks[newIdx];
    blocks[newIdx] = tmp;
    var target = blockNodes[newIdx];
    if (dir === -1) container.insertBefore(node, target);
    else container.insertBefore(node, target.nextSibling);
    reindexDom();
    syncHidden();
    refreshInserters();
  }

  function remove(node) {
    var idx = currentIndex(node);
    if (idx === -1) return;
    if (!window.confirm('Odstrániť tento blok?')) return;
    blocks.splice(idx, 1);
    container.removeChild(node);
    reindexDom();
    syncHidden();
    refreshInserters();
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
    refreshInserters();
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
  restoreCollapseState();

  window.__bzArticleEditor = {
    getBlocks: function () {
      return blocks;
    },
    setBlocks: function (newBlocks) {
      blocks = newBlocks;
      renderAll();
      refreshInserters();
      restoreCollapseState();
      syncHidden();
    },
  };
})();
