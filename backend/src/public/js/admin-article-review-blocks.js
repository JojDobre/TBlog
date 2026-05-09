/**
 * Phase 6 — Review & Section block templates + setup helpers.
 *
 * Nové blokové typy:
 *   - section        (univerzálna content sekcia s layout variantmi)
 *   - pros_cons      (plusy / mínusy)
 *   - specs          (tabuľka špecifikácií)
 *   - rating         (hodnotenie s kritériami + verdikt)
 *   - color_variants (farebné varianty produktu)
 *   - review_banner  (banner recenzie so sliderom)
 *
 * Beží PRED admin-article-editor.js (rovnako ako extra-blocks.js).
 * Setup funkcie sa exportujú cez window.__bzReviewBlocks.
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. TEMPLATES
  // =========================================================================

  function ensureTemplate(type, html) {
    if (document.querySelector('[data-block-template="' + type + '"]')) return;
    var tpl = document.createElement('template');
    tpl.setAttribute('data-block-template', type);
    tpl.innerHTML = html.trim();
    document.body.appendChild(tpl);
  }

  // ---- SECTION ----
  ensureTemplate(
    'section',
    '' +
      '<div class="bz-block" data-block-type="section">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-layout-text-window me-1"></i>Sekcia</span>' +
      '<div class="bz-block-actions"></div>' +
      '<div class="mb-2">' +
      '<select class="form-select form-select-sm" data-field="width" style="max-width:180px;">' +
      '<option value="full">Celá šírka</option>' +
      '<option value="half">Polovica (vedľa seba)</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="row g-2 mb-2">' +
      '<div class="col-md-2">' +
      '<label class="form-label form-label-sm mb-0">Layout</label>' +
      '<select class="form-select form-select-sm" data-field="layout">' +
      '<option value="default">Štandardný</option>' +
      '<option value="split">Split (obr vpravo)</option>' +
      '<option value="split-reverse">Split (obr vľavo)</option>' +
      '<option value="grid">Grid</option>' +
      '</select>' +
      '</div>' +
      '<div class="col-md-2">' +
      '<label class="form-label form-label-sm mb-0">Titulok (grid)</label>' +
      '<select class="form-select form-select-sm" data-field="grid_title_side">' +
      '<option value="right">Vpravo</option>' +
      '<option value="left">Vľavo</option>' +
      '</select>' +
      '</div>' +
      '<div class="col-md-3">' +
      '<label class="form-label form-label-sm mb-0">Štýl titulku</label>' +
      '<select class="form-select form-select-sm" data-field="title_style">' +
      '<option value="default">Normálny</option>' +
      '<option value="centered">Centrovaný</option>' +
      '<option value="xl">Veľký (XL)</option>' +
      '<option value="gradient">Gradient</option>' +
      '<option value="accent">Accent</option>' +
      '<option value="numbered">S číslom</option>' +
      '</select>' +
      '</div>' +
      '<div class="col-md-2">' +
      '<label class="form-label form-label-sm mb-0">Štýl média</label>' +
      '<select class="form-select form-select-sm" data-field="media_style">' +
      '<option value="normal">Normálny</option>' +
      '<option value="tilt">Naklonený (3D)</option>' +
      '</select>' +
      '</div>' +
      '<div class="col-md-3 d-flex align-items-end">' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="checkbox" data-field="show_divider" id="">' +
      '<label class="form-check-label small">Oddeľovač pod titulkom</label>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<input type="text" class="form-control form-control-sm mb-2" data-field="number" placeholder="Číslo sekcie (voliteľné, napr. 01)" maxlength="10">' +
      '<input type="text" class="form-control form-control-sm mb-2" data-field="eyebrow" placeholder="Eyebrow (voliteľný, napr. Kapitola 1)" maxlength="120">' +
      '<input type="text" class="form-control form-control-sm mb-2" data-field="title" placeholder="Titulok sekcie (voliteľný)" maxlength="255">' +
      '<textarea class="form-control mb-2" rows="4" data-field="text" placeholder="Text sekcie..."></textarea>' +
      '<div class="row g-2">' +
      '<div class="col-md-4">' +
      '<div data-image-preview class="bz-image-preview">' +
      '<span class="text-muted small">(žiadny obrázok)</span>' +
      '</div>' +
      '</div>' +
      '<div class="col-md-8">' +
      '<div class="input-group input-group-sm mb-2">' +
      '<span class="input-group-text">Media ID</span>' +
      '<input type="number" class="form-control" data-field="media_id" min="1" placeholder="napr. 7">' +
      '<a href="/admin/media" target="_blank" class="btn btn-outline-secondary">' +
      '<i class="bi bi-images"></i>' +
      '</a>' +
      '</div>' +
      '<input type="text" class="form-control form-control-sm mb-2" data-field="video_url" placeholder="YouTube URL (voliteľné — media sa stane videom)" maxlength="500">' +
      '<input type="text" class="form-control form-control-sm" data-field="caption" placeholder="Popis pod médiom (voliteľný)" maxlength="500">' +
      '</div>' +
      '</div>' +
      '</div>'
  );

  // ---- PROS / CONS ----
  ensureTemplate(
    'pros_cons',
    '' +
      '<div class="bz-block" data-block-type="pros_cons">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-hand-thumbs-up me-1"></i>Plusy / Mínusy</span>' +
      '<div class="bz-block-actions"></div>' +
      '<div class="mb-2">' +
      '<select class="form-select form-select-sm" data-field="width" style="max-width:180px;">' +
      '<option value="full">Celá šírka</option>' +
      '<option value="half">Polovica (vedľa seba)</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="row g-3">' +
      '<div class="col-md-6">' +
      '<h6 class="text-success small fw-bold mb-2"><i class="bi bi-plus-circle me-1"></i>Plusy</h6>' +
      '<div data-pros-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-success mt-2" data-pros-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať plus' +
      '</button>' +
      '</div>' +
      '<div class="col-md-6">' +
      '<h6 class="text-danger small fw-bold mb-2"><i class="bi bi-dash-circle me-1"></i>Mínusy</h6>' +
      '<div data-cons-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-danger mt-2" data-cons-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať mínus' +
      '</button>' +
      '</div>' +
      '</div>' +
      '</div>'
  );

  // ---- SPECS ----
  ensureTemplate(
    'specs',
    '' +
      '<div class="bz-block" data-block-type="specs">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-table me-1"></i>Špecifikácie</span>' +
      '<div class="bz-block-actions"></div>' +
      '<div class="mb-2">' +
      '<label class="form-label form-label-sm mb-0">Šírka</label>' +
      '<select class="form-select form-select-sm" data-field="width" style="max-width:160px;">' +
      '<option value="full">Celá šírka</option>' +
      '<option value="half">Polovica</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div data-specs-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-specs-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať riadok' +
      '</button>' +
      '</div>'
  );

  // ---- RATING (celkové hodnotenie — iba verdikt banner) ----
  ensureTemplate(
    'rating',
    '' +
      '<div class="bz-block" data-block-type="rating">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-star-half me-1"></i>Celkové hodnotenie</span>' +
      '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="row g-2 mb-3">' +
      '<div class="col-md-3">' +
      '<label class="form-label form-label-sm mb-0">Celkové skóre</label>' +
      '<input type="number" class="form-control form-control-sm" data-field="total_score" min="0" max="10" step="0.1" placeholder="9.1">' +
      '</div>' +
      '<div class="col-md-3">' +
      '<label class="form-label form-label-sm mb-0">Badge</label>' +
      '<input type="text" class="form-control form-control-sm" data-field="badge" placeholder="napr. Editor\'s Choice" maxlength="100">' +
      '</div>' +
      '<div class="col-md-6">' +
      '<label class="form-label form-label-sm mb-0">Verdikt titulok</label>' +
      '<input type="text" class="form-control form-control-sm" data-field="verdict_title" placeholder="napr. Náš verdikt" maxlength="200">' +
      '</div>' +
      '</div>' +
      '<textarea class="form-control form-control-sm mb-3" rows="2" data-field="verdict_text" placeholder="Text verdiktu (voliteľný)..." maxlength="2000"></textarea>' +
      '</div>'
  );

  // ---- RATING BREAKDOWN (hodnotenie vlastností — iba kritériá) ----
  ensureTemplate(
    'rating_breakdown',
    '' +
      '<div class="bz-block" data-block-type="rating_breakdown">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-bar-chart-line me-1"></i>Hodnotenie vlastností</span>' +
      '<div class="bz-block-actions"></div>' +
      '<div class="mb-2">' +
      '<label class="form-label form-label-sm mb-0">Šírka</label>' +
      '<select class="form-select form-select-sm" data-field="width" style="max-width:160px;">' +
      '<option value="full">Celá šírka</option>' +
      '<option value="half">Polovica</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<h6 class="small fw-bold mb-2">Kritériá hodnotenia</h6>' +
      '<div data-rating-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-rating-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať kritérium' +
      '</button>' +
      '</div>'
  );

  // ---- COLOR VARIANTS ----
  ensureTemplate(
    'color_variants',
    '' +
      '<div class="bz-block" data-block-type="color_variants">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-palette me-1"></i>Farebné varianty</span>' +
      '<div class="bz-block-actions"></div>' +
      '<div class="mb-2">' +
      '<select class="form-select form-select-sm" data-field="width" style="max-width:180px;">' +
      '<option value="full">Celá šírka</option>' +
      '<option value="half">Polovica (vedľa seba)</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div data-variants-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-variants-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať variant' +
      '</button>' +
      '</div>'
  );

  // ---- REVIEW BANNER ----
  ensureTemplate(
    'review_banner',
    '' +
      '<div class="bz-block" data-block-type="review_banner">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-card-heading me-1"></i>Review Banner</span>' +
      '<div class="bz-block-actions"></div>' +
      '<div class="mb-2">' +
      '<select class="form-select form-select-sm" data-field="width" style="max-width:180px;">' +
      '<option value="full">Celá šírka</option>' +
      '<option value="half">Polovica (vedľa seba)</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="row g-2 mb-2">' +
      '<div class="col-md-6">' +
      '<input type="text" class="form-control form-control-sm" data-field="title" placeholder="Titulok bannera" maxlength="200">' +
      '</div>' +
      '<div class="col-md-6">' +
      '<input type="text" class="form-control form-control-sm" data-field="subtitle" placeholder="Podtitulok" maxlength="200">' +
      '</div>' +
      '</div>' +
      '<div class="row g-2 mb-3">' +
      '<div class="col-md-3">' +
      '<div class="input-group input-group-sm">' +
      '<span class="input-group-text">BG Media</span>' +
      '<input type="number" class="form-control" data-field="background_media_id" min="1" placeholder="ID">' +
      '</div>' +
      '</div>' +
      '<div class="col-md-9">' +
      '<div data-banner-bg-preview class="bz-image-preview" style="min-height:60px;">' +
      '<span class="text-muted small">(žiadne pozadie)</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<h6 class="small fw-bold mb-2">Slider obrázky</h6>' +
      '<div data-slider-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-slider-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať slide' +
      '</button>' +
      '<h6 class="small fw-bold mb-2 mt-3">Tlačidlá</h6>' +
      '<div data-buttons-items class="bz-nested-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-buttons-add>' +
      '<i class="bi bi-plus-lg me-1"></i>Pridať tlačidlo' +
      '</button>' +
      '</div>'
  );

  // =========================================================================
  // 2. TOOLBAR BUTTONS
  // =========================================================================

  function addToolbarButton(type, iconClass, label) {
    if (document.querySelector('[data-add-block="' + type + '"]')) return;
    var existing = document.querySelector('[data-add-block]');
    if (!existing || !existing.parentNode) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-primary';
    btn.setAttribute('data-add-block', type);
    btn.innerHTML = '<i class="bi ' + iconClass + ' me-1"></i>' + label;
    existing.parentNode.appendChild(btn);
  }

  addToolbarButton('section', 'bi-layout-text-window', 'Sekcia');
  addToolbarButton('pros_cons', 'bi-hand-thumbs-up', 'Plusy/Mínusy');
  addToolbarButton('specs', 'bi-table', 'Špecifikácie');
  addToolbarButton('rating', 'bi-star-half', 'Celk. hodnotenie');
  addToolbarButton('rating_breakdown', 'bi-bar-chart-line', 'Hodn. vlastností');
  addToolbarButton('color_variants', 'bi-palette', 'Farby');
  addToolbarButton('review_banner', 'bi-card-heading', 'Banner');

  // =========================================================================
  // 3. SETUP FUNCTIONS (called by editor after DOM insert)
  // =========================================================================

  /**
   * Helper: vráti aktuálny index bloku v container-i.
   * Závisí na tom, že editor nastaví data-blocks-container.
   */
  function currentIndex(node) {
    var container = document.querySelector('[data-blocks-container]');
    if (!container) return -1;
    return Array.prototype.indexOf.call(container.children, node);
  }

  /**
   * Helper: získa blocks pole z hidden inputu.
   */
  function getBlocks() {
    var inp = document.querySelector('[data-content-json]');
    if (!inp) return [];
    try {
      return JSON.parse(inp.value || '[]');
    } catch (e) {
      return [];
    }
  }

  function syncHidden() {
    var inp = document.querySelector('[data-content-json]');
    if (!inp) return;
    inp.value = JSON.stringify(getBlocks());
    // Trigger emptyState update
    var container = document.querySelector('[data-blocks-container]');
    var emptyState = document.querySelector('[data-empty-state]');
    if (emptyState && container) {
      emptyState.style.display = container.children.length === 0 ? '' : 'none';
    }
  }

  /**
   * Helper: získa blocks referenčne (priamo z editora).
   * Editor uloží ref na window.__bzEditorBlocks pri inicializácii.
   */
  function getBlocksRef() {
    return window.__bzEditorBlocks;
  }

  function syncFromRef() {
    var blocks = getBlocksRef();
    if (!blocks) return;
    var inp = document.querySelector('[data-content-json]');
    if (inp) inp.value = JSON.stringify(blocks);
  }

  // ---- HELPER: generic nested text list ----
  function setupTextList(node, containerSel, addBtnSel, blockKey, placeholder, btnVariant) {
    var listEl = node.querySelector(containerSel);
    var addBtn = node.querySelector(addBtnSel);
    if (!listEl || !addBtn) return;

    function renderItems() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var blocks = getBlocksRef();
      if (!blocks || !blocks[ci]) return;
      var items = blocks[ci][blockKey] || [];
      listEl.innerHTML = '';
      items.forEach(function (val, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" value="' +
          escAttr(val) +
          '" placeholder="' +
          placeholder +
          '" maxlength="500">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
        var input = row.querySelector('input');
        input.addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2][blockKey][i] = input.value;
          syncFromRef();
        });
        row.querySelector('button').addEventListener('click', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2][blockKey].splice(i, 1);
          syncFromRef();
          renderItems();
        });
        listEl.appendChild(row);
      });
    }

    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!b[ci][blockKey]) b[ci][blockKey] = [];
      b[ci][blockKey].push('');
      syncFromRef();
      renderItems();
    });

    renderItems();
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---- SECTION setup ----
  function setupSection(node) {
    // Section uses data-field bindings from the main editor for simple fields.
    // checkbox show_divider needs special handling:
    var cb = node.querySelector('[data-field="show_divider"]');
    if (cb) {
      var ci = currentIndex(node);
      var b = getBlocksRef();
      if (b && b[ci]) cb.checked = !!b[ci].show_divider;
      cb.addEventListener('change', function () {
        var ci2 = currentIndex(node);
        if (ci2 === -1) return;
        var b2 = getBlocksRef();
        if (!b2 || !b2[ci2]) return;
        b2[ci2].show_divider = cb.checked;
        syncFromRef();
      });
    }
  }

  // ---- PROS/CONS setup ----
  function setupProsCons(node) {
    setupTextList(node, '[data-pros-items]', '[data-pros-add]', 'pros', 'Výhoda...', 'success');
    setupTextList(node, '[data-cons-items]', '[data-cons-add]', 'cons', 'Nevýhoda...', 'danger');
  }

  // ---- SPECS setup ----
  function setupSpecs(node) {
    var listEl = node.querySelector('[data-specs-items]');
    var addBtn = node.querySelector('[data-specs-add]');
    if (!listEl || !addBtn) return;

    function renderItems() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var blocks = getBlocksRef();
      if (!blocks || !blocks[ci]) return;
      var rows = blocks[ci].rows || [];
      listEl.innerHTML = '';
      rows.forEach(function (row, i) {
        var el = document.createElement('div');
        el.className = 'bz-nested-row';
        el.innerHTML =
          '<input type="text" class="form-control form-control-sm" data-k value="' +
          escAttr(row.key) +
          '" placeholder="Názov (napr. RAM)" maxlength="200" style="flex:1;">' +
          '<input type="text" class="form-control form-control-sm" data-v value="' +
          escAttr(row.value) +
          '" placeholder="Hodnota (napr. 8 GB)" maxlength="500" style="flex:1.5;">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
        el.querySelector('[data-k]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].rows[i].key = this.value;
          syncFromRef();
        });
        el.querySelector('[data-v]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].rows[i].value = this.value;
          syncFromRef();
        });
        el.querySelector('button').addEventListener('click', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].rows.splice(i, 1);
          syncFromRef();
          renderItems();
        });
        listEl.appendChild(el);
      });
    }

    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!b[ci].rows) b[ci].rows = [];
      b[ci].rows.push({ key: '', value: '' });
      syncFromRef();
      renderItems();
    });

    renderItems();
  }

  // ---- RATING setup (iba simple fields, žiadne nested items) ----
  function setupRating(node) {
    // Všetky polia sú data-field — spracováva ich hlavný editor automaticky.
  }

  // ---- RATING BREAKDOWN setup ----
  function setupRatingBreakdown(node) {
    var listEl = node.querySelector('[data-rating-items]');
    var addBtn = node.querySelector('[data-rating-add]');
    if (!listEl || !addBtn) return;

    function renderItems() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var blocks = getBlocksRef();
      if (!blocks || !blocks[ci]) return;
      var criteria = blocks[ci].criteria || [];
      listEl.innerHTML = '';
      criteria.forEach(function (c, i) {
        var el = document.createElement('div');
        el.className = 'bz-nested-row';
        el.innerHTML =
          '<input type="text" class="form-control form-control-sm" data-n value="' +
          escAttr(c.name) +
          '" placeholder="Názov (napr. Displej)" maxlength="200" style="flex:1.5;">' +
          '<input type="number" class="form-control form-control-sm" data-s value="' +
          (c.score || 0) +
          '" min="0" max="10" step="0.1" placeholder="8.5" style="flex:0.5; min-width:80px;">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
        el.querySelector('[data-n]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].criteria[i].name = this.value;
          syncFromRef();
        });
        el.querySelector('[data-s]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].criteria[i].score = parseFloat(this.value) || 0;
          syncFromRef();
        });
        el.querySelector('button').addEventListener('click', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].criteria.splice(i, 1);
          syncFromRef();
          renderItems();
        });
        listEl.appendChild(el);
      });
    }

    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!b[ci].criteria) b[ci].criteria = [];
      b[ci].criteria.push({ name: '', score: 0 });
      syncFromRef();
      renderItems();
    });

    renderItems();
  }

  // ---- COLOR VARIANTS setup ----
  function setupColorVariants(node) {
    var listEl = node.querySelector('[data-variants-items]');
    var addBtn = node.querySelector('[data-variants-add]');
    if (!listEl || !addBtn) return;

    function renderItems() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var blocks = getBlocksRef();
      if (!blocks || !blocks[ci]) return;
      var variants = blocks[ci].variants || [];
      listEl.innerHTML = '';
      variants.forEach(function (v, i) {
        var el = document.createElement('div');
        el.className = 'bz-nested-row';
        el.innerHTML =
          '<input type="text" class="form-control form-control-sm" data-vn value="' +
          escAttr(v.name) +
          '" placeholder="Názov" maxlength="100" style="flex:1;">' +
          '<input type="color" class="form-control form-control-sm form-control-color" data-vh value="' +
          escAttr(v.hex || '#000000') +
          '" style="flex:0 0 40px; padding:2px;">' +
          '<input type="text" class="form-control form-control-sm" data-vc value="' +
          escAttr(v.code || '') +
          '" placeholder="Kód (napr. Sage Green)" maxlength="50" style="flex:0.8;">' +
          '<input type="text" class="form-control form-control-sm" data-vt value="' +
          escAttr(v.note || '') +
          '" placeholder="Poznámka" maxlength="100" style="flex:0.8;">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
        el.querySelector('[data-vn]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].variants[i].name = this.value;
          syncFromRef();
        });
        el.querySelector('[data-vc]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].variants[i].code = this.value;
          syncFromRef();
        });
        el.querySelector('[data-vt]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].variants[i].note = this.value;
          syncFromRef();
        });
        el.querySelector('[data-vh]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].variants[i].hex = this.value;
          syncFromRef();
        });
        el.querySelector('[data-vm]').addEventListener('input', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          var n = Number(this.value);
          b[ci2].variants[i].media_id = Number.isInteger(n) && n > 0 ? n : null;
          syncFromRef();
        });
        el.querySelector('button').addEventListener('click', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          var b = getBlocksRef();
          if (!b || !b[ci2]) return;
          b[ci2].variants.splice(i, 1);
          syncFromRef();
          renderItems();
        });
        listEl.appendChild(el);
      });
    }

    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!b[ci].variants) b[ci].variants = [];
      b[ci].variants.push({ name: '', hex: '#000000', media_id: null });
      syncFromRef();
      renderItems();
    });

    renderItems();
  }

  // ---- REVIEW BANNER setup ----
  function setupReviewBanner(node) {
    // Background preview
    var bgInput = node.querySelector('[data-field="background_media_id"]');
    var bgPreview = node.querySelector('[data-banner-bg-preview]');
    if (bgInput && bgPreview) {
      var ci0 = currentIndex(node);
      var b0 = getBlocksRef();
      if (b0 && b0[ci0] && b0[ci0].background_media_id) {
        updatePreviewEl(bgPreview, b0[ci0].background_media_id);
      }
      bgInput.addEventListener('input', function () {
        var ci2 = currentIndex(node);
        if (ci2 === -1) return;
        var b = getBlocksRef();
        if (!b || !b[ci2]) return;
        var n = Number(bgInput.value);
        b[ci2].background_media_id = Number.isInteger(n) && n > 0 ? n : null;
        updatePreviewEl(bgPreview, b[ci2].background_media_id);
        syncFromRef();
      });
    }

    // Slider media IDs
    var sliderEl = node.querySelector('[data-slider-items]');
    var sliderAdd = node.querySelector('[data-slider-add]');
    if (sliderEl && sliderAdd) {
      function renderSlider() {
        var ci = currentIndex(node);
        if (ci === -1) return;
        var blocks = getBlocksRef();
        if (!blocks || !blocks[ci]) return;
        var ids = blocks[ci].slider_media_ids || [];
        sliderEl.innerHTML = '';
        ids.forEach(function (mid, i) {
          var el = document.createElement('div');
          el.className = 'bz-nested-row';
          el.innerHTML =
            '<div class="input-group input-group-sm" style="flex:1;">' +
            '<span class="input-group-text">Media ID</span>' +
            '<input type="number" class="form-control" value="' +
            (mid || '') +
            '" min="1" placeholder="ID">' +
            '</div>' +
            '<button type="button" class="btn btn-sm btn-outline-danger" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
          el.querySelector('input').addEventListener('input', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            var b = getBlocksRef();
            if (!b || !b[ci2]) return;
            var n = Number(this.value);
            b[ci2].slider_media_ids[i] = Number.isInteger(n) && n > 0 ? n : null;
            syncFromRef();
          });
          el.querySelector('button').addEventListener('click', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            var b = getBlocksRef();
            if (!b || !b[ci2]) return;
            b[ci2].slider_media_ids.splice(i, 1);
            syncFromRef();
            renderSlider();
          });
          sliderEl.appendChild(el);
        });
      }
      sliderAdd.addEventListener('click', function () {
        var ci = currentIndex(node);
        if (ci === -1) return;
        var b = getBlocksRef();
        if (!b || !b[ci]) return;
        if (!b[ci].slider_media_ids) b[ci].slider_media_ids = [];
        b[ci].slider_media_ids.push(null);
        syncFromRef();
        renderSlider();
      });
      renderSlider();
    }

    // Buttons
    var btnsEl = node.querySelector('[data-buttons-items]');
    var btnsAdd = node.querySelector('[data-buttons-add]');
    if (btnsEl && btnsAdd) {
      function renderButtons() {
        var ci = currentIndex(node);
        if (ci === -1) return;
        var blocks = getBlocksRef();
        if (!blocks || !blocks[ci]) return;
        var buttons = blocks[ci].buttons || [];
        btnsEl.innerHTML = '';
        buttons.forEach(function (btn, i) {
          var el = document.createElement('div');
          el.className = 'bz-nested-row';
          el.innerHTML =
            '<input type="text" class="form-control form-control-sm" data-bl value="' +
            escAttr(btn.label) +
            '" placeholder="Label" maxlength="100" style="flex:1;">' +
            '<input type="text" class="form-control form-control-sm" data-ba value="' +
            escAttr(btn.anchor) +
            '" placeholder="#anchor" maxlength="200" style="flex:1;">' +
            '<select class="form-select form-select-sm" data-bs style="flex:0 0 100px;">' +
            '<option value="primary"' +
            (btn.style === 'primary' ? ' selected' : '') +
            '>Primary</option>' +
            '<option value="secondary"' +
            (btn.style === 'secondary' ? ' selected' : '') +
            '>Secondary</option>' +
            '<option value="ghost"' +
            (btn.style === 'ghost' ? ' selected' : '') +
            '>Ghost</option>' +
            '</select>' +
            '<button type="button" class="btn btn-sm btn-outline-danger" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
          el.querySelector('[data-bl]').addEventListener('input', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            var b2 = getBlocksRef();
            if (!b2 || !b2[ci2]) return;
            b2[ci2].buttons[i].label = this.value;
            syncFromRef();
          });
          el.querySelector('[data-ba]').addEventListener('input', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            var b2 = getBlocksRef();
            if (!b2 || !b2[ci2]) return;
            b2[ci2].buttons[i].anchor = this.value;
            syncFromRef();
          });
          el.querySelector('[data-bs]').addEventListener('change', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            var b2 = getBlocksRef();
            if (!b2 || !b2[ci2]) return;
            b2[ci2].buttons[i].style = this.value;
            syncFromRef();
          });
          el.querySelector('button:last-child').addEventListener('click', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            var b2 = getBlocksRef();
            if (!b2 || !b2[ci2]) return;
            b2[ci2].buttons.splice(i, 1);
            syncFromRef();
            renderButtons();
          });
          btnsEl.appendChild(el);
        });
      }
      btnsAdd.addEventListener('click', function () {
        var ci = currentIndex(node);
        if (ci === -1) return;
        var b = getBlocksRef();
        if (!b || !b[ci]) return;
        if (!b[ci].buttons) b[ci].buttons = [];
        b[ci].buttons.push({ label: '', anchor: '', style: 'primary' });
        syncFromRef();
        renderButtons();
      });
      renderButtons();
    }
  }

  // Thumbnail preview helper (reuses editor's fetchMediaThumb if available)
  function updatePreviewEl(el, mediaId) {
    if (!el) return;
    if (!mediaId) {
      el.innerHTML = '<span class="text-muted small">(žiadny)</span>';
      return;
    }
    el.innerHTML = '<span class="text-muted small">načítavam…</span>';
    fetch('/admin/articles/media-thumb/' + mediaId, { credentials: 'same-origin' })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (data && data.thumbnail_path) {
          el.innerHTML =
            '<img src="/uploads/' +
            data.thumbnail_path +
            '" class="img-fluid rounded" alt="" style="max-height:80px;">';
        } else {
          el.innerHTML = '<span class="text-danger small">ID neexistuje</span>';
        }
      })
      .catch(function () {
        el.innerHTML = '<span class="text-warning small">(chyba)</span>';
      });
  }

  // =========================================================================
  // 4. EXPORT setup functions for editor
  // =========================================================================

  window.__bzReviewBlocks = {
    setup: function (node, type) {
      switch (type) {
        case 'section':
          setupSection(node);
          break;
        case 'pros_cons':
          setupProsCons(node);
          break;
        case 'specs':
          setupSpecs(node);
          break;
        case 'rating':
          setupRating(node);
          break;
        case 'rating_breakdown':
          setupRatingBreakdown(node);
          break;
        case 'color_variants':
          setupColorVariants(node);
          break;
        case 'review_banner':
          setupReviewBanner(node);
          break;
      }
    },
  };
})();
