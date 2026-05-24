/**
 * Bookmarks page JS
 *
 * - Pre neprihlásených: renderuje zoznam z localStorage
 * - Pre prihlásených: remove button handler (AJAX)
 */
(function () {
  'use strict';

  var BOOKMARKS_KEY = 'bz_bookmarks';
  var container = document.getElementById('local-bookmarks');

  // ---- Neprihlásený: render z localStorage ----
  if (container) {
    var bookmarks = [];
    try {
      bookmarks = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    } catch (e) {
      bookmarks = [];
    }

    if (bookmarks.length === 0) {
      container.innerHTML =
        '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:16px;opacity:0.4">' +
        '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>' +
        '<h3 style="font-size:16px;margin:0 0 8px">Zatiaľ nič uložené</h3>' +
        '<p style="font-size:14px">Klikni na „Uložiť" pri článku a nájdeš ho tu.</p></div>';
      return;
    }

    var html = '<div class="bookmarks-list">';
    bookmarks.forEach(function (b) {
      html +=
        '<a href="' +
        b.url +
        '" class="bookmark-card">' +
        '<div class="bookmark-body">' +
        '<h3 class="bookmark-title">' +
        escapeHtml(b.title || b.url) +
        '</h3>' +
        '<span class="bookmark-meta">Uložené ' +
        new Date(b.saved_at).toLocaleDateString('sk-SK') +
        '</span>' +
        '</div>' +
        '<button type="button" class="bookmark-remove" data-remove-local="' +
        escapeHtml(b.url) +
        '" title="Odstrániť">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button></a>';
    });
    html += '</div>';
    container.innerHTML = html;

    // Remove handler (localStorage)
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove-local]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      var url = btn.getAttribute('data-remove-local');
      var bk = [];
      try {
        bk = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
      } catch (er) {
        bk = [];
      }
      bk = bk.filter(function (item) {
        return item.url !== url;
      });
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bk));
      var card = btn.closest('.bookmark-card');
      if (card) card.remove();
      if (!container.querySelector('.bookmark-card')) {
        container.innerHTML =
          '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">' +
          '<h3 style="font-size:16px;margin:0 0 8px">Všetko odstránené</h3></div>';
      }
    });
  }

  // ---- Prihlásený: remove handler (DB) ----
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-remove-bookmark]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var articleId = btn.getAttribute('data-remove-bookmark');
    var csrf = document.querySelector('input[name="_csrf"]');

    fetch('/api/bookmarks/toggle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf ? csrf.value : '',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ article_id: Number(articleId) }),
    }).then(function () {
      var card = btn.closest('.bookmark-card');
      if (card) card.remove();
      if (!document.querySelector('.bookmark-card')) {
        location.reload();
      }
    });
  });

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
})();
