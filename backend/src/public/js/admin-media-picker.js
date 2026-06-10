/**
 * Media picker modal  (Phase 5.5 — v2)
 *
 * Vizuálny picker pre všetky media_id inputy v celej admin sekcii.
 * Automaticky sa napája na:
 *   - input[name="cover_media_id"], input[name="og_image_media_id"]
 *   - input[data-field="media_id"]
 *   - input[data-i] kde data-i obsahuje "media_id" (rvx bloky)
 *
 * Po výbere obrázka zobrazí thumbnail náhľad vedľa inputu.
 *
 * Globálne API:
 *   window.bzMediaPicker.open(targetInput)
 */
(function () {
  'use strict';

  // =========================================================================
  // 1. Modal HTML
  // =========================================================================
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
      '<div class="bz-picker-toolbar mb-3 d-flex gap-2">' +
      '<div class="input-group">' +
      '<span class="input-group-text"><i class="bi bi-search"></i></span>' +
      '<input type="search" class="form-control" data-picker-search ' +
      'placeholder="Hľadať podľa názvu, alt textu alebo popisu...">' +
      '<button type="button" class="btn btn-outline-secondary" data-picker-search-btn>Hľadať</button>' +
      '</div>' +
      '<button type="button" class="btn btn-primary flex-shrink-0" data-picker-upload-btn>' +
      '<i class="bi bi-upload me-1"></i>Nahrať' +
      '</button>' +
      '<input type="file" accept="image/*" multiple data-picker-file class="d-none">' +
      '</div>' +
      '<div class="alert alert-info d-none" data-picker-upload-status></div>' +
      '<div class="bz-picker-grid" data-picker-grid></div>' +
      '<div class="bz-picker-empty d-none text-center text-muted py-5" data-picker-empty>' +
      '<i class="bi bi-image fs-1 d-block mb-2 text-body-tertiary"></i>' +
      '<div>Žiadne obrázky</div>' +
      '<div class="small">Skús zmeniť hľadanie alebo nahraj nové cez ' +
      '<a href="/admin/media" target="_blank">mediálnu knižnicu</a>.</div>' +
      '</div>' +
      '<div class="bz-picker-loading d-none text-center text-muted py-5" data-picker-loading>' +
      '<div class="spinner-border" role="status"><span class="visually-hidden">Načítavam...</span></div>' +
      '</div>' +
      '<nav class="mt-3 d-none" data-picker-pagination>' +
      '<ul class="pagination justify-content-center mb-0" data-picker-pages></ul>' +
      '</nav>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<small class="text-muted me-auto" data-picker-stats></small>' +
      '<span class="bz-picker-multibar d-none align-items-center gap-2" data-picker-multibar>' +
      '<span class="text-muted small" data-picker-multicount>0 označených</span>' +
      '<button type="button" class="btn btn-sm btn-success" data-picker-multi-confirm>' +
      '<i class="bi bi-check-lg me-1"></i>Vybrať označené</button>' +
      '</span>' +
      '<button type="button" class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Zrušiť</button>' +
      '</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);
    return modal;
  }

  // =========================================================================
  // 2. State
  // =========================================================================
  var modalEl = null;
  var bsModal = null;
  var targetInput = null;
  var currentQuery = '';
  var currentPage = 1;
  var multiMode = false;
  var multiCallback = null;
  var multiSelected = {}; // { id: item }

  // =========================================================================
  // 3. Render
  // =========================================================================
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
      var dimensions = item.width && item.height ? item.width + '×' + item.height : '';
      card.innerHTML =
        '<div class="bz-picker-thumb">' +
        (thumbUrl
          ? '<img src="' +
            thumbUrl +
            '" alt="' +
            esc(item.alt_text || item.original_filename) +
            '">'
          : '<i class="bi bi-image text-body-tertiary"></i>') +
        '</div>' +
        '<div class="bz-picker-meta">' +
        '<div class="bz-picker-name">' +
        esc(item.original_filename) +
        '</div>' +
        '<div class="bz-picker-dim small text-muted">#' +
        item.id +
        (dimensions ? ' · ' + dimensions : '') +
        '</div>' +
        '</div>';
      if (multiMode && multiSelected[item.id]) {
        card.classList.add('bz-picker-card--selected');
      }
      card.addEventListener('click', function () {
        if (multiMode) {
          if (multiSelected[item.id]) {
            delete multiSelected[item.id];
            card.classList.remove('bz-picker-card--selected');
          } else {
            multiSelected[item.id] = item;
            card.classList.add('bz-picker-card--selected');
          }
          updateMultiBar();
        } else {
          selectItem(item);
        }
      });
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
    var pages = Array.from(visible).filter(function (p) {
      return p >= 1 && p <= totalPages;
    });
    pages.sort(function (a, b) {
      return a - b;
    });
    function addLi(p, label, disabled, active) {
      var li = document.createElement('li');
      li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-link';
      btn.textContent = label;
      if (!disabled && !active)
        btn.addEventListener('click', function () {
          goToPage(p);
        });
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
    if (total === 0) {
      el.textContent = '';
      return;
    }
    el.textContent = 'Stránka ' + page + ' z ' + totalPages + ' · spolu ' + total + ' obrázkov';
  }

  // =========================================================================
  // 4. Actions
  // =========================================================================
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
        modalEl.querySelector('[data-picker-grid]').innerHTML =
          '<div class="alert alert-danger">Načítanie zlyhalo: ' + esc(err.message) + '</div>';
      });
  }

  function goToPage(p) {
    load(p, currentQuery);
    var body = modalEl.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
  }

  function selectItem(item) {
    if (!targetInput) return;
    targetInput.value = String(item.id);
    targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    targetInput.dispatchEvent(new Event('change', { bubbles: true }));
    // Show thumbnail preview
    updatePreview(targetInput, item);
    bsModal.hide();
  }

  // =========================================================================
  // 5. Thumbnail preview
  // =========================================================================
  function updatePreview(input, item) {
    var wrap = input.closest('.bz-media-wrap');
    if (!wrap) return;
    var prev = wrap.querySelector('.bz-media-preview');
    if (!prev) {
      prev = document.createElement('div');
      prev.className = 'bz-media-preview';
      wrap.appendChild(prev);
    }
    if (item && item.thumbnail_path) {
      prev.innerHTML =
        '<img src="/uploads/' +
        esc(item.thumbnail_path) +
        '" alt="">' +
        '<button type="button" class="bz-media-remove" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
      prev.querySelector('.bz-media-remove').addEventListener('click', function () {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        prev.innerHTML = '';
      });
    } else {
      prev.innerHTML = '';
    }
  }

  function loadPreviewForInput(input) {
    var val = input.value;
    if (!val || val === '0' || val === 'null') return;
    // Fetch thumbnail for existing media_id
    fetch('/admin/articles/media-picker?ids=' + val, { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.items && data.items.length > 0) updatePreview(input, data.items[0]);
      })
      .catch(function () {});
  }

  function doUpload(files, statusEl) {
    var csrfEl = document.querySelector('[name="_csrf"]');
    var csrf = csrfEl ? csrfEl.value : '';
    var fd = new FormData();
    for (var i = 0; i < files.length; i++) fd.append('files', files[i]);
    fd.append('_csrf', csrf);

    if (statusEl) {
      statusEl.classList.remove('d-none', 'alert-danger');
      statusEl.classList.add('alert-info');
      statusEl.textContent = 'Nahrávam ' + files.length + ' súbor(ov)…';
    }

    fetch('/admin/articles/media-upload', {
      method: 'POST',
      credentials: 'same-origin',
      body: fd,
    })
      .then(function (r) {
        return r.json().then(function (data) {
          if (!r.ok) throw new Error(data.error || 'HTTP ' + r.status);
          return data;
        });
      })
      .then(function (data) {
        var uploaded = data.uploaded || [];
        if (statusEl) {
          if (data.errors && data.errors.length) {
            statusEl.classList.remove('alert-info');
            statusEl.classList.add('alert-danger');
            statusEl.textContent = 'Časť zlyhala: ' + data.errors.join('; ');
          } else {
            statusEl.classList.add('d-none');
          }
        }
        if (uploaded.length === 1) {
          // jeden obrázok → rovno vyber a zatvor
          selectItem({ id: uploaded[0].id, thumbnail_path: uploaded[0].thumbnail_path });
        } else if (uploaded.length > 1) {
          // viac → refresh gridu, nech si vyberie
          load(1, '');
        }
      })
      .catch(function (err) {
        if (statusEl) {
          statusEl.classList.remove('d-none', 'alert-info');
          statusEl.classList.add('alert-danger');
          statusEl.textContent = 'Nahrávanie zlyhalo: ' + err.message;
        }
      });
  }

  function updateMultiBar() {
    if (!modalEl) return;
    var bar = modalEl.querySelector('[data-picker-multibar]');
    var count = Object.keys(multiSelected).length;
    if (bar) {
      bar.classList.toggle('d-none', !multiMode);
      bar.classList.toggle('d-flex', multiMode);
      var lbl = bar.querySelector('[data-picker-multicount]');
      if (lbl) lbl.textContent = count + ' označených';
    }
  }

  function openMulti(callback) {
    multiMode = true;
    multiCallback = callback;
    multiSelected = {};
    targetInput = null;
    if (!modalEl) {
      modalEl = buildModal();
      bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      attachPickerListeners();
    }
    modalEl.querySelector('[data-picker-search]').value = '';
    updateMultiBar();
    bsModal.show();
    load(1, '');
  }

  // =========================================================================
  // 6. Open API
  // =========================================================================
  function attachPickerListeners() {
    var searchInput = modalEl.querySelector('[data-picker-search]');
    var searchBtn = modalEl.querySelector('[data-picker-search-btn]');
    var doSearch = function () {
      load(1, searchInput.value.trim());
    };
    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });

    // Upload priamo z pickera
    var uploadBtn = modalEl.querySelector('[data-picker-upload-btn]');
    var fileInput = modalEl.querySelector('[data-picker-file]');
    var statusEl = modalEl.querySelector('[data-picker-upload-status]');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () {
        fileInput.click();
      });
      fileInput.addEventListener('change', function () {
        var files = fileInput.files;
        if (!files || !files.length) return;
        doUpload(files, statusEl);
        fileInput.value = '';
      });
    }

    // Multi-select: tlačidlo "Vybrať označené"
    var confirmBtn = modalEl.querySelector('[data-picker-multi-confirm]');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        var items = Object.keys(multiSelected).map(function (k) {
          return multiSelected[k];
        });
        if (multiCallback) multiCallback(items);
        bsModal.hide();
      });
    }
  }

  function open(input) {
    targetInput = input;
    multiMode = false;
    multiCallback = null;
    if (!modalEl) {
      modalEl = buildModal();
      bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
      attachPickerListeners();
    }
    updateMultiBar();
    modalEl.querySelector('[data-picker-search]').value = '';
    bsModal.show();
    load(1, '');
    setTimeout(function () {
      modalEl.querySelector('[data-picker-search]').focus();
    }, 200);
  }

  // =========================================================================
  // 7. Auto-attach to ALL media inputs
  // =========================================================================
  function isMediaInput(input) {
    if (input.type !== 'number' && input.type !== 'text') return false;
    var name = input.name || '';
    var field = input.getAttribute('data-field') || '';
    var di = input.getAttribute('data-i') || '';
    return (
      name.indexOf('media_id') !== -1 ||
      field.indexOf('media_id') !== -1 ||
      di.indexOf('media_id') !== -1
    );
  }

  function wrapInput(input) {
    if (input.getAttribute('data-media-attached')) return;
    input.setAttribute('data-media-attached', '1');

    var group = input.closest('.input-group');

    if (group) {
      // Input is in an input-group (cover, OG image) — add button to group, don't rewrap
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-outline-primary';
      btn.title = 'Vybrať z knižnice';
      btn.innerHTML = '<i class="bi bi-images"></i>';
      btn.addEventListener('click', function () {
        open(input);
      });
      // Insert before the existing library link if it exists
      var existingLink = group.querySelector('a[href*="/admin/media"]');
      if (existingLink) group.insertBefore(btn, existingLink);
      else group.appendChild(btn);

      // Update existing cover preview on selection
      input.addEventListener('change', function () {
        var previewEl = group.closest('.bz-art-side-body, .mb-3, div')
          ? group.parentElement.querySelector('[data-cover-preview]')
          : null;
        if (!previewEl) return;
        var val = input.value;
        if (!val || val === '0') {
          previewEl.innerHTML =
            '<span style="font-family:var(--art-mono);font-size:11px">bez obrázka</span>';
          return;
        }
        fetch('/admin/articles/media-picker?ids=' + val, { credentials: 'same-origin' })
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (data.items && data.items[0] && data.items[0].thumbnail_path) {
              previewEl.innerHTML =
                '<img src="/uploads/' + esc(data.items[0].thumbnail_path) + '" alt="Cover">';
            }
          })
          .catch(function () {});
      });
    } else {
      // Standalone input (rvx blocks) — wrap in .bz-media-wrap
      var wrap = document.createElement('div');
      wrap.className = 'bz-media-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      var pickerBtn = document.createElement('button');
      pickerBtn.type = 'button';
      pickerBtn.className = 'bz-media-btn';
      pickerBtn.title = 'Vybrať z knižnice';
      pickerBtn.innerHTML = '<i class="bi bi-images"></i>';
      pickerBtn.addEventListener('click', function () {
        open(input);
      });
      wrap.appendChild(pickerBtn);

      // Load existing preview
      if (input.value && input.value !== '0' && input.value !== 'null') {
        loadPreviewForInput(input);
      }
    }
  }

  function scanAll(root) {
    root = root || document;
    // Named inputs
    root.querySelectorAll('input[name*="media_id"]').forEach(wrapInput);
    // data-field
    root.querySelectorAll('input[data-field*="media_id"]').forEach(wrapInput);
    // data-i (rvx blocks)
    root.querySelectorAll('input[data-i*="media_id"]').forEach(wrapInput);
  }

  // Initial scan
  scanAll(document);

  // MutationObserver — catch dynamically added inputs (new blocks)
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) scanAll(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // =========================================================================
  // 8. Helpers
  // =========================================================================
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  window.bzMediaPicker = { open: open, openMulti: openMulti, scan: scanAll };
})();
