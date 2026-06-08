/**
 * Ranking: icon_group + info_group options management
 */
(function () {
  'use strict';

  var rankingId = null;
  var match = window.location.pathname.match(/\/admin\/rankings\/(\d+)/);
  if (match) rankingId = match[1];
  if (!rankingId) return;

  var csrf = (document.querySelector('input[name="_csrf"]') || {}).value || '';

  // ========================================================
  // Options modal — manage criterion options
  // ========================================================
  var optModal = document.getElementById('optionsModal');
  var optList = document.getElementById('options-list');
  var optLabel = document.getElementById('opt-label');
  var optIcon = document.getElementById('opt-icon-media');
  var optDesc = document.getElementById('opt-description');
  var optAddBtn = document.getElementById('opt-add-btn');
  var optParentRow = document.getElementById('opt-parent-row');
  var optParent = document.getElementById('opt-parent');
  var currentCritId = null;
  var currentFieldType = null;

  function loadOptions(critId, fieldType) {
    currentCritId = critId;
    currentFieldType = fieldType;
    optParentRow.style.display = fieldType === 'info_group' ? '' : 'none';

    fetch('/admin/rankings/' + rankingId + '/criteria/' + critId + '/options', {
      credentials: 'same-origin',
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (options) {
        renderOptions(options);
      })
      .catch(function () {
        optList.innerHTML = '<div style="color:red">Chyba pri načítaní.</div>';
      });
  }

  function renderOptions(options) {
    optList.innerHTML = '';
    // Update parent dropdown for info_group
    if (currentFieldType === 'info_group') {
      optParent.innerHTML = '<option value="">— Hlavná úroveň (titulok) —</option>';
      options
        .filter(function (o) {
          return !o.parent_id;
        })
        .forEach(function (o) {
          optParent.innerHTML += '<option value="' + o.id + '">' + esc(o.label) + '</option>';
        });
    }

    var topLevel = options.filter(function (o) {
      return !o.parent_id;
    });
    topLevel.forEach(function (opt) {
      var row = document.createElement('div');
      row.className = 'opt-row';
      var iconHtml = opt.icon_url
        ? '<img src="' +
          opt.icon_url +
          '" style="width:24px;height:24px;object-fit:contain;border-radius:4px">'
        : '<span style="width:24px;height:24px;display:inline-grid;place-items:center;background:var(--art-border);border-radius:4px;font-size:10px"><i class="bi bi-image"></i></span>';
      row.innerHTML =
        '<div class="opt-row-main">' +
        (currentFieldType === 'icon_group' ? iconHtml : '') +
        '<strong>' +
        esc(opt.label) +
        '</strong>' +
        (opt.description
          ? '<span style="color:var(--art-text-muted);font-size:11px;margin-left:6px">' +
            esc(opt.description) +
            '</span>'
          : '') +
        '<span style="flex:1"></span>' +
        (opt.is_filterable
          ? '<span style="font-size:9px;color:var(--art-accent)">filtrovateľné</span>'
          : '') +
        '<button type="button" class="tpl-act tpl-act-del" data-del-opt="' +
        opt.id +
        '" title="Zmazať"><i class="bi bi-x-lg"></i></button>' +
        '</div>';

      // Subtitles for info_group
      if (currentFieldType === 'info_group') {
        var subs = options.filter(function (o) {
          return Number(o.parent_id) === opt.id;
        });
        if (subs.length) {
          var subList = document.createElement('div');
          subList.className = 'opt-sub-list';
          subs.forEach(function (sub) {
            var s = document.createElement('div');
            s.className = 'opt-sub-row';
            s.innerHTML =
              '<span style="color:var(--art-text-subtle)">└</span> ' +
              esc(sub.label) +
              (sub.is_filterable
                ? ' <span style="font-size:9px;color:var(--art-accent)">filtr.</span>'
                : '') +
              '<button type="button" class="tpl-act tpl-act-del" data-del-opt="' +
              sub.id +
              '" style="margin-left:auto"><i class="bi bi-x-lg"></i></button>';
            subList.appendChild(s);
          });
          row.appendChild(subList);
        }
      }

      optList.appendChild(row);
    });

    // Delete handlers
    optList.querySelectorAll('[data-del-opt]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('Odstrániť túto možnosť?')) return;
        fetch(
          '/admin/rankings/' +
            rankingId +
            '/criteria/' +
            currentCritId +
            '/options/' +
            btn.getAttribute('data-del-opt') +
            '/delete',
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: '_csrf=' + encodeURIComponent(csrf),
          }
        ).then(function () {
          loadOptions(currentCritId, currentFieldType);
        });
      });
    });
  }

  // Add option
  if (optAddBtn) {
    optAddBtn.addEventListener('click', function () {
      var label = optLabel.value.trim();
      if (!label) return;
      var body =
        '_csrf=' +
        encodeURIComponent(csrf) +
        '&label=' +
        encodeURIComponent(label) +
        '&icon_media_id=' +
        encodeURIComponent(optIcon.value || '') +
        '&description=' +
        encodeURIComponent(optDesc.value || '') +
        '&parent_id=' +
        encodeURIComponent((optParent && optParent.value) || '') +
        '&is_filterable=1';

      fetch('/admin/rankings/' + rankingId + '/criteria/' + currentCritId + '/options', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body,
      })
        .then(function (r) {
          return r.json();
        })
        .then(function () {
          optLabel.value = '';
          optIcon.value = '';
          optDesc.value = '';
          loadOptions(currentCritId, currentFieldType);
        });
    });
  }

  // Open options modal
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-manage-options');
    if (!btn) return;
    var critId = btn.getAttribute('data-criterion-id');
    var fieldType = btn.getAttribute('data-field-type');
    var name = btn.getAttribute('data-criterion-name');
    document.getElementById('optionsModalTitle').textContent = 'Možnosti: ' + name;
    loadOptions(critId, fieldType);
    bootstrap.Modal.getOrCreateInstance(optModal).show();
  });

  // ========================================================
  // Item options modal — assign options to product
  // ========================================================
  var itemOptModal = document.getElementById('itemOptionsModal');
  var itemOptList = document.getElementById('item-options-list');
  var itemOptSave = document.getElementById('item-options-save');
  var currentItemId = null;

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-edit-item-options');
    if (!btn) return;
    currentItemId = btn.getAttribute('data-item-id');
    var critId = btn.getAttribute('data-criterion-id');
    var name = btn.getAttribute('data-criterion-name');
    currentCritId = critId;
    document.getElementById('itemOptionsModalTitle').textContent = name + ' — vybrať';

    // Load all options + selected
    Promise.all([
      fetch('/admin/rankings/' + rankingId + '/criteria/' + critId + '/options', {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json();
      }),
      fetch('/admin/rankings/' + rankingId + '/items/' + currentItemId + '/options/' + critId, {
        credentials: 'same-origin',
      }).then(function (r) {
        return r.json();
      }),
    ]).then(function (results) {
      var allOpts = results[0];
      var selected = new Set(
        results[1].map(function (s) {
          return s.option_id;
        })
      );
      renderItemOptions(allOpts, selected);
    });

    bootstrap.Modal.getOrCreateInstance(itemOptModal).show();
  });

  function renderItemOptions(options, selected) {
    itemOptList.innerHTML = '';
    var topLevel = options.filter(function (o) {
      return !o.parent_id;
    });
    topLevel.forEach(function (opt) {
      var div = document.createElement('div');
      div.className = 'item-opt-row';
      div.innerHTML =
        '<label class="form-check" style="display:flex;align-items:center;gap:8px;padding:6px 0">' +
        '<input class="form-check-input" type="checkbox" value="' +
        opt.id +
        '"' +
        (selected.has(opt.id) ? ' checked' : '') +
        '>' +
        (opt.icon_url
          ? '<img src="' + opt.icon_url + '" style="width:20px;height:20px;object-fit:contain">'
          : '') +
        '<span>' +
        esc(opt.label) +
        '</span>' +
        '</label>';

      // Subtitles
      var subs = options.filter(function (o) {
        return Number(o.parent_id) === opt.id;
      });
      if (subs.length) {
        var subWrap = document.createElement('div');
        subWrap.style.cssText = 'padding-left:28px';
        subs.forEach(function (sub) {
          subWrap.innerHTML +=
            '<label class="form-check" style="display:flex;align-items:center;gap:8px;padding:3px 0;font-size:13px">' +
            '<input class="form-check-input" type="checkbox" value="' +
            sub.id +
            '"' +
            (selected.has(sub.id) ? ' checked' : '') +
            '>' +
            '<span style="color:var(--art-text-muted)">' +
            esc(sub.label) +
            '</span>' +
            '</label>';
        });
        div.appendChild(subWrap);
      }

      itemOptList.appendChild(div);
    });
  }

  // Save item options
  if (itemOptSave) {
    itemOptSave.addEventListener('click', function () {
      saveItemOptions(itemOptList, currentItemId, currentCritId, function () {
        bootstrap.Modal.getOrCreateInstance(itemOptModal).hide();
        window.location.reload();
      });
    });
  }

  function saveItemOptions(container, itemId, critId, cb) {
    var checked = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(function (c) {
      checked.push(c.value);
    });
    var body = '_csrf=' + encodeURIComponent(csrf);
    checked.forEach(function (id) {
      body += '&option_ids=' + encodeURIComponent(id);
    });
    if (!checked.length) body += '&option_ids=';

    fetch('/admin/rankings/' + rankingId + '/items/' + itemId + '/options/' + critId, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.ok && cb) cb();
        else if (data.error) alert(data.error);
      })
      .catch(function () {
        alert('Chyba pri ukladaní.');
      });
  }

  // === Inline checkboxes in item edit modal ===
  function loadInlineOptions(itemId) {
    var wraps = document.querySelectorAll('.rgroup-item-checkboxes');
    wraps.forEach(function (wrap) {
      var critId = wrap.getAttribute('data-group-crit');
      Promise.all([
        fetch('/admin/rankings/' + rankingId + '/criteria/' + critId + '/options', {
          credentials: 'same-origin',
        }).then(function (r) {
          return r.json();
        }),
        itemId
          ? fetch('/admin/rankings/' + rankingId + '/items/' + itemId + '/options/' + critId, {
              credentials: 'same-origin',
            }).then(function (r) {
              return r.json();
            })
          : Promise.resolve([]),
      ]).then(function (res) {
        var allOpts = res[0];
        var selected = new Set(
          res[1].map(function (s) {
            return s.option_id;
          })
        );
        var topLevel = allOpts.filter(function (o) {
          return !o.parent_id;
        });
        wrap.innerHTML = '';
        if (!topLevel.length) {
          wrap.innerHTML =
            '<span style="font-size:11px;color:var(--art-text-subtle)">Žiadne možnosti. Pridaj ich cez <i class="bi bi-list-check"></i>.</span>';
          return;
        }
        topLevel.forEach(function (opt) {
          var lbl = document.createElement('label');
          lbl.style.cssText =
            'display:flex;align-items:center;gap:6px;padding:3px 0;font-size:13px;cursor:pointer';
          lbl.innerHTML =
            '<input type="checkbox" class="form-check-input" value="' +
            opt.id +
            '" data-inline-opt="' +
            critId +
            '"' +
            (selected.has(opt.id) ? ' checked' : '') +
            '>' +
            (opt.icon_url
              ? '<img src="' + opt.icon_url + '" style="width:18px;height:18px;object-fit:contain">'
              : '') +
            '<span>' +
            esc(opt.label) +
            '</span>';
          wrap.appendChild(lbl);
        });
      });
    });
  }

  // Hook into edit item modal open
  var origEditBtn = document.querySelectorAll('.btn-edit-item');
  origEditBtn.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var itemId = btn.getAttribute('data-item-id');
      setTimeout(function () {
        loadInlineOptions(itemId);
      }, 100);
    });
  });

  // Hook into add item — load options when modal opens
  var addItemBtn =
    document.getElementById('add-item-btn') ||
    document.querySelector('[data-bs-target="#addItemModal"]');
  if (addItemBtn) {
    addItemBtn.addEventListener('click', function () {
      setTimeout(function () {
        loadInlineOptions(null);
      }, 100);
    });
  }

  // Save inline options after item save
  var origSaveEdit = document.getElementById('save-edit-item');
  if (origSaveEdit) {
    var origClick = origSaveEdit.onclick;
    origSaveEdit.addEventListener('click', function () {
      // Wait for item save, then save options
      setTimeout(function () {
        var itemId = document.getElementById('edit-item-id').value;
        if (!itemId) return;
        var wraps = document.querySelectorAll('.rgroup-item-checkboxes');
        var pending = wraps.length;
        if (!pending) return;
        wraps.forEach(function (wrap) {
          var critId = wrap.getAttribute('data-group-crit');
          saveItemOptions(wrap, itemId, critId, function () {
            pending--;
          });
        });
      }, 500);
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }
})();
