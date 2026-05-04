/**
 * Media picker modal  (Phase 5.5)
 *
 * Vytvorí Bootstrap modal s grid pickerom obrázkov.
 * Hookuje sa na všetky inputy ktoré majú name='cover_media_id', name='og_image_media_id',
 * alebo data-field='media_id' v image blokoch.
 *
 * Pri každom takom inpute pridá tlačidlo "Vybrať z knižnice" (modré, ikona obrázku).
 *
 * Pri kliknutí:
 *   1. Zapamätá si target input
 *   2. Otvorí modal, načíta prvú stránku obrázkov
 *   3. User klikne na obrázok → modal zatvorí, nastaví hodnotu inputu
 *   4. Trigger 'input' event aby existujúce listeners zafungovali (preview update, JSON sync)
 *
 * CSP-safe: žiadne inline scripty, len addEventListener.
 *
 * Globálne API:
 *   window.bzMediaPicker.open(targetInput)   — otvorí modal pre daný input
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Vytvor modal HTML štruktúru a vlož na koniec body
  // -------------------------------------------------------------------------
  function buildModal() {
    var modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.id = 'bzMediaPickerModal';
    modal.tabIndex = -1;
    modal.setAttribute('aria-labelledby', 'bzMediaPickerLabel');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
        '<div class="modal-content">' +
          '<div class="modal-header">' +
            '<h5 class="modal-title" id="bzMediaPickerLabel">' +
              '<i class="bi bi-images me-2"></i>Vybrať z knižnice' +
            '</h5>' +
            '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Zatvoriť"></button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<div class="bz-picker-toolbar mb-3">' +
              '<div class="input-group">' +
                '<span class="input-group-text"><i class="bi bi-search"></i></span>' +
                '<input type="search" class="form-control" data-picker-search ' +
                  'placeholder="Hľadať podľa názvu, alt textu alebo popisu...">' +
                '<button type="button" class="btn btn-outline-secondary" data-picker-search-btn>' +
                  'Hľadať' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div class="bz-picker-grid" data-picker-grid></div>' +
            '<div class="bz-picker-empty d-none text-center text-muted py-5" data-picker-empty>' +
              '<i class="bi bi-image fs-1 d-block mb-2 text-body-tertiary"></i>' +
              '<div>Žiadne obrázky</div>' +
              '<div class="small">Skús zmeniť hľadanie alebo nahraj nové cez ' +
                '<a href="/admin/media" target="_blank">mediálnu knižnicu</a>.</div>' +
            '</div>' +
            '<div class="bz-picker-loading d-none text-center text-muted py-5" data-picker-loading>' +
              '<div class="spinner-border" role="status">' +
                '<span class="visually-hidden">Načítavam...</span>' +
              '</div>' +
            '</div>' +
            '<nav class="mt-3 d-none" data-picker-pagination>' +
              '<ul class="pagination justify-content-center mb-0" data-picker-pages></ul>' +
            '</nav>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<small class="text-muted me-auto" data-picker-stats></small>' +
            '<a href="/admin/media" target="_blank" class="btn btn-sm btn-outline-primary">' +
              '<i class="bi bi-upload me-1"></i>Nahrať nové' +
            '</a>' +
            '<button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Zrušiť</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  // -------------------------------------------------------------------------
  // 2. Picker state
  // -------------------------------------------------------------------------
  var modalEl = null;
  var bsModal = null;
  var targetInput = null;
  var currentQuery = '';
  var currentPage = 1;

  // -------------------------------------------------------------------------
  // 3. Render fns
  // -------------------------------------------------------------------------
  function showLoading(show) {
    modalEl.querySelector('[data-picker-loading]').classList.toggle('d-none', !show);
    modalEl.querySelector('[data-picker-grid]').classList.toggle('d-none', show);
  }

  function showEmpty(show) {
    modalEl.querySelector('[data-picker-empty]').classList.toggle('d-none', !show);
    modalEl.querySelector('[data-picker-grid]').classList.toggle('d-none', show);
  }

  function renderGrid(items) {
    var grid = modalEl.querySelector('[data-picker-grid]');
    grid.innerHTML = '';
    items.forEach(function (item) {
      var thumbUrl = item.thumbnail_path ? '/uploads/' + item.thumbnail_path : null;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'bz-picker-card';
      card.setAttribute('data-picker-item-id', String(item.id));
      var dimensions = (item.width && item.height) ? (item.width + '×' + item.height) : '';
      card.innerHTML =
        '<div class="bz-picker-thumb">' +
          (thumbUrl
            ? '<img src="' + thumbUrl + '" alt="' + escapeAttr(item.alt_text || item.original_filename) + '">'
            : '<i class="bi bi-image text-body-tertiary"></i>') +
        '</div>' +
        '<div class="bz-picker-meta">' +
          '<div class="bz-picker-name">' + escapeHtml(item.original_filename) + '</div>' +
          '<div class="bz-picker-dim small text-muted">#' + item.id +
            (dimensions ? ' · ' + dimensions : '') + '</div>' +
        '</div>';
      card.addEventListener('click', function () { selectItem(item); });
      grid.appendChild(card);
    });
  }

  function renderPagination(page, totalPages) {
    var nav = modalEl.querySelector('[data-picker-pagination]');
    var ul = modalEl.querySelector('[data-picker-pages]');
    if (totalPages <= 1) {
      nav.classList.add('d-none');
      return;
    }
    nav.classList.remove('d-none');
    ul.innerHTML = '';

    var visible = new Set([1, totalPages, page - 1, page, page + 1]);
    var pages = Array.from(visible).filter(function (p) { return p >= 1 && p <= totalPages; });
    pages.sort(function (a, b) { return a - b; });

    function addLi(p, label, disabled, active) {
      var li = document.createElement('li');
      li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-link';
      btn.textContent = label;
      if (!disabled && !active) {
        btn.addEventListener('click', function () { goToPage(p); });
      }
      li.appendChild(btn);
      ul.appendChild(li);
    }

    addLi(page - 1, '‹', page <= 1, false);
    pages.forEach(function (p, idx) {
      if (idx > 0 && pages[idx - 1] < p - 1) {
        var sep = document.createElement('li');
        sep.className = 'page-item disabled';
        sep.innerHTML = '<span class="page-link">…</span>';
        ul.appendChild(sep);
      }
      addLi(p, String(p), false, p === page);
    });
    addLi(page + 1, '›', page >= totalPages, false);
  }

  function renderStats(total, page, totalPages) {
    var el = modalEl.querySelector('[data-picker-stats]');
    if (total === 0) { el.textContent = ''; return; }
    el.textContent = 'Stránka ' + page + ' z ' + totalPages + ' · spolu ' + total + ' obrázkov';
  }

  // -------------------------------------------------------------------------
  // 4. Actions
  // -------------------------------------------------------------------------
  function load(page, query) {
    currentPage = page;
    currentQuery = query || '';
    showLoading(true);
    showEmpty(false);

    var params = new URLSearchParams();
    if (query) params.set('q', query);
    if (page > 1) params.set('page', String(page));

    fetch('/admin/articles/media-picker?' + params.toString(), { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        showLoading(false);
        if (!data.items || data.items.length === 0) {
          showEmpty(true);
          renderPagination(1, 1);
          renderStats(0, 1, 1);
          return;
        }
        renderGrid(data.items);
        renderPagination(data.page, data.total_pages);
        renderStats(data.total, data.page, data.total_pages);
      })
      .catch(function (err) {
        showLoading(false);
        var grid = modalEl.querySelector('[data-picker-grid]');
        grid.innerHTML = '<div class="alert alert-danger">Načítanie zlyhalo: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function goToPage(p) {
    load(p, currentQuery);
    // Scroll do horneho okraja modal-body
    var body = modalEl.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
  }

  function selectItem(item) {
    if (!targetInput) return;
    targetInput.value = String(item.id);
    // Trigger 'input' event aby preview/JSON sync zafungovali
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    bsModal.hide();
  }

  // -------------------------------------------------------------------------
  // 5. Open API
  // -------------------------------------------------------------------------
  function open(input) {
    targetInput = input;
    if (!modalEl) {
      modalEl = buildModal();
      bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);

      // Wire search
      var searchInput = modalEl.querySelector('[data-picker-search]');
      var searchBtn = modalEl.querySelector('[data-picker-search-btn]');
      var doSearch = function () { load(1, searchInput.value.trim()); };
      searchBtn.addEventListener('click', doSearch);
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSearch();
        }
      });
    }

    // Reset state pri každom otvorení
    var searchInput = modalEl.querySelector('[data-picker-search]');
    searchInput.value = '';

    bsModal.show();
    load(1, '');
    // Focus search po otvorení
    setTimeout(function () { searchInput.focus(); }, 200);
  }

  // -------------------------------------------------------------------------
  // 6. Auto-attach picker buttons to existing inputs
  // -------------------------------------------------------------------------
  function attachButtonToInputGroup(input, labelText) {
    // Nájdi `.input-group` parent
    var group = input.closest('.input-group');
    if (!group) return;

    // Ak už máme picker tlačidlo, skip
    if (group.querySelector('[data-picker-trigger]')) return;

    // Vytvor tlačidlo
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-outline-primary';
    btn.setAttribute('data-picker-trigger', '');
    btn.title = labelText || 'Vybrať z knižnice';
    btn.setAttribute('aria-label', labelText || 'Vybrať z knižnice');
    btn.innerHTML = '<i class="bi bi-images"></i>';
    btn.addEventListener('click', function () { open(input); });

    // Vlož PRED externý link na knižnicu (ak existuje), inak na koniec
    var existingLink = group.querySelector('a[href="/admin/media"]');
    if (existingLink) {
      group.insertBefore(btn, existingLink);
    } else {
      group.appendChild(btn);
    }
  }

  function scanInputs(root) {
    root = root || document;
    // Cover, OG image
    root.querySelectorAll('input[name="cover_media_id"], input[name="og_image_media_id"]')
      .forEach(function (input) {
        attachButtonToInputGroup(input, 'Vybrať obrázok z knižnice');
      });
    // Image bloky (data-field="media_id" v image template)
    root.querySelectorAll('input[data-field="media_id"]')
      .forEach(function (input) {
        attachButtonToInputGroup(input, 'Vybrať obrázok z knižnice');
      });
  }

  // Scan pri page load
  scanInputs(document);

  // Watch DOM — keď editor pridá nový image blok, treba zavesiť tlačidlo aj naň.
  // Použijeme MutationObserver na hlavný blocks-container.
  var blocksContainer = document.querySelector('[data-blocks-container]');
  if (blocksContainer && typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) scanInputs(node);
        });
      });
    });
    observer.observe(blocksContainer, { childList: true, subtree: true });
  }

  // -------------------------------------------------------------------------
  // 7. Helpers
  // -------------------------------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // Expose
  window.bzMediaPicker = { open: open };
})();
