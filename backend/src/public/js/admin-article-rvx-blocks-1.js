/**
 * RVX blocks — Balík 1
 *
 * Bloky:
 *   - rvx_glance      (V skratke — karty: ikona + nadpis + text)
 *   - rvx_keyspecs    (Kľúčové parametre — číslo + label)
 *   - rvx_quickstrip  (Rýchly verdikt — label + hodnota + štýl)
 *   - rvx_connect     (Konektivita — chips)
 *
 * Beží PRED admin-article-editor.js. Setup cez window.__bzRvxBlocks1.
 */

(function () {
  'use strict';

  var ICON_OPTIONS = [
    'check',
    'flame',
    'rocket',
    'clock',
    'star',
    'user',
    'image',
    'tag',
    'article',
    'close',
    'trending',
    'moon',
    'search',
    'edit',
    'category',
  ];

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

  // ---- rvx_glance ----
  ensureTemplate(
    'rvx_glance',
    '<div class="bz-block" data-block-type="rvx_glance">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-grid-3x3-gap me-1"></i>V skratke (karty)</span>' +
      '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="row g-2 mb-2">' +
      '<div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow (napr. V skratke)"></div>' +
      '<div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis sekcie"></div>' +
      '</div>' +
      '<div data-rvx-items></div>' +
      '<button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať kartu</button>' +
      '</div>'
  );

  // ---- rvx_keyspecs ----
  ensureTemplate(
    'rvx_keyspecs',
    '<div class="bz-block" data-block-type="rvx_keyspecs">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-123 me-1"></i>Kľúčové parametre</span>' +
      '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="row g-2 mb-2">' +
      '<div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div>' +
      '<div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis sekcie"></div>' +
      '</div>' +
      '<div data-rvx-items></div>' +
      '<button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať parameter</button>' +
      '</div>'
  );

  // ---- rvx_quickstrip ----
  ensureTemplate(
    'rvx_quickstrip',
    '<div class="bz-block" data-block-type="rvx_quickstrip">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-card-list me-1"></i>Rýchly verdikt (strip)</span>' +
      '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div data-rvx-items></div>' +
      '<button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať položku</button>' +
      '</div>'
  );

  // ---- rvx_connect ----
  ensureTemplate(
    'rvx_connect',
    '<div class="bz-block" data-block-type="rvx_connect">' +
      '<div class="bz-block-header">' +
      '<span class="bz-block-label"><i class="bi bi-broadcast me-1"></i>Konektivita (chips)</span>' +
      '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="row g-2 mb-2">' +
      '<div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div>' +
      '<div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis sekcie"></div>' +
      '</div>' +
      '<div data-rvx-items></div>' +
      '<button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať chip</button>' +
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
    btn.className = 'bz-art-btn bz-art-btn-sm';
    btn.setAttribute('data-add-block', type);
    btn.innerHTML = '<i class="bi ' + iconClass + ' me-1"></i>' + label;
    existing.parentNode.appendChild(btn);
  }

  addToolbarButton('rvx_glance', 'bi-grid-3x3-gap', 'V skratke');
  addToolbarButton('rvx_keyspecs', 'bi-123', 'Parametre');
  addToolbarButton('rvx_quickstrip', 'bi-card-list', 'Rýchly verdikt');
  addToolbarButton('rvx_connect', 'bi-broadcast', 'Konektivita');

  // =========================================================================
  // 3. HELPERS
  // =========================================================================
  function getBlocksRef() {
    return window.__bzEditorBlocks;
  }
  function syncFromRef() {
    var blocks = getBlocksRef();
    if (!blocks) return;
    var inp = document.querySelector('[data-content-json]');
    if (inp) inp.value = JSON.stringify(blocks);
  }
  function currentIndex(node) {
    var all = Array.prototype.slice.call(
      document.querySelectorAll('[data-blocks-container] > [data-block-type]')
    );
    return all.indexOf(node);
  }
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  // Bind eyebrow/title text fields
  function bindMeta(node) {
    node.querySelectorAll('[data-field]').forEach(function (inp) {
      var field = inp.getAttribute('data-field');
      var ci = currentIndex(node);
      var b = getBlocksRef();
      if (b && b[ci] && b[ci][field] != null) inp.value = b[ci][field];
      inp.addEventListener('input', function () {
        var idx = currentIndex(node);
        var bl = getBlocksRef();
        if (bl && bl[idx]) {
          bl[idx][field] = inp.value;
          syncFromRef();
        }
      });
    });
  }

  // =========================================================================
  // 4. SETUP per block type
  // =========================================================================

  // ---- rvx_glance: items [{icon, title, text}] ----
  function setupGlance(node) {
    bindMeta(node);
    var listEl = node.querySelector('[data-rvx-items]');
    var addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl || !addBtn) return;

    function render() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      var items = b[ci].items;
      listEl.innerHTML = '';
      items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'flex-wrap:wrap;gap:6px;margin-bottom:8px;';
        var iconOpts = ICON_OPTIONS.map(function (ic) {
          return (
            '<option value="' +
            ic +
            '"' +
            (it.icon === ic ? ' selected' : '') +
            '>' +
            ic +
            '</option>'
          );
        }).join('');
        row.innerHTML =
          '<select class="form-select form-select-sm" data-i="icon" style="max-width:130px">' +
          iconOpts +
          '</select>' +
          '<input type="text" class="form-control form-control-sm" data-i="title" value="' +
          escAttr(it.title) +
          '" placeholder="Nadpis" style="flex:1;min-width:140px">' +
          '<input type="text" class="form-control form-control-sm" data-i="text" value="' +
          escAttr(it.text) +
          '" placeholder="Popis" style="flex:2;min-width:180px">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-i="del"><i class="bi bi-x-lg"></i></button>';
        row.querySelectorAll('[data-i]').forEach(function (el) {
          var key = el.getAttribute('data-i');
          if (key === 'del') {
            el.addEventListener('click', function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items.splice(i, 1);
                syncFromRef();
                render();
              }
            });
          } else {
            el.addEventListener('input', function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items[i][key] = el.value;
                syncFromRef();
              }
            });
            el.addEventListener('change', function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items[i][key] = el.value;
                syncFromRef();
              }
            });
          }
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      b[ci].items.push({ icon: 'check', title: '', text: '' });
      syncFromRef();
      render();
    });
    render();
  }

  // ---- rvx_keyspecs: items [{num, label}] ----
  function setupKeyspecs(node) {
    bindMeta(node);
    var listEl = node.querySelector('[data-rvx-items]');
    var addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl || !addBtn) return;

    function render() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      listEl.innerHTML = '';
      b[ci].items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'gap:6px;margin-bottom:8px;';
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" data-i="num" value="' +
          escAttr(it.num) +
          '" placeholder="Hodnota (napr. 50 MPx)" style="flex:1">' +
          '<input type="text" class="form-control form-control-sm" data-i="label" value="' +
          escAttr(it.label) +
          '" placeholder="Popis (napr. hlavná kamera)" style="flex:1">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-i="del"><i class="bi bi-x-lg"></i></button>';
        row.querySelectorAll('[data-i]').forEach(function (el) {
          var key = el.getAttribute('data-i');
          if (key === 'del') {
            el.addEventListener('click', function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items.splice(i, 1);
                syncFromRef();
                render();
              }
            });
          } else {
            el.addEventListener('input', function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items[i][key] = el.value;
                syncFromRef();
              }
            });
          }
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      b[ci].items.push({ num: '', label: '' });
      syncFromRef();
      render();
    });
    render();
  }

  // ---- rvx_quickstrip: items [{label, value, style}] ----
  function setupQuickstrip(node) {
    var listEl = node.querySelector('[data-rvx-items]');
    var addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl || !addBtn) return;

    function render() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      listEl.innerHTML = '';
      b[ci].items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'gap:6px;margin-bottom:8px;';
        var styleOpts = [
          { v: '', l: 'Normálny' },
          { v: 'good', l: 'Dobrý (zelený)' },
          { v: 'great', l: 'Výborný (accent)' },
          { v: 'bad', l: 'Zlý (červený)' },
        ]
          .map(function (o) {
            return (
              '<option value="' +
              o.v +
              '"' +
              (it.style === o.v ? ' selected' : '') +
              '>' +
              o.l +
              '</option>'
            );
          })
          .join('');
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" data-i="label" value="' +
          escAttr(it.label) +
          '" placeholder="Label (napr. Cena)" style="flex:1">' +
          '<input type="text" class="form-control form-control-sm" data-i="value" value="' +
          escAttr(it.value) +
          '" placeholder="Hodnota (napr. 1099 €)" style="flex:1">' +
          '<select class="form-select form-select-sm" data-i="style" style="max-width:150px">' +
          styleOpts +
          '</select>' +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-i="del"><i class="bi bi-x-lg"></i></button>';
        row.querySelectorAll('[data-i]').forEach(function (el) {
          var key = el.getAttribute('data-i');
          if (key === 'del') {
            el.addEventListener('click', function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items.splice(i, 1);
                syncFromRef();
                render();
              }
            });
          } else {
            var ev = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(ev, function () {
              var idx = currentIndex(node);
              var bl = getBlocksRef();
              if (bl && bl[idx]) {
                bl[idx].items[i][key] = el.value;
                syncFromRef();
              }
            });
          }
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      b[ci].items.push({ label: '', value: '', style: '' });
      syncFromRef();
      render();
    });
    render();
  }

  // ---- rvx_connect: items [string] ----
  function setupConnect(node) {
    bindMeta(node);
    var listEl = node.querySelector('[data-rvx-items]');
    var addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl || !addBtn) return;

    function render() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      listEl.innerHTML = '';
      b[ci].items.forEach(function (val, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'gap:6px;margin-bottom:8px;';
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" value="' +
          escAttr(val) +
          '" placeholder="Napr. Wi-Fi 7" style="flex:1">' +
          '<button type="button" class="btn btn-sm btn-outline-danger" data-i="del"><i class="bi bi-x-lg"></i></button>';
        row.querySelector('input').addEventListener('input', function () {
          var idx = currentIndex(node);
          var bl = getBlocksRef();
          if (bl && bl[idx]) {
            bl[idx].items[i] = this.value;
            syncFromRef();
          }
        });
        row.querySelector('[data-i="del"]').addEventListener('click', function () {
          var idx = currentIndex(node);
          var bl = getBlocksRef();
          if (bl && bl[idx]) {
            bl[idx].items.splice(i, 1);
            syncFromRef();
            render();
          }
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function () {
      var ci = currentIndex(node);
      var b = getBlocksRef();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      b[ci].items.push('');
      syncFromRef();
      render();
    });
    render();
  }

  // =========================================================================
  // 5. EXPORT
  // =========================================================================
  window.__bzRvxBlocks1 = {
    setup: function (node, type) {
      switch (type) {
        case 'rvx_glance':
          setupGlance(node);
          break;
        case 'rvx_keyspecs':
          setupKeyspecs(node);
          break;
        case 'rvx_quickstrip':
          setupQuickstrip(node);
          break;
        case 'rvx_connect':
          setupConnect(node);
          break;
      }
    },
  };
})();
