/**
 * Phase 5.4 — pridá YouTube a Quote tlačidlá + templates dynamicky.
 *
 * Tento súbor sa načíta PRED `admin-article-editor.js` (cez `defer`,
 * ale v poradí v ktorom sú v HTML). Nastaví template elementy a tlačidlá
 * aby ich main editor našiel.
 *
 * Dôvod: vyhneme sa kompletnému prepisu edit.ejs pri pridaní block typov.
 */

(function () {
  'use strict';

  // 1) Pridaj <template> elementy ak ešte neexistujú
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
        '<span class="bz-block-label">' +
          '<i class="bi bi-youtube me-1"></i>YouTube' +
        '</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<div class="row g-2">' +
        '<div class="col-md-5">' +
          '<div data-youtube-preview class="bz-image-preview" style="min-height:140px;">' +
            '<span class="text-muted small">(zadaj YouTube URL alebo video ID)</span>' +
          '</div>' +
        '</div>' +
        '<div class="col-md-7">' +
          '<input type="text" class="form-control form-control-sm mb-2" data-field="video_id" ' +
            'placeholder="YouTube URL alebo 11-znakový video ID" maxlength="500">' +
          '<input type="text" class="form-control form-control-sm" data-field="caption" ' +
            'placeholder="Popis pod videom (voliteľný)" maxlength="500">' +
          '<div class="form-text small">Vlož celú URL napr. <code>https://youtu.be/dQw4w9WgXcQ</code> — automaticky sa normalizuje.</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  ensureTemplate('quote', '' +
    '<div class="bz-block" data-block-type="quote">' +
      '<div class="bz-block-header">' +
        '<span class="bz-block-label">' +
          '<i class="bi bi-chat-quote me-1"></i>Citát' +
        '</span>' +
        '<div class="bz-block-actions"></div>' +
      '</div>' +
      '<textarea class="form-control mb-2" rows="3" data-field="text" ' +
        'placeholder="Text citátu..." maxlength="5000"></textarea>' +
      '<input type="text" class="form-control form-control-sm" data-field="author" ' +
        'placeholder="Autor (voliteľný)" maxlength="160">' +
    '</div>'
  );

  // 2) Pridaj tlačidlá do toolbar-u (kontajner s tlačidlami `data-add-block`)
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
})();
