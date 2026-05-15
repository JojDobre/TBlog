/**
 * Page block editor  (Phase 2 — static pages)
 *
 * Standalone editor pre statické stránky.
 * Podporované typy:
 *   - paragraph, heading, image, divider (štandardné)
 *   - sp_values, sp_team, sp_contact_cta, sp_contact_form,
 *     sp_channels, sp_office, sp_key_value, sp_rights,
 *     sp_cookies, sp_summary, sp_legal_meta (page-specific)
 */

(function () {
  'use strict';

  var form = document.querySelector('[data-page-form]');
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

  var mediaCache = {};

  // ---- Helpers ----
  function syncHidden() {
    hiddenInput.value = JSON.stringify(blocks);
    if (emptyState) emptyState.style.display = blocks.length === 0 ? '' : 'none';
  }

  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function currentIndex(node) {
    return Array.prototype.indexOf.call(container.children, node);
  }

  function reindexDom() {
    Array.prototype.forEach.call(container.children, function (n, i) {
      n.setAttribute('data-block-index', i);
    });
  }

  function getTemplate(type) {
    return document.querySelector('[data-block-template="' + type + '"]');
  }

  // ---- Media preview ----
  function fetchMediaThumb(mediaId) {
    if (mediaCache[mediaId]) return Promise.resolve(mediaCache[mediaId]);
    return fetch('/api/media/' + mediaId)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (d && d.thumbnail_path) {
          mediaCache[mediaId] = d;
          return d;
        }
        return null;
      });
  }

  function updateImagePreview(node, mediaId) {
    var el = node.querySelector('[data-image-preview]');
    if (!el) return;
    if (!mediaId) {
      el.innerHTML = '<span class="text-muted small">(žiadny)</span>';
      return;
    }
    el.innerHTML = '<span class="text-muted small">načítavam…</span>';
    fetchMediaThumb(mediaId)
      .then(function (d) {
        el.innerHTML = d
          ? '<img src="/uploads/' + d.thumbnail_path + '" class="img-fluid rounded" alt="">'
          : '<span class="text-danger small">ID neexistuje</span>';
      })
      .catch(function () {
        el.innerHTML = '<span class="text-warning small">(chyba)</span>';
      });
  }

  // ---- Default block data ----
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
      case 'sp_values':
        return { type: 'sp_values', items: [{ icon: 'flame', title: '', desc: '' }] };
      case 'sp_team':
        return { type: 'sp_team', members: [{ name: '', role: '', bio: '' }] };
      case 'sp_contact_cta':
        return { type: 'sp_contact_cta', title: '', text: '', email: '', show_pgp: false };
      case 'sp_contact_form':
        return { type: 'sp_contact_form' };
      case 'sp_channels':
        return {
          type: 'sp_channels',
          channels: [{ icon: 'send', label: '', value: '', note: '' }],
        };
      case 'sp_office':
        return { type: 'sp_office', address: '', description: '', stats: [], map_url: '' };
      case 'sp_key_value':
        return { type: 'sp_key_value', items: [{ key: '', value: '' }] };
      case 'sp_rights':
        return { type: 'sp_rights', items: [{ icon: 'info', title: '', desc: '' }] };
      case 'sp_cookies':
        return {
          type: 'sp_cookies',
          rows: [{ name: '', purpose: '', ttl: '', cookie_type: 'Nutný' }],
        };
      case 'sp_summary':
        return { type: 'sp_summary', tldr: '', body: '' };
      case 'sp_legal_meta':
        return { type: 'sp_legal_meta', items: [{ label: '', value: '' }] };
      default:
        return null;
    }
  }

  // ---- Render single block ----
  function renderBlock(index) {
    var block = blocks[index];
    if (!block) return null;
    var tpl = getTemplate(block.type);
    if (!tpl) return null;

    var node = tpl.content.firstElementChild.cloneNode(true);
    node.setAttribute('data-block-index', index);

    // Image preview
    if (block.type === 'image' && block.media_id) updateImagePreview(node, block.media_id);

    // Simple data-field bindings
    var fields = node.querySelectorAll('[data-field]');
    fields.forEach(function (f) {
      var key = f.getAttribute('data-field');
      var val = block[key];
      if (val === null || val === undefined) val = '';

      if (f.type === 'checkbox') {
        f.checked = !!val;
        f.addEventListener('change', function () {
          var idx = currentIndex(node);
          if (idx === -1) return;
          blocks[idx][key] = f.checked;
          syncHidden();
        });
      } else {
        f.value = val;
        f.addEventListener('input', function () {
          var idx = currentIndex(node);
          if (idx === -1) return;
          if (key === 'media_id') {
            var n = Number(f.value);
            blocks[idx][key] = Number.isInteger(n) && n > 0 ? n : null;
            updateImagePreview(node, blocks[idx][key]);
          } else if (key === 'level') {
            blocks[idx][key] = Number(f.value) === 3 ? 3 : 2;
          } else {
            blocks[idx][key] = f.value;
          }
          syncHidden();
        });
      }
    });

    // Block actions (move up/down, remove)
    var actions = node.querySelector('.bz-block-actions');
    if (actions) {
      actions.innerHTML =
        '<button type="button" class="btn btn-sm btn-outline-secondary" data-action="up" title="Hore"><i class="bi bi-chevron-up"></i></button>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" data-action="down" title="Dole"><i class="bi bi-chevron-down"></i></button>' +
        '<button type="button" class="btn btn-sm btn-outline-danger" data-action="remove" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
      actions.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var act = btn.getAttribute('data-action');
        if (act === 'up') move(node, -1);
        else if (act === 'down') move(node, 1);
        else if (act === 'remove') remove(node);
      });
    }

    return node;
  }

  // ---- Nested items rendering ----
  // Each nested block type has a config: { arrayKey, fields: [...] }
  var NESTED_CONFIGS = {
    sp_values: {
      arrayKey: 'items',
      fields: [
        { key: 'icon', placeholder: 'Ikona (flame, scale, users…)', maxlen: 40 },
        { key: 'title', placeholder: 'Nadpis hodnoty', maxlen: 160 },
        { key: 'desc', placeholder: 'Popis', maxlen: 500, textarea: true },
      ],
    },
    sp_team: {
      arrayKey: 'members',
      fields: [
        { key: 'name', placeholder: 'Meno a priezvisko', maxlen: 120 },
        { key: 'role', placeholder: 'Rola / pozícia', maxlen: 160 },
        { key: 'bio', placeholder: 'Bio (krátky popis)', maxlen: 500 },
      ],
    },
    sp_channels: {
      arrayKey: 'channels',
      fields: [
        { key: 'icon', placeholder: 'Ikona (send, tag, lock…)', maxlen: 40 },
        { key: 'label', placeholder: 'Označenie (Redakcia, DPO…)', maxlen: 80 },
        { key: 'value', placeholder: 'Hodnota (email, URL…)', maxlen: 255 },
        { key: 'note', placeholder: 'Poznámka', maxlen: 160 },
      ],
    },
    sp_office: {
      arrayKey: 'stats',
      fields: [
        { key: 'value', placeholder: 'Hodnota (14 min)', maxlen: 40 },
        { key: 'label', placeholder: 'Popis (od Hlavnej stanice)', maxlen: 80 },
      ],
    },
    sp_key_value: {
      arrayKey: 'items',
      fields: [
        { key: 'key', placeholder: 'Kľúč', maxlen: 200 },
        { key: 'value', placeholder: 'Hodnota', maxlen: 1000 },
      ],
    },
    sp_rights: {
      arrayKey: 'items',
      fields: [
        { key: 'icon', placeholder: 'Ikona (eye, edit, trash…)', maxlen: 40 },
        { key: 'title', placeholder: 'Názov práva', maxlen: 160 },
        { key: 'desc', placeholder: 'Popis', maxlen: 500 },
      ],
    },
    sp_cookies: {
      arrayKey: 'rows',
      fields: [
        { key: 'name', placeholder: 'Názov cookie', maxlen: 80 },
        { key: 'purpose', placeholder: 'Účel', maxlen: 255 },
        { key: 'ttl', placeholder: 'Platnosť (30 dní, 1 rok…)', maxlen: 60 },
        { key: 'cookie_type', placeholder: 'Typ (Nutný, Funkčný, Analytický)', maxlen: 40 },
      ],
    },
    sp_legal_meta: {
      arrayKey: 'items',
      fields: [
        { key: 'label', placeholder: 'Označenie (Prevádzkovateľ, IČO…)', maxlen: 80 },
        { key: 'value', placeholder: 'Hodnota', maxlen: 255 },
      ],
    },
  };

  function setupNestedBlock(node, type) {
    var config = NESTED_CONFIGS[type];
    if (!config) return;

    var listEl = node.querySelector('[data-nested-list="' + config.arrayKey + '"]');
    var addBtn = node.querySelector('[data-nested-add="' + config.arrayKey + '"]');
    if (!listEl) return;

    function renderItems() {
      var ci = currentIndex(node);
      if (ci === -1) return;
      var arr = blocks[ci][config.arrayKey] || [];
      listEl.innerHTML = '';

      arr.forEach(function (item, i) {
        var row = document.createElement('div');
        row.className = 'bz-nested-row mb-2 p-2 border rounded bg-light';
        var html = '<div class="d-flex gap-1 flex-wrap">';

        config.fields.forEach(function (f) {
          if (f.textarea) {
            html +=
              '<textarea class="form-control form-control-sm mb-1" placeholder="' +
              escAttr(f.placeholder) +
              '" maxlength="' +
              f.maxlen +
              '" data-nested-field="' +
              f.key +
              '" rows="2">' +
              escAttr(item[f.key]) +
              '</textarea>';
          } else {
            html +=
              '<input type="text" class="form-control form-control-sm" style="flex:1;min-width:100px;" placeholder="' +
              escAttr(f.placeholder) +
              '" maxlength="' +
              f.maxlen +
              '" data-nested-field="' +
              f.key +
              '" value="' +
              escAttr(item[f.key]) +
              '">';
          }
        });

        html +=
          '<button type="button" class="btn btn-sm btn-outline-danger flex-shrink-0" title="Odstrániť"><i class="bi bi-x-lg"></i></button>';
        html += '</div>';
        row.innerHTML = html;

        // Bind inputs
        row.querySelectorAll('[data-nested-field]').forEach(function (inp) {
          var fKey = inp.getAttribute('data-nested-field');
          inp.addEventListener('input', function () {
            var ci2 = currentIndex(node);
            if (ci2 === -1) return;
            blocks[ci2][config.arrayKey][i][fKey] = inp.value;
            syncHidden();
          });
        });

        // Delete button
        row.querySelector('.btn-outline-danger').addEventListener('click', function () {
          var ci2 = currentIndex(node);
          if (ci2 === -1) return;
          blocks[ci2][config.arrayKey].splice(i, 1);
          syncHidden();
          renderItems();
        });

        listEl.appendChild(row);
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var ci = currentIndex(node);
        if (ci === -1) return;
        if (!blocks[ci][config.arrayKey]) blocks[ci][config.arrayKey] = [];

        // Create empty item from config fields
        var newItem = {};
        config.fields.forEach(function (f) {
          newItem[f.key] = '';
        });
        blocks[ci][config.arrayKey].push(newItem);
        syncHidden();
        renderItems();
      });
    }

    renderItems();
  }

  // ---- CRUD ----
  function add(type) {
    var b = defaultBlock(type);
    if (!b) return;
    blocks.push(b);
    var node = renderBlock(blocks.length - 1);
    if (node) {
      container.appendChild(node);
      setupNestedBlock(node, type);
    }
    reindexDom();
    syncHidden();
    if (node) {
      var first = node.querySelector('input, textarea, select');
      if (first) first.focus();
    }
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
    var pendingSetups = [];
    for (var i = 0; i < blocks.length; i++) {
      var node = renderBlock(i);
      if (node) {
        container.appendChild(node);
        pendingSetups.push({ node: node, type: blocks[i].type });
      }
    }
    pendingSetups.forEach(function (p) {
      setupNestedBlock(p.node, p.type);
    });
    syncHidden();
  }

  // ---- Toolbar ----
  document.querySelectorAll('[data-add-block]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      add(btn.getAttribute('data-add-block'));
    });
  });

  // ---- Template change (new page only) ----
  var tplSelect = document.querySelector('[data-page-template]');
  if (tplSelect) {
    tplSelect.addEventListener('change', function () {
      // Only load defaults if editor is empty or user confirms
      if (blocks.length > 0) {
        if (
          !window.confirm(
            'Načítať predvolené bloky pre túto šablónu? Existujúce bloky budú nahradené.'
          )
        )
          return;
      }
      var tpl = tplSelect.value;
      fetch('/admin/pages/api/template-defaults/' + encodeURIComponent(tpl))
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data && Array.isArray(data.blocks)) {
            blocks.length = 0;
            data.blocks.forEach(function (b) {
              blocks.push(b);
            });
            renderAll();
          }
        })
        .catch(function (err) {
          console.error('Template defaults fetch failed:', err);
        });
    });
  }

  // ---- Submit ----
  form.addEventListener('submit', function () {
    syncHidden();
  });

  // ---- Init ----
  renderAll();
})();

(function () {
  'use strict';

  var btn = document.querySelector('[data-page-delete]');
  if (!btn) return;

  btn.addEventListener('click', function () {
    var msg = btn.getAttribute('data-confirm') || 'Naozaj zmazať?';
    if (!window.confirm(msg)) return;

    var f = document.createElement('form');
    f.method = 'POST';
    f.action = btn.getAttribute('data-delete-url');
    f.style.display = 'none';

    var csrf = document.createElement('input');
    csrf.type = 'hidden';
    csrf.name = '_csrf';
    csrf.value = btn.getAttribute('data-csrf');
    f.appendChild(csrf);

    document.body.appendChild(f);
    f.submit();
  });
})();
