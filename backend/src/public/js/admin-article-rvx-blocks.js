/**
 * RVX blocks — kompletný editor pre všetky review sekcie
 * Setup cez window.__bzRvxBlocks
 */
(function () {
  'use strict';
  var ICONS = [
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

  function T(type, html) {
    if (document.querySelector('[data-block-template="' + type + '"]')) return;
    var t = document.createElement('template');
    t.setAttribute('data-block-template', type);
    t.innerHTML = html.trim();
    document.body.appendChild(t);
  }
  function AB(type, ic, label) {
    if (document.querySelector('[data-add-block="' + type + '"]')) return;
    var e = document.querySelector('[data-add-block]');
    if (!e || !e.parentNode) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'bz-art-btn bz-art-btn-sm';
    b.setAttribute('data-add-block', type);
    b.innerHTML = '<i class="bi ' + ic + ' me-1"></i>' + label;
    e.parentNode.appendChild(b);
  }
  function BR() {
    return window.__bzEditorBlocks;
  }
  function SY() {
    var b = BR();
    if (!b) return;
    var i = document.querySelector('[data-content-json]');
    if (i) i.value = JSON.stringify(b);
  }
  function CI(n) {
    return Array.prototype.slice
      .call(document.querySelectorAll('[data-blocks-container]>[data-block-type]'))
      .indexOf(n);
  }
  function EA(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  // Generic block template with eyebrow+title+items
  function GT(type, label, ic) {
    return (
      '<div class="bz-block" data-block-type="' +
      type +
      '"><div class="bz-block-header"><span class="bz-block-label"><i class="bi ' +
      ic +
      ' me-1"></i>' +
      label +
      '</span><div class="bz-block-actions"></div></div><div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis sekcie"></div></div><div data-rvx-items></div><button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať</button></div>'
    );
  }
  // Simple block (no items, just text fields)
  function GS(type, label, ic, inner) {
    return (
      '<div class="bz-block" data-block-type="' +
      type +
      '"><div class="bz-block-header"><span class="bz-block-label"><i class="bi ' +
      ic +
      ' me-1"></i>' +
      label +
      '</span><div class="bz-block-actions"></div></div>' +
      inner +
      '</div>'
    );
  }

  function bindMeta(n) {
    n.querySelectorAll('[data-field]').forEach(function (inp) {
      var f = inp.getAttribute('data-field'),
        c = CI(n),
        b = BR();
      if (b && b[c] && b[c][f] != null) inp.value = b[c][f];
      inp.addEventListener('input', function () {
        var i = CI(n),
          bl = BR();
        if (bl && bl[i]) {
          bl[i][f] = inp.value;
          SY();
        }
      });
    });
  }

  // Generic list setup for items [{field1,field2,...}]
  function setupItems(node, fields, emptyItem, opts) {
    bindMeta(node);
    var listEl = node.querySelector('[data-rvx-items]'),
      addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl || !addBtn) return;
    function render() {
      var ci = CI(node);
      if (ci === -1) return;
      var b = BR();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      listEl.innerHTML = '';
      b[ci].items.forEach(function (it, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'flex-wrap:wrap;gap:6px;margin-bottom:8px;';
        var html = '';
        fields.forEach(function (f) {
          if (f.type === 'select') {
            var opts = f.options
              .map(function (o) {
                return (
                  '<option value="' +
                  o.v +
                  '"' +
                  (it[f.key] === o.v ? ' selected' : '') +
                  '>' +
                  o.l +
                  '</option>'
                );
              })
              .join('');
            html +=
              '<select class="form-select form-select-sm" data-i="' +
              f.key +
              '" style="' +
              (f.style || 'max-width:150px') +
              '">' +
              opts +
              '</select>';
          } else if (f.type === 'icon') {
            var opts2 = ICONS.map(function (ic) {
              return (
                '<option value="' +
                ic +
                '"' +
                (it[f.key] === ic ? ' selected' : '') +
                '>' +
                ic +
                '</option>'
              );
            }).join('');
            html +=
              '<select class="form-select form-select-sm" data-i="' +
              f.key +
              '" style="max-width:130px">' +
              opts2 +
              '</select>';
          } else if (f.type === 'textarea') {
            html +=
              '<textarea class="form-control form-control-sm" data-i="' +
              f.key +
              '" placeholder="' +
              EA(f.ph || '') +
              '" style="' +
              (f.style || 'flex:1;min-width:150px') +
              '" rows="2">' +
              EA(it[f.key] || '') +
              '</textarea>';
          } else if (f.type === 'number') {
            html +=
              '<input type="number" class="form-control form-control-sm" data-i="' +
              f.key +
              '" value="' +
              (it[f.key] || 0) +
              '" placeholder="' +
              EA(f.ph || '') +
              '" style="' +
              (f.style || 'max-width:80px') +
              '" step="any">';
          } else {
            html +=
              '<input type="text" class="form-control form-control-sm" data-i="' +
              f.key +
              '" value="' +
              EA(it[f.key] || '') +
              '" placeholder="' +
              EA(f.ph || '') +
              '" style="' +
              (f.style || 'flex:1;min-width:120px') +
              '">';
          }
        });
        html +=
          '<button type="button" class="btn btn-sm btn-outline-danger" data-i="del"><i class="bi bi-x-lg"></i></button>';
        row.innerHTML = html;
        row.querySelectorAll('[data-i]').forEach(function (el) {
          var key = el.getAttribute('data-i');
          if (key === 'del') {
            el.addEventListener('click', function () {
              var idx = CI(node),
                bl = BR();
              if (bl && bl[idx]) {
                bl[idx].items.splice(i, 1);
                SY();
                render();
              }
            });
          } else {
            var ev = el.tagName === 'SELECT' ? 'change' : 'input';
            el.addEventListener(ev, function () {
              var idx = CI(node),
                bl = BR();
              if (bl && bl[idx]) {
                if (el.type === 'number') bl[idx].items[i][key] = Number(el.value);
                else bl[idx].items[i][key] = el.value;
                SY();
              }
            });
          }
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function () {
      var ci = CI(node),
        b = BR();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      b[ci].items.push(JSON.parse(JSON.stringify(emptyItem)));
      SY();
      render();
    });

    // Media upload / multi-pick (len ak blok má media pole)
    if (opts && opts.mediaKey) {
      setupItemsMedia(node, emptyItem, opts.mediaKey, addBtn, render);
    }

    render();
  }

  // Pridá tlačidlá "Nahrať viac" a "Pridať viac" k blokom s media poľom
  function setupItemsMedia(node, emptyItem, mediaKey, addBtn, render) {
    if (node.querySelector('[data-rvx-media-bar]')) return; // už pridané

    var bar = document.createElement('div');
    bar.setAttribute('data-rvx-media-bar', '');
    bar.className = 'd-flex gap-2 mt-2';
    bar.innerHTML =
      '<button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-upload>' +
      '<i class="bi bi-upload"></i> Nahrať viac</button>' +
      '<button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-pick-multi>' +
      '<i class="bi bi-images"></i> Pridať viac</button>' +
      '<input type="file" accept="image/*" multiple data-rvx-file class="d-none">' +
      '<span class="text-muted small align-self-center" data-rvx-upload-status></span>';
    // vlož za "Pridať" tlačidlo
    addBtn.parentNode.insertBefore(bar, addBtn.nextSibling);

    var fileInput = bar.querySelector('[data-rvx-file]');
    var statusEl = bar.querySelector('[data-rvx-upload-status]');

    function addMediaItems(ids) {
      var ci = CI(node),
        b = BR();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].items)) b[ci].items = [];
      ids.forEach(function (id) {
        var item = JSON.parse(JSON.stringify(emptyItem));
        item[mediaKey] = id;
        b[ci].items.push(item);
      });
      SY();
      render();
    }

    bar.querySelector('[data-rvx-upload]').addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      var files = fileInput.files;
      if (!files || !files.length) return;
      var csrfEl = document.querySelector('[name="_csrf"]');
      var fd = new FormData();
      for (var i = 0; i < files.length; i++) fd.append('files', files[i]);
      fd.append('_csrf', csrfEl ? csrfEl.value : '');
      if (statusEl) statusEl.textContent = 'Nahrávam…';
      fetch('/admin/articles/media-upload', {
        method: 'POST',
        credentials: 'same-origin',
        body: fd,
      })
        .then(function (r) {
          return r.json().then(function (d) {
            if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
            return d;
          });
        })
        .then(function (d) {
          addMediaItems(
            (d.uploaded || []).map(function (u) {
              return u.id;
            })
          );
          if (statusEl) statusEl.textContent = d.errors && d.errors.length ? 'Časť zlyhala' : '';
        })
        .catch(function (e) {
          if (statusEl) statusEl.textContent = 'Chyba: ' + e.message;
        });
      fileInput.value = '';
    });

    var pickBtn = bar.querySelector('[data-rvx-pick-multi]');
    if (window.bzMediaPicker && window.bzMediaPicker.openMulti) {
      pickBtn.addEventListener('click', function () {
        window.bzMediaPicker.openMulti(function (items) {
          addMediaItems(
            items.map(function (it) {
              return it.id;
            })
          );
        });
      });
    } else {
      pickBtn.style.display = 'none';
    }
  }

  // Generic list for string arrays
  function setupStringList(node, key) {
    bindMeta(node);
    var listEl = node.querySelector('[data-rvx-items]'),
      addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl || !addBtn) return;
    function render() {
      var ci = CI(node);
      if (ci === -1) return;
      var b = BR();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci][key])) b[ci][key] = [];
      listEl.innerHTML = '';
      b[ci][key].forEach(function (val, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'gap:6px;margin-bottom:8px;';
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" value="' +
          EA(val) +
          '" style="flex:1"><button type="button" class="btn btn-sm btn-outline-danger" data-i="del"><i class="bi bi-x-lg"></i></button>';
        row.querySelector('input').addEventListener('input', function () {
          var idx = CI(node),
            bl = BR();
          if (bl && bl[idx]) {
            bl[idx][key][i] = this.value;
            SY();
          }
        });
        row.querySelector('[data-i="del"]').addEventListener('click', function () {
          var idx = CI(node),
            bl = BR();
          if (bl && bl[idx]) {
            bl[idx][key].splice(i, 1);
            SY();
            render();
          }
        });
        listEl.appendChild(row);
      });
    }
    addBtn.addEventListener('click', function () {
      var ci = CI(node),
        b = BR();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci][key])) b[ci][key] = [];
      b[ci][key].push('');
      SY();
      render();
    });
    render();
  }

  // Dual/triple list setup (buyers, hilo)
  function setupMultiList(node, lists) {
    bindMeta(node);
    lists.forEach(function (cfg) {
      var listEl = node.querySelector('[data-rvx-list="' + cfg.key + '"]'),
        addBtn = node.querySelector('[data-rvx-add-list="' + cfg.key + '"]');
      if (!listEl || !addBtn) return;
      function render() {
        var ci = CI(node);
        if (ci === -1) return;
        var b = BR();
        if (!b || !b[ci]) return;
        if (!Array.isArray(b[ci][cfg.key])) b[ci][cfg.key] = [];
        listEl.innerHTML = '';
        b[ci][cfg.key].forEach(function (val, i) {
          var row = document.createElement('div');
          row.className = 'bz-nested-row';
          row.style.cssText = 'gap:6px;margin-bottom:6px;';
          row.innerHTML =
            '<input type="text" class="form-control form-control-sm" value="' +
            EA(val) +
            '" placeholder="' +
            EA(cfg.ph || '') +
            '" style="flex:1"><button type="button" class="btn btn-sm btn-outline-danger"><i class="bi bi-x-lg"></i></button>';
          row.querySelector('input').addEventListener('input', function () {
            var idx = CI(node),
              bl = BR();
            if (bl && bl[idx]) bl[idx][cfg.key][i] = this.value;
            SY();
          });
          row.querySelector('button').addEventListener('click', function () {
            var idx = CI(node),
              bl = BR();
            if (bl && bl[idx]) {
              bl[idx][cfg.key].splice(i, 1);
              SY();
              render();
            }
          });
          listEl.appendChild(row);
        });
      }
      addBtn.addEventListener('click', function () {
        var ci = CI(node),
          b = BR();
        if (!b || !b[ci]) return;
        if (!Array.isArray(b[ci][cfg.key])) b[ci][cfg.key] = [];
        b[ci][cfg.key].push('');
        SY();
        render();
      });
      render();
    });
  }

  // =========================================================================
  // TEMPLATES + TOOLBAR BUTTONS (all 30 new + 4 existing)
  // =========================================================================
  // 4 from Balík 1 already registered by rvx-blocks-1.js — skip them

  // --- Citácie ---
  T('rvx_quotes', GT('rvx_quotes', 'Citácie', 'bi-chat-quote-fill'));
  AB('rvx_quotes', 'bi-chat-quote-fill', 'Citácie');

  // --- Versus ---
  T('rvx_versus', GT('rvx_versus', 'Versus (porovnanie)', 'bi-arrow-left-right'));
  AB('rvx_versus', 'bi-arrow-left-right', 'Versus');

  // --- Galleries ---
  T('rvx_gallery_full', GT('rvx_gallery_full', 'Galéria (všetky fotky)', 'bi-images'));
  AB('rvx_gallery_full', 'bi-images', 'Galéria+');
  T('rvx_gallery_exif', GT('rvx_gallery_exif', 'Galéria s EXIF', 'bi-camera'));
  AB('rvx_gallery_exif', 'bi-camera', 'Galéria EXIF');
  T('rvx_gallery_compare', GT('rvx_gallery_compare', 'Pred / Po (porovnanie)', 'bi-vr'));
  AB('rvx_gallery_compare', 'bi-vr', 'Pred/Po');
  T('rvx_gallery_modes', GT('rvx_gallery_modes', 'Foto režimy', 'bi-grid-1x2'));
  AB('rvx_gallery_modes', 'bi-grid-1x2', 'Foto režimy');
  T('rvx_gallery_samples', GT('rvx_gallery_samples', 'Fotky z fotoaparátu', 'bi-camera-reels'));
  AB('rvx_gallery_samples', 'bi-camera-reels', 'Ukážky foto');
  T('rvx_gallery_hero', GT('rvx_gallery_hero', 'Hero showcase', 'bi-layout-wtf'));
  AB('rvx_gallery_hero', 'bi-layout-wtf', 'Hero galéria');

  // --- Buyers ---
  T(
    'rvx_buyers',
    GS(
      'rvx_buyers',
      'Verdikt · Pre koho',
      'bi-people',
      '<div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis"></div></div>' +
        '<h6 class="mt-2" style="color:var(--art-accent)">✓ Ideálne pre</h6><div data-rvx-list="yes"></div><button type="button" class="bz-art-btn bz-art-btn-sm mb-2" data-rvx-add-list="yes"><i class="bi bi-plus-lg"></i> Pridať</button>' +
        '<h6 style="color:var(--art-text-muted)">~ Zvážte ak</h6><div data-rvx-list="maybe"></div><button type="button" class="bz-art-btn bz-art-btn-sm mb-2" data-rvx-add-list="maybe"><i class="bi bi-plus-lg"></i> Pridať</button>' +
        '<h6 style="color:oklch(0.7 0.18 25)">✗ Nie pre</h6><div data-rvx-list="no"></div><button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add-list="no"><i class="bi bi-plus-lg"></i> Pridať</button>'
    )
  );
  AB('rvx_buyers', 'bi-people', 'Pre koho');

  // --- HiLo ---
  T(
    'rvx_hilo',
    GS(
      'rvx_hilo',
      'Najviac a najmenej',
      'bi-bar-chart',
      '<div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis"></div></div>' +
        '<h6 class="mt-2" style="color:var(--art-accent)">↑ Highest</h6><div data-rvx-list="highs"></div><button type="button" class="bz-art-btn bz-art-btn-sm mb-2" data-rvx-add-list="highs"><i class="bi bi-plus-lg"></i> Pridať</button>' +
        '<h6 style="color:oklch(0.7 0.18 25)">↓ Lowest</h6><div data-rvx-list="lows"></div><button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add-list="lows"><i class="bi bi-plus-lg"></i> Pridať</button>'
    )
  );
  AB('rvx_hilo', 'bi-bar-chart', 'Najviac/najmenej');

  // --- Rest ---
  T('rvx_deepdive', GT('rvx_deepdive', 'Hĺbkový rozbor (taby)', 'bi-journal-text'));
  AB('rvx_deepdive', 'bi-journal-text', 'Hĺbkový rozbor');
  T('rvx_bench', GT('rvx_bench', 'Benchmarky', 'bi-speedometer2'));
  AB('rvx_bench', 'bi-speedometer2', 'Benchmarky');
  T('rvx_timeline', GT('rvx_timeline', 'Denník testovania', 'bi-calendar-event'));
  AB('rvx_timeline', 'bi-calendar-event', 'Denník');
  T('rvx_pricing', GT('rvx_pricing', 'Varianty a ceny', 'bi-tag'));
  AB('rvx_pricing', 'bi-tag', 'Ceny');
  T('rvx_generations', GT('rvx_generations', 'Porovnanie generácií', 'bi-table'));
  AB('rvx_generations', 'bi-table', 'Generácie');
  T('rvx_profile', GT('rvx_profile', 'Profil zariadenia', 'bi-cpu'));
  AB('rvx_profile', 'bi-cpu', 'Profil');
  T('rvx_awards', GT('rvx_awards', 'Ocenenia', 'bi-trophy'));
  AB('rvx_awards', 'bi-trophy', 'Ocenenia');
  T('rvx_box', GT('rvx_box', 'Balenie', 'bi-box'));
  AB('rvx_box', 'bi-box', 'Balenie');
  T('rvx_experts', GT('rvx_experts', 'Hlasy odborníkov', 'bi-person-badge'));
  AB('rvx_experts', 'bi-person-badge', 'Odborníci');
  T('rvx_usecases', GT('rvx_usecases', 'Scenáre použitia', 'bi-bullseye'));
  AB('rvx_usecases', 'bi-bullseye', 'Scenáre');
  T('rvx_battery', GT('rvx_battery', 'Výdrž batérie', 'bi-battery-charging'));
  AB('rvx_battery', 'bi-battery-charging', 'Batéria');
  T('rvx_software', GT('rvx_software', 'Softvérové funkcie', 'bi-app'));
  AB('rvx_software', 'bi-app', 'Softvér');
  T(
    'rvx_design',
    GS(
      'rvx_design',
      'Dizajn a materiály',
      'bi-palette',
      '<div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis"></div></div>' +
        '<textarea class="form-control form-control-sm mb-2" data-field="text" rows="4" placeholder="Text sekcie"></textarea>' +
        '<div data-rvx-items></div><button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať parameter</button>'
    )
  );
  AB('rvx_design', 'bi-palette', 'Dizajn');
  T('rvx_sustain', GT('rvx_sustain', 'Udržateľnosť', 'bi-recycle'));
  AB('rvx_sustain', 'bi-recycle', 'Udržateľnosť');
  T('rvx_accessories', GT('rvx_accessories', 'Príslušenstvo', 'bi-headset'));
  AB('rvx_accessories', 'bi-headset', 'Príslušenstvo');
  T(
    'rvx_repair',
    GS(
      'rvx_repair',
      'Opraviteľnosť',
      'bi-tools',
      '<div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis"></div><div class="col-md-4"><input type="number" class="form-control form-control-sm" data-field="score" placeholder="Skóre 0-10" min="0" max="10" step="0.1"></div></div>' +
        '<div data-rvx-items></div><button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať</button>'
    )
  );
  AB('rvx_repair', 'bi-tools', 'Opraviteľnosť');
  T('rvx_buy', GT('rvx_buy', 'Kde kúpiť', 'bi-cart'));
  AB('rvx_buy', 'bi-cart', 'Kde kúpiť');
  T('rvx_faq', GT('rvx_faq', 'Časté otázky', 'bi-question-circle'));
  AB('rvx_faq', 'bi-question-circle', 'FAQ');
  T('rvx_alts', GT('rvx_alts', 'Alternatívy', 'bi-arrows-angle-expand'));
  AB('rvx_alts', 'bi-arrows-angle-expand', 'Alternatívy');
  T(
    'rvx_pricehist',
    GS(
      'rvx_pricehist',
      'Vývoj ceny',
      'bi-graph-up',
      '<div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis"></div></div>' +
        '<textarea class="form-control form-control-sm mb-2" data-field="note" rows="2" placeholder="Poznámka"></textarea>' +
        '<input type="text" class="form-control form-control-sm" data-field="url" placeholder="URL na Heureku">'
    )
  );
  AB('rvx_pricehist', 'bi-graph-up', 'Vývoj ceny');
  T(
    'rvx_editornote',
    GS(
      'rvx_editornote',
      'Poznámka editora',
      'bi-pencil-square',
      '<textarea class="form-control form-control-sm mb-2" data-field="text" rows="4" placeholder="Text poznámky"></textarea>' +
        '<input type="text" class="form-control form-control-sm" data-field="author" placeholder="Autor">'
    )
  );
  AB('rvx_editornote', 'bi-pencil-square', 'Pozn. editora');
  T(
    'rvx_method',
    GS(
      'rvx_method',
      'Ako sme testovali',
      'bi-clipboard-check',
      '<div class="row g-2 mb-2"><div class="col-md-4"><input type="text" class="form-control form-control-sm" data-field="eyebrow" placeholder="Eyebrow"></div><div class="col-md-8"><input type="text" class="form-control form-control-sm" data-field="title" placeholder="Nadpis"></div></div>' +
        '<textarea class="form-control form-control-sm mb-2" data-field="text" rows="4" placeholder="Text"></textarea>' +
        '<div data-rvx-items></div><button type="button" class="bz-art-btn bz-art-btn-sm" data-rvx-add><i class="bi bi-plus-lg"></i> Pridať bod</button>'
    )
  );
  AB('rvx_method', 'bi-clipboard-check', 'Metodika');

  // =========================================================================
  // EXPORT — setup router
  // =========================================================================
  window.__bzRvxBlocks = {
    setup: function (node, type) {
      switch (type) {
        // Balík 1 (handled by rvx-blocks-1 if loaded, fallback here)
        case 'rvx_glance':
          setupItems(
            node,
            [
              { key: 'icon', type: 'icon' },
              { key: 'title', ph: 'Nadpis', style: 'flex:1;min-width:140px' },
              { key: 'text', ph: 'Popis', style: 'flex:2;min-width:180px' },
            ],
            { icon: 'check', title: '', text: '' }
          );
          break;
        case 'rvx_keyspecs':
          setupItems(
            node,
            [
              { key: 'num', ph: 'Hodnota' },
              { key: 'label', ph: 'Popis' },
            ],
            { num: '', label: '' }
          );
          break;
        case 'rvx_quickstrip':
          setupItems(
            node,
            [
              { key: 'label', ph: 'Label' },
              { key: 'value', ph: 'Hodnota' },
              {
                key: 'style',
                type: 'select',
                options: [
                  { v: '', l: 'Normálny' },
                  { v: 'good', l: 'Dobrý' },
                  { v: 'great', l: 'Výborný' },
                  { v: 'bad', l: 'Zlý' },
                ],
              },
            ],
            { label: '', value: '', style: '' }
          );
          break;
        case 'rvx_connect':
          setupStringList(node, 'items');
          break;
        // Citácie
        case 'rvx_quotes':
          setupItems(
            node,
            [
              { key: 'text', ph: 'Citát', type: 'textarea', style: 'flex:2;min-width:200px' },
              { key: 'author', ph: 'Autor', style: 'flex:1;min-width:120px' },
            ],
            { text: '', author: '' }
          );
          break;
        // Versus
        case 'rvx_versus':
          setupItems(
            node,
            [
              { key: 'name', ph: 'Názov produktu' },
              { key: 'desc', ph: 'Popis', style: 'flex:2' },
              { key: 'score', ph: 'Skóre', type: 'number', style: 'max-width:80px' },
            ],
            { name: '', desc: '', score: 0, pros: [], cons: [] }
          );
          break;
        // Galleries (media_id as number input)
        case 'rvx_gallery_full':
          setupItems(
            node,
            [
              { key: 'media_id', ph: 'Media ID', type: 'number', style: 'max-width:100px' },
              { key: 'caption', ph: 'Popis', style: 'flex:1' },
            ],
            { media_id: null, caption: '' },
            { mediaKey: 'media_id' }
          );
          break;
        case 'rvx_gallery_exif':
          setupItems(
            node,
            [
              { key: 'media_id', ph: 'Media ID', type: 'number', style: 'max-width:80px' },
              { key: 'title', ph: 'Názov' },
              { key: 'focal', ph: 'Focal', style: 'max-width:80px' },
              { key: 'aperture', ph: 'f/', style: 'max-width:60px' },
              { key: 'iso', ph: 'ISO', style: 'max-width:60px' },
              { key: 'shutter', ph: 'Shutter', style: 'max-width:80px' },
            ],
            { media_id: null, title: '', focal: '', aperture: '', iso: '', shutter: '' },
            { mediaKey: 'media_id' }
          );
          break;
        case 'rvx_gallery_compare':
          setupItems(
            node,
            [
              { key: 'before_media_id', ph: 'Before ID', type: 'number', style: 'max-width:90px' },
              { key: 'after_media_id', ph: 'After ID', type: 'number', style: 'max-width:90px' },
              { key: 'before_label', ph: 'Text pred (PRED)', style: 'max-width:100px' },
              { key: 'after_label', ph: 'Text po (PO)', style: 'max-width:100px' },
              { key: 'label', ph: 'Popis', style: 'flex:1' },
            ],
            {
              before_media_id: null,
              after_media_id: null,
              label: '',
              before_label: 'PRED',
              after_label: 'PO',
            }
          );
          break;
        case 'rvx_gallery_modes':
          setupItems(
            node,
            [
              { key: 'media_id', ph: 'Media ID', type: 'number', style: 'max-width:90px' },
              { key: 'icon', type: 'icon' },
              { key: 'title', ph: 'Režim' },
              { key: 'desc', ph: 'Popis', style: 'flex:1' },
            ],
            { media_id: null, title: '', desc: '', icon: 'image' },
            { mediaKey: 'media_id' }
          );
          break;
        case 'rvx_gallery_samples':
          setupItems(
            node,
            [
              { key: 'media_id', ph: 'Media ID', type: 'number', style: 'max-width:90px' },
              { key: 'caption', ph: 'Popis', style: 'flex:1' },
              { key: 'settings', ph: 'Nastavenia (f/1.8, ISO 200...)', style: 'flex:1' },
            ],
            { media_id: null, caption: '', settings: '' },
            { mediaKey: 'media_id' }
          );
          break;
        case 'rvx_gallery_hero':
          setupItems(
            node,
            [
              { key: 'media_id', ph: 'Media ID', type: 'number', style: 'max-width:90px' },
              { key: 'caption', ph: 'Popis', style: 'flex:1' },
            ],
            { media_id: null, caption: '' },
            { mediaKey: 'media_id' }
          );
          break;
        // Buyers + HiLo (multi-list)
        case 'rvx_buyers':
          setupMultiList(node, [
            { key: 'yes', ph: 'Pre koho áno' },
            { key: 'maybe', ph: 'Zvážte ak...' },
            { key: 'no', ph: 'Nie pre...' },
          ]);
          break;
        case 'rvx_hilo':
          setupMultiList(node, [
            { key: 'highs', ph: 'Najlepšie' },
            { key: 'lows', ph: 'Najhoršie' },
          ]);
          break;
        // Deep dive (tabs)
        case 'rvx_deepdive':
          setupItems(
            node,
            [
              { key: 'tab_title', ph: 'Názov tabu', style: 'max-width:200px' },
              { key: 'text', ph: 'Obsah', type: 'textarea', style: 'flex:1' },
            ],
            { tab_title: '', text: '' }
          );
          break;
        // Benchmarks
        case 'rvx_bench':
          setupItems(
            node,
            [
              { key: 'name', ph: 'Test' },
              { key: 'score', ph: 'Skóre', type: 'number', style: 'max-width:80px' },
              { key: 'max', ph: 'Max', type: 'number', style: 'max-width:80px' },
              { key: 'label', ph: 'Jednotka', style: 'max-width:80px' },
            ],
            { name: '', score: 0, max: 100, label: '' }
          );
          break;
        // Timeline
        case 'rvx_timeline':
          setupItems(
            node,
            [
              { key: 'day', ph: 'Deň', style: 'max-width:100px' },
              { key: 'title', ph: 'Nadpis' },
              { key: 'text', ph: 'Popis', type: 'textarea', style: 'flex:1' },
            ],
            { day: '', title: '', text: '' }
          );
          break;
        // Pricing
        case 'rvx_pricing':
          setupItems(
            node,
            [
              { key: 'name', ph: 'Variant' },
              { key: 'price', ph: 'Cena', style: 'max-width:100px' },
              { key: 'specs', ph: 'Špecifikácie', style: 'flex:1' },
              { key: 'url', ph: 'URL', style: 'flex:1' },
            ],
            { name: '', price: '', specs: '', url: '' }
          );
          break;
        // Generations (table - headers + rows)
        case 'rvx_generations':
          setupGenerations(node);
          break;
        // Simple key-value lists
        case 'rvx_profile':
          setupItems(
            node,
            [
              { key: 'label', ph: 'Vlastnosť' },
              { key: 'value', ph: 'Hodnota' },
            ],
            { label: '', value: '' }
          );
          break;
        case 'rvx_awards':
          setupItems(
            node,
            [
              { key: 'title', ph: 'Názov ocenenia' },
              { key: 'org', ph: 'Organizácia' },
              { key: 'year', ph: 'Rok', style: 'max-width:80px' },
            ],
            { title: '', org: '', year: '' }
          );
          break;
        case 'rvx_box':
          setupItems(
            node,
            [
              { key: 'icon', type: 'icon' },
              { key: 'text', ph: 'Položka', style: 'flex:1' },
            ],
            { icon: 'category', text: '' }
          );
          break;
        case 'rvx_experts':
          setupItems(
            node,
            [
              { key: 'name', ph: 'Meno' },
              { key: 'role', ph: 'Pozícia' },
              { key: 'text', ph: 'Citát', type: 'textarea', style: 'flex:2' },
              { key: 'score', ph: 'Skóre', type: 'number', style: 'max-width:70px' },
            ],
            { name: '', role: '', text: '', score: null }
          );
          break;
        case 'rvx_usecases':
          setupItems(
            node,
            [
              { key: 'icon', type: 'icon' },
              { key: 'title', ph: 'Scenár' },
              { key: 'text', ph: 'Popis', style: 'flex:1' },
              {
                key: 'verdict',
                type: 'select',
                options: [
                  { v: 'yes', l: 'Áno' },
                  { v: 'maybe', l: 'Možno' },
                  { v: 'no', l: 'Nie' },
                ],
              },
            ],
            { icon: 'check', title: '', text: '', verdict: 'yes' }
          );
          break;
        case 'rvx_battery':
          setupItems(
            node,
            [
              { key: 'scenario', ph: 'Scenár' },
              { key: 'hours', ph: 'Hodiny', style: 'max-width:80px' },
              { key: 'pct', ph: '%', type: 'number', style: 'max-width:70px' },
            ],
            { scenario: '', hours: '', pct: 0 }
          );
          break;
        case 'rvx_software':
          setupItems(
            node,
            [
              { key: 'title', ph: 'Funkcia' },
              { key: 'text', ph: 'Popis', type: 'textarea', style: 'flex:1' },
            ],
            { title: '', text: '' }
          );
          break;
        case 'rvx_design':
          setupItems(
            node,
            [
              { key: 'label', ph: 'Vlastnosť' },
              { key: 'value', ph: 'Hodnota' },
            ],
            { label: '', value: '' }
          );
          break;
        case 'rvx_sustain':
          setupItems(
            node,
            [
              { key: 'label', ph: 'Vlastnosť' },
              { key: 'value', ph: 'Hodnota' },
            ],
            { label: '', value: '' }
          );
          break;
        case 'rvx_accessories':
          setupItems(
            node,
            [
              { key: 'media_id', ph: 'Media ID', type: 'number', style: 'max-width:80px' },
              { key: 'name', ph: 'Názov' },
              { key: 'price', ph: 'Cena', style: 'max-width:90px' },
              { key: 'url', ph: 'URL odkaz', style: 'flex:1' },
              { key: 'note', ph: 'Poznámka', style: 'flex:1' },
            ],
            { name: '', price: '', url: '', note: '', media_id: null }
          );
          break;
        case 'rvx_repair':
          setupItems(
            node,
            [
              { key: 'label', ph: 'Vlastnosť' },
              { key: 'value', ph: 'Hodnota' },
            ],
            { label: '', value: '' }
          );
          break;
        case 'rvx_buy':
          setupItems(
            node,
            [
              { key: 'shop', ph: 'Obchod' },
              { key: 'price', ph: 'Cena', style: 'max-width:100px' },
              { key: 'url', ph: 'URL' },
            ],
            { shop: '', price: '', url: '' }
          );
          break;
        case 'rvx_faq':
          setupItems(
            node,
            [
              { key: 'q', ph: 'Otázka' },
              { key: 'a', ph: 'Odpoveď', type: 'textarea', style: 'flex:2' },
            ],
            { q: '', a: '' }
          );
          break;
        case 'rvx_alts':
          setupItems(
            node,
            [
              { key: 'name', ph: 'Produkt' },
              { key: 'score', ph: 'Skóre', type: 'number', style: 'max-width:70px' },
              { key: 'reason', ph: 'Prečo', style: 'flex:1' },
              { key: 'slug', ph: 'Slug článku (napr. samsung-s26)', style: 'flex:1' },
              { key: 'url', ph: 'Ext. URL (ak nie je slug)', style: 'flex:1' },
            ],
            { name: '', score: null, reason: '', url: '', slug: '' }
          );
          break;
        // Simple fields only
        case 'rvx_pricehist':
          bindMeta(node);
          break;
        case 'rvx_editornote':
          bindMeta(node);
          break;
        case 'rvx_method':
          setupStringList(node, 'items');
          break;
      }
    },
  };

  // Generations table — special handler
  function setupGenerations(node) {
    bindMeta(node);
    var listEl = node.querySelector('[data-rvx-items]'),
      addBtn = node.querySelector('[data-rvx-add]');
    if (!listEl) return;
    // Generations nepoužíva generické "Pridať" tlačidlo (má vlastné "Pridať riadok")
    if (addBtn) addBtn.remove();
    function render() {
      var ci = CI(node);
      if (ci === -1) return;
      var b = BR();
      if (!b || !b[ci]) return;
      if (!Array.isArray(b[ci].headers)) b[ci].headers = [];
      if (!Array.isArray(b[ci].rows)) b[ci].rows = [];
      listEl.innerHTML =
        '<div class="mb-2"><label class="form-label form-label-sm">Stĺpce (oddelené čiarkou)</label><input type="text" class="form-control form-control-sm" data-gen-headers value="' +
        EA(b[ci].headers.join(', ')) +
        '"></div><div data-gen-rows></div><button type="button" class="bz-art-btn bz-art-btn-sm mt-1" data-gen-add-row><i class="bi bi-plus-lg"></i> Pridať riadok</button>';
      var hInp = listEl.querySelector('[data-gen-headers]');
      hInp.addEventListener('input', function () {
        var idx = CI(node),
          bl = BR();
        if (bl && bl[idx])
          bl[idx].headers = hInp.value
            .split(',')
            .map(function (s) {
              return s.trim();
            })
            .filter(Boolean);
        SY();
      });
      var rowsEl = listEl.querySelector('[data-gen-rows]');
      b[ci].rows.forEach(function (r, ri) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row';
        row.style.cssText = 'gap:6px;margin-bottom:6px;';
        row.innerHTML =
          '<input type="text" class="form-control form-control-sm" value="' +
          EA((r.cells || []).join(' | ')) +
          '" placeholder="Bunky oddelené |" style="flex:1"><button type="button" class="btn btn-sm btn-outline-danger"><i class="bi bi-x-lg"></i></button>';
        row.querySelector('input').addEventListener('input', function () {
          var idx = CI(node),
            bl = BR();
          if (bl && bl[idx])
            bl[idx].rows[ri].cells = this.value.split('|').map(function (s) {
              return s.trim();
            });
          SY();
        });
        row.querySelector('button').addEventListener('click', function () {
          var idx = CI(node),
            bl = BR();
          if (bl && bl[idx]) {
            bl[idx].rows.splice(ri, 1);
            SY();
            render();
          }
        });
        rowsEl.appendChild(row);
      });
      listEl.querySelector('[data-gen-add-row]').addEventListener('click', function () {
        var idx = CI(node),
          bl = BR();
        if (!bl || !bl[idx]) return;
        bl[idx].rows.push({ cells: [] });
        SY();
        render();
      });
    }
    render();
  }
})();
