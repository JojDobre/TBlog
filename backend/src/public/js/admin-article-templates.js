/**
 * Article templates — loads from DB via API
 * + "Uložiť ako šablónu" button
 */
(function () {
  'use strict';

  var templates = [];

  function loadTemplates(cb) {
    fetch('/admin/articles/../templates/api/list', { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        templates = data;
        if (cb) cb();
      })
      .catch(function () {
        templates = [];
        if (cb) cb();
      });
  }

  // Render template selector dropdown
  function renderSelector() {
    var wrap = document.querySelector('[data-template-selector]');
    if (!wrap) return;

    loadTemplates(function () {
      if (templates.length === 0) {
        wrap.innerHTML =
          '<span style="font-size:11px;color:var(--art-text-muted)">Žiadne šablóny. <a href="/admin/templates">Vytvoriť →</a></span>';
        return;
      }
      var html =
        '<select class="form-select form-select-sm" data-template-select><option value="">— Vybrať šablónu —</option>';
      templates.forEach(function (t) {
        html +=
          '<option value="' + t.id + '">' + t.name + ' (' + t.blocks.length + ' blokov)</option>';
      });
      html += '</select>';
      wrap.innerHTML = html;

      wrap.querySelector('[data-template-select]').addEventListener('change', function () {
        var id = Number(this.value);
        if (!id) return;
        applyTemplate(id);
        this.value = '';
      });
    });
  }

  function applyTemplate(id) {
    var tpl = templates.find(function (t) {
      return t.id === id;
    });
    if (!tpl) return;

    var editor = window.__bzArticleEditor;
    if (!editor) return;

    var currentBlocks = editor.getBlocks();
    if (currentBlocks.length > 0) {
      if (
        !window.confirm(
          'Nahradiť existujúce bloky šablónou "' +
            tpl.name +
            '"?\n\nTáto akcia vymaže aktuálny obsah.'
        )
      )
        return;
    }

    editor.setBlocks(JSON.parse(JSON.stringify(tpl.blocks)));

    var typeSelect = document.querySelector('select[name="type"]');
    if (typeSelect && tpl.type) typeSelect.value = tpl.type;
  }

  // "Save as template" button
  function renderSaveBtn() {
    var wrap = document.querySelector('[data-template-save]');
    if (!wrap) return;

    wrap.innerHTML =
      '<button type="button" class="bz-art-btn bz-art-btn-sm bz-art-btn-ghost" style="width:100%" data-save-tpl><i class="bi bi-floppy me-1"></i> Uložiť ako šablónu</button>';

    wrap.querySelector('[data-save-tpl]').addEventListener('click', function () {
      var editor = window.__bzArticleEditor;
      if (!editor) return;
      var blocks = editor.getBlocks();
      if (!blocks.length) return alert('Článok nemá žiadne bloky.');

      var name = prompt('Názov šablóny:');
      if (!name || !name.trim()) return;

      var typeSelect = document.querySelector('select[name="type"]');
      var type = typeSelect ? typeSelect.value : 'article';
      var csrfInput = document.querySelector('input[name="_csrf"]');
      var csrf = csrfInput ? csrfInput.value : '';

      fetch('/admin/templates/api/save-from-editor', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({
          name: name.trim(),
          type: type,
          blocks_json: JSON.stringify(blocks),
        }),
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (data.ok) {
            alert('Šablóna "' + name.trim() + '" uložená!');
            loadTemplates(function () {
              renderSelector();
            });
          } else {
            alert('Chyba: ' + (data.error || 'Neznáma chyba'));
          }
        })
        .catch(function () {
          alert('Nepodarilo sa uložiť šablónu.');
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      renderSelector();
      renderSaveBtn();
    });
  } else {
    renderSelector();
    renderSaveBtn();
  }
})();
