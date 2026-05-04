/**
 * Phase 5.6 final — extra block templates + related articles panel.
 *
 * Templates: youtube, quote, gallery, list (sa pridajú dynamicky ako <template>).
 * Toolbar: pridá 4 tlačidlá pre nové typy.
 *
 * Related panel:
 *   - Server vykreslí panel + strategy select sám (s pôvodnou hodnotou z DB).
 *   - JS sa hookuje na existujúce DOM elementy (data-related-list, data-related-search,
 *     data-related-results, data-related-empty).
 *   - Initial data čítame z <script type="application/json" data-related-init>
 *     (robustnejšie ako data-attribute — apostrof v title nerozbije parsing).
 *
 * Beží PRED admin-article-editor.js, takže templates a tlačidlá sú pripravené.
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. Block templates
  // -------------------------------------------------------------------------
  function ensureTemplate(type, html) {
    if (document.querySelector('[data-block-template="' + type + '"]')) return;
    var tpl = document.createElement('template');
    tpl.setAttribute('data-block-template', type);
    tpl.innerHTML = html.trim();
    document.body.appendChild(tpl);
  }

  ensureTemplate('youtube', '' +
    '<div class="bz-block" data-block-type="youtube">' +
      '<div class="bz-block-header">' +
        '<span class="bz-block-label"><i class="bi bi-youtube me-1"></i>YouTube</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="row g-2">' +
        '<div class="col-md-5">' +
          '<div data-youtube-preview class="bz-image-preview" style="min-height:140px;">' +
            '<span class="text-muted small">(zadaj URL alebo video ID)</span>' +
          '</div>' +
        '</div>' +
        '<div class="col-md-7">' +
          '<input type="text" class="form-control form-control-sm mb-2" data-field="video_id" ' +
            'placeholder="YouTube URL alebo 11-znakový video ID" maxlength="500">' +
          '<input type="text" class="form-control form-control-sm" data-field="caption" ' +
            'placeholder="Popis pod videom (voliteľný)" maxlength="500">' +
          '<div class="form-text small">Vlož celú URL — automaticky sa normalizuje.</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  ensureTemplate('quote', '' +
    '<div class="bz-block" data-block-type="quote">' +
      '<div class="bz-block-header">' +
        '<span class="bz-block-label"><i class="bi bi-chat-quote me-1"></i>Citát</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<textarea class="form-control mb-2" rows="3" data-field="text" ' +
        'placeholder="Text citátu..." maxlength="5000"></textarea>' +
      '<input type="text" class="form-control form-control-sm" data-field="author" ' +
        'placeholder="Autor (voliteľný)" maxlength="160">' +
    '</div>'
  );

  ensureTemplate('gallery', '' +
    '<div class="bz-block" data-block-type="gallery">' +
      '<div class="bz-block-header">' +
        '<span class="bz-block-label"><i class="bi bi-images me-1"></i>Galéria</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div data-gallery-items class="bz-gallery-items"></div>' +
      '<div class="d-flex gap-2 mt-2">' +
        '<button type="button" class="btn btn-sm btn-outline-primary" data-gallery-add>' +
          '<i class="bi bi-plus-lg me-1"></i>Pridať obrázok' +
        '</button>' +
      '</div>' +
      '<div class="form-text small mt-1">Max 30 obrázkov v galérii.</div>' +
    '</div>'
  );

  ensureTemplate('list', '' +
    '<div class="bz-block" data-block-type="list">' +
      '<div class="bz-block-header">' +
        '<span class="bz-block-label"><i class="bi bi-list-ul me-1"></i>Zoznam</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="d-flex gap-2 align-items-center mb-2">' +
        '<select class="form-select form-select-sm" data-field="ordered" style="width: 180px;">' +
          '<option value="0">• Nečíslovaný</option>' +
          '<option value="1">1. Číslovaný</option>' +
        '</select>' +
      '</div>' +
      '<div data-list-items class="bz-list-items"></div>' +
      '<button type="button" class="btn btn-sm btn-outline-primary mt-2" data-list-add>' +
        '<i class="bi bi-plus-lg me-1"></i>Pridať položku' +
      '</button>' +
    '</div>'
  );

  // -------------------------------------------------------------------------
  // 2. Toolbar buttons
  // -------------------------------------------------------------------------
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

  addToolbarButton('youtube', 'bi-youtube', 'YouTube');
  addToolbarButton('quote', 'bi-chat-quote', 'Citát');
  addToolbarButton('gallery', 'bi-images', 'Galéria');
  addToolbarButton('list', 'bi-list-ul', 'Zoznam');

  // -------------------------------------------------------------------------
  // 3. Related panel logic — hookuje sa na server-rendered DOM
  // -------------------------------------------------------------------------
  function bootstrapRelatedPanel() {
    var listEl = document.querySelector('[data-related-list]');
    var emptyEl = document.querySelector('[data-related-empty]');
    var searchEl = document.querySelector('[data-related-search]');
    var resultsEl = document.querySelector('[data-related-results]');
    if (!listEl || !searchEl || !resultsEl) {
      // Server panel chýba — možno user nevyhodil fallback do JS-injection.
      // Skús injekciu ako fallback (legacy support).
      injectFallbackPanel();
      return;
    }

    // Initial items čítame zo <script type="application/json">
    var items = readInitData();
    var ownArticleId = getOwnArticleId();

    function readInitData() {
      var scriptEl = document.querySelector('script[data-related-init]');
      if (scriptEl) {
        var raw = (scriptEl.textContent || '').trim();
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {
            console.warn('[bz] Failed to parse related-init JSON:', e);
          }
        }
      }
      // Legacy fallback: data attribute
      var attrEl = document.querySelector('[data-related-init]:not(script)');
      if (attrEl) {
        try {
          var attrRaw = attrEl.getAttribute('data-related-init') || '[]';
          var parsedAttr = JSON.parse(attrRaw);
          if (Array.isArray(parsedAttr)) return parsedAttr;
        } catch (e) {
          console.warn('[bz] Failed to parse related-init attribute:', e);
        }
      }
      return [];
    }

    function getOwnArticleId() {
      var form = document.querySelector('[data-article-form]');
      if (!form) return 0;
      var action = form.getAttribute('action') || '';
      var m = action.match(/\/admin\/articles\/(\d+)/);
      return m ? Number(m[1]) : 0;
    }

    function render() {
      listEl.innerHTML = '';
      if (items.length === 0) {
        if (emptyEl) emptyEl.classList.remove('d-none');
        return;
      }
      if (emptyEl) emptyEl.classList.add('d-none');

      items.forEach(function (item, idx) {
        var row = document.createElement('div');
        row.className = 'bz-related-item';
        row.innerHTML =
          '<input type="hidden" name="related_ids" value="' + Number(item.id) + '">' +
          '<div class="flex-grow-1 small">' +
            '<div class="bz-related-title">' + escapeHtml(item.title) + '</div>' +
            '<div class="text-muted" style="font-size:0.7rem;">#' + Number(item.id) +
              ' · ' + escapeHtml(item.status || '') + '</div>' +
          '</div>' +
          '<div class="bz-related-actions">' +
            (idx > 0
              ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-related-up><i class="bi bi-arrow-up"></i></button>'
              : '') +
            (idx < items.length - 1
              ? '<button type="button" class="btn btn-sm btn-outline-secondary" data-related-down><i class="bi bi-arrow-down"></i></button>'
              : '') +
            '<button type="button" class="btn btn-sm btn-outline-danger" data-related-remove><i class="bi bi-x-lg"></i></button>' +
          '</div>';

        var upBtn = row.querySelector('[data-related-up]');
        var downBtn = row.querySelector('[data-related-down]');
        var rmBtn = row.querySelector('[data-related-remove]');
        if (upBtn) upBtn.addEventListener('click', function () { move(idx, -1); });
        if (downBtn) downBtn.addEventListener('click', function () { move(idx, 1); });
        if (rmBtn) rmBtn.addEventListener('click', function () { remove(idx); });

        listEl.appendChild(row);
      });
    }

    function move(idx, dir) {
      var ni = idx + dir;
      if (ni < 0 || ni >= items.length) return;
      var tmp = items[idx];
      items[idx] = items[ni];
      items[ni] = tmp;
      render();
    }

    function remove(idx) { items.splice(idx, 1); render(); }

    function add(item) {
      if (!item || !item.id) return;
      if (items.some(function (i) { return i.id === item.id; })) return;
      if (items.length >= 20) {
        alert('Maximum 20 súvisiacich článkov.');
        return;
      }
      items.push(item);
      render();
    }

    var searchTimer = null;
    searchEl.addEventListener('input', function () {
      clearTimeout(searchTimer);
      var q = searchEl.value.trim();
      if (q.length < 2) {
        resultsEl.classList.add('d-none');
        resultsEl.innerHTML = '';
        return;
      }
      searchTimer = setTimeout(function () { doSearch(q); }, 250);
    });

    searchEl.addEventListener('blur', function () {
      setTimeout(function () { resultsEl.classList.add('d-none'); }, 200);
    });
    searchEl.addEventListener('focus', function () {
      if (resultsEl.children.length > 0) resultsEl.classList.remove('d-none');
    });

    function doSearch(q) {
      var url = '/admin/articles/search?q=' + encodeURIComponent(q) +
        (ownArticleId ? '&exclude=' + ownArticleId : '');
      fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : { items: [] }; })
        .then(function (data) {
          renderResults(data.items || []);
        })
        .catch(function () { resultsEl.innerHTML = ''; resultsEl.classList.add('d-none'); });
    }

    function renderResults(results) {
      resultsEl.innerHTML = '';
      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="text-muted small p-2">Nič sa nenašlo.</div>';
        resultsEl.classList.remove('d-none');
        return;
      }
      results.forEach(function (item) {
        var alreadyAdded = items.some(function (i) { return i.id === item.id; });
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'bz-related-result' + (alreadyAdded ? ' is-added' : '');
        row.disabled = alreadyAdded;
        row.innerHTML =
          '<div class="bz-related-result-title">' + escapeHtml(item.title) +
            (alreadyAdded ? ' <span class="text-muted small">(už pridaný)</span>' : '') +
          '</div>' +
          '<div class="text-muted" style="font-size:0.7rem;">#' + Number(item.id) +
            ' · ' + escapeHtml(item.status) + ' · ' + escapeHtml(item.type) + '</div>';
        if (!alreadyAdded) {
          row.addEventListener('click', function () {
            add(item);
            searchEl.value = '';
            resultsEl.classList.add('d-none');
            searchEl.focus();
          });
        }
        resultsEl.appendChild(row);
      });
      resultsEl.classList.remove('d-none');
    }

    render();
  }

  // -------------------------------------------------------------------------
  // 4. Legacy fallback — ak server-rendered panel chýba, vstrekne ho
  // -------------------------------------------------------------------------
  function injectFallbackPanel() {
    if (document.querySelector('[data-related-panel-server]')) return;
    if (document.querySelector('[data-related-panel-injected]')) return;

    var form = document.querySelector('[data-article-form]');
    if (!form) return;
    var rightCol = form.querySelector('.col-lg-4');
    if (!rightCol) return;

    var card = document.createElement('div');
    card.className = 'card border-0 shadow-sm mt-4';
    card.setAttribute('data-related-panel-injected', '');
    card.innerHTML =
      '<div class="card-header bg-white">' +
        '<h3 class="h6 mb-0"><i class="bi bi-link-45deg me-1"></i>Súvisiace články</h3>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="mb-3">' +
          '<label class="form-label small mb-1">Stratégia</label>' +
          '<select class="form-select form-select-sm" name="default_related_strategy">' +
            '<option value="both" selected>Manuálne + auto (oboje)</option>' +
            '<option value="manual">Iba manuálne</option>' +
            '<option value="auto">Iba automatické</option>' +
          '</select>' +
        '</div>' +
        '<div class="mb-2">' +
          '<label class="form-label small mb-1">Manuálne vybrané</label>' +
          '<div class="bz-related-list" data-related-list></div>' +
          '<div class="text-muted small fst-italic mt-2 d-none" data-related-empty>' +
            'Žiadne manuálne vybrané. Vyhľadaj nižšie.' +
          '</div>' +
        '</div>' +
        '<div class="mt-3">' +
          '<label class="form-label small mb-1">Hľadať a pridať</label>' +
          '<div class="position-relative">' +
            '<input type="search" class="form-control form-control-sm" data-related-search ' +
              'placeholder="Začni písať názov článku...">' +
            '<div class="bz-related-results d-none" data-related-results></div>' +
          '</div>' +
          '<div class="form-text small">Min 2 znaky. Klik na článok pridá do zoznamu.</div>' +
        '</div>' +
      '</div>';

    rightCol.appendChild(card);
    // Po injekcii zavolaj bootstrap znova — teraz nájde DOM elementy
    bootstrapRelatedPanel();
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Spusti — počkaj DOMContentLoaded ak treba
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapRelatedPanel);
  } else {
    bootstrapRelatedPanel();
  }
})();
