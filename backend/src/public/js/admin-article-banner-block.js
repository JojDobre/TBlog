/**
 * Banner block for article editor
 *
 * Pridáva blok typu 'banner' — výber z existujúcich bannerov.
 * Select sa plní cez AJAX z /api/banners/list.
 *
 * Beží PRED admin-article-editor.js.
 */
(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Template
  // -------------------------------------------------------------------------
  function ensureTemplate(type, html) {
    if (document.querySelector('[data-block-template="' + type + '"]')) return;
    var tpl = document.createElement('template');
    tpl.setAttribute('data-block-template', type);
    tpl.innerHTML = html.trim();
    document.body.appendChild(tpl);
  }

  ensureTemplate('banner', '' +
    '<div class="bz-block" data-block-type="banner">' +
      '<div class="bz-block-header">' +
        '<span class="bz-block-label"><i class="bi bi-badge-ad me-1"></i>Banner</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="mb-2">' +
        '<label class="form-label form-label-sm mb-1">Vyber banner</label>' +
        '<select class="form-select form-select-sm" data-field="banner_id" data-banner-select>' +
          '<option value="">— Načítavam bannery... —</option>' +
        '</select>' +
      '</div>' +
      '<div data-banner-preview style="font-size:12px; color:var(--art-text-subtle); padding:6px 0"></div>' +
    '</div>'
  );

  // -------------------------------------------------------------------------
  // 2. Toolbar button
  // -------------------------------------------------------------------------
  function addToolbarButton(type, iconClass, label) {
    if (document.querySelector('[data-add-block="' + type + '"]')) return;
    var existing = document.querySelector('[data-add-block]');
    if (!existing || !existing.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bz-art-btn bz-art-btn-sm';
    btn.setAttribute('data-add-block', type);
    btn.innerHTML = '<i class="bi ' + iconClass + '"></i> ' + label;
    existing.parentNode.appendChild(btn);
  }

  addToolbarButton('banner', 'bi-badge-ad', 'Banner');

  // -------------------------------------------------------------------------
  // 3. Load banners list (cached)
  // -------------------------------------------------------------------------
  var bannersCache = null;

  function loadBanners(callback) {
    if (bannersCache) return callback(bannersCache);

    fetch('/api/banners/list', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        bannersCache = data.banners || [];
        callback(bannersCache);
      })
      .catch(function () {
        callback([]);
      });
  }

  // -------------------------------------------------------------------------
  // 4. Setup — populate select after block is added/rendered
  // -------------------------------------------------------------------------
  function setupBannerBlock(node, bannerId) {
    var select = node.querySelector('[data-banner-select]');
    var preview = node.querySelector('[data-banner-preview]');
    if (!select) return;

    loadBanners(function (banners) {
      select.innerHTML = '<option value="">— Vyber banner —</option>';
      banners.forEach(function (b) {
        var opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name + ' (' + b.type + ')' + (b.status !== 'active' ? ' [neaktívny]' : '');
        if (String(b.id) === String(bannerId)) opt.selected = true;
        select.appendChild(opt);
      });
      updatePreview(select, preview, banners);
    });

    select.addEventListener('change', function () {
      loadBanners(function (banners) {
        updatePreview(select, preview, banners);
      });
    });
  }

  function updatePreview(select, preview, banners) {
    if (!preview) return;
    var id = select.value;
    if (!id) {
      preview.textContent = '';
      return;
    }
    var banner = banners.find(function (b) { return String(b.id) === String(id); });
    if (banner) {
      var info = 'Typ: ' + banner.type;
      if (banner.template_key) info += ' (' + banner.template_key + ')';
      info += ' · Stav: ' + banner.status;
      if (banner.positions) info += ' · Pozície: ' + banner.positions;
      preview.textContent = info;
    }
  }

  // Export pre editor setup
  window.__bzBannerBlock = {
    setup: setupBannerBlock,
  };
})();
