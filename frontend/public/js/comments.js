/**
 * Bytezone — Comments frontend
 *
 * Hookuje sa na data atribúty v partials/comments.ejs:
 *   data-comments-section  — root element
 *   data-article-id        — ID článku
 *   data-csrf              — CSRF token
 *   data-user-id           — ID prihláseného usera (prázdne = neprihlásený)
 *   data-comment-form      — formulár na nový komentár
 *   data-comment-submit    — odoslať button
 *   data-comments-list     — kontajner pre komentáre
 *   data-comments-count    — počet komentárov text
 *   data-comments-empty    — empty state
 */

(function () {
  'use strict';

  var section = document.querySelector('[data-comments-section]');
  if (!section) return;

  var articleId = section.getAttribute('data-article-id');
  var csrf = section.getAttribute('data-csrf') || '';
  var currentUserId = Number(section.getAttribute('data-user-id')) || 0;

  var listEl = section.querySelector('[data-comments-list]');
  var countEl = section.querySelector('[data-comments-count]');
  var emptyEl = section.querySelector('[data-comments-empty]');
  var form = section.querySelector('[data-comment-form]');
  var submitBtn = section.querySelector('[data-comment-submit]');
  var textarea = form ? form.querySelector('.comment-textarea') : null;

  var currentPage = 1;
  var totalPages = 1;
  var totalComments = 0;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    var now = Date.now();
    var then = new Date(dateStr).getTime();
    var diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'práve teraz';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hod';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' d';
    return new Date(dateStr).toLocaleDateString('sk-SK');
  }

  function initials(nickname) {
    if (!nickname) return '?';
    return nickname
      .split(/[\s_-]+/)
      .map(function (s) {
        return s[0];
      })
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function updateCount(total) {
    totalComments = total;
    if (!countEl) return;
    if (total === 0) countEl.textContent = '0 komentárov';
    else if (total === 1) countEl.textContent = '1 komentár';
    else if (total >= 2 && total <= 4) countEl.textContent = total + ' komentáre';
    else countEl.textContent = total + ' komentárov';
  }

  function showEmpty(show) {
    if (emptyEl) emptyEl.style.display = show ? '' : 'none';
  }

  async function api(method, url, body) {
    var opts = {
      method: method,
      headers: { 'x-csrf-token': csrf },
      credentials: 'same-origin',
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(url, opts);
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Chyba servera');
    return data;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function renderAvatar(user) {
    if (user.avatar_path) {
      return (
        '<span class="avatar cmt-avatar"><img src="/uploads/' +
        escapeHtml(user.avatar_path) +
        '" alt=""></span>'
      );
    }
    return '<span class="avatar cmt-avatar">' + escapeHtml(initials(user.nickname)) + '</span>';
  }

  function renderComment(c, isReply) {
    var cls = 'cmt-item' + (isReply ? ' cmt-reply' : '');
    var deleted = c.is_deleted_by_admin;

    var html = '<div class="' + cls + '" data-comment-id="' + c.id + '">';
    html += renderAvatar(c.user);
    html += '<div class="cmt-body">';

    // Header
    html += '<div class="cmt-header">';
    html += '<span class="cmt-author">' + escapeHtml(c.user.nickname) + '</span>';
    html += '<span class="cmt-time">' + timeAgo(c.created_at) + '</span>';
    if (c.is_edited && !deleted) {
      html += '<span class="cmt-edited">upravené</span>';
    }
    html += '</div>';

    // Content
    if (deleted) {
      html +=
        '<p class="cmt-content cmt-content--deleted">Tento komentár bol odstránený administrátorom.</p>';
    } else {
      html += '<p class="cmt-content">' + escapeHtml(c.content) + '</p>';
    }

    // Actions
    if (!deleted) {
      html += '<div class="cmt-actions">';

      // Like
      html +=
        '<button class="cmt-action-btn cmt-like-btn' +
        (c.liked_by_me ? ' cmt-liked' : '') +
        '" data-like="' +
        c.id +
        '">';
      html +=
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="' +
        (c.liked_by_me ? 'currentColor' : 'none') +
        '" stroke="currentColor" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
      html += '<span>' + (c.likes_count || '') + '</span>';
      html += '</button>';

      // Reply (len pre top-level, len ak prihlásený)
      if (!isReply && currentUserId) {
        html += '<button class="cmt-action-btn" data-reply="' + c.id + '">Odpovedať</button>';
      }

      // Own comment actions
      if (currentUserId === c.user.id) {
        html += '<button class="cmt-action-btn" data-edit="' + c.id + '">Upraviť</button>';
        html +=
          '<button class="cmt-action-btn cmt-action-danger" data-delete="' +
          c.id +
          '">Zmazať</button>';
      } else if (currentUserId) {
        html += '<button class="cmt-action-btn" data-report="' + c.id + '">Nahlásiť</button>';
      }

      html += '</div>';
    }

    html += '</div>'; // .cmt-body
    html += '</div>'; // .cmt-item

    return html;
  }

  function renderTree(comments) {
    var html = '';
    for (var i = 0; i < comments.length; i++) {
      var c = comments[i];
      html += renderComment(c, false);
      if (c.replies && c.replies.length > 0) {
        html += '<div class="cmt-replies">';
        for (var j = 0; j < c.replies.length; j++) {
          html += renderComment(c.replies[j], true);
        }
        html += '</div>';
      }
    }
    return html;
  }

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  async function loadComments(page) {
    try {
      var data = await api('GET', '/api/comments/' + articleId + '?page=' + page, null);
      currentPage = data.page;
      totalPages = data.totalPages;
      updateCount(data.total);

      if (data.comments.length === 0 && page === 1) {
        listEl.innerHTML = '';
        showEmpty(true);
        return;
      }

      showEmpty(false);
      listEl.innerHTML = renderTree(data.comments);

      // Pagination
      if (totalPages > 1) {
        listEl.insertAdjacentHTML('beforeend', renderPagination());
      }
    } catch (err) {
      console.error('Comments load error:', err);
    }
  }

  function renderPagination() {
    var html = '<div class="cmt-pagination">';
    for (var i = 1; i <= totalPages; i++) {
      html +=
        '<button class="cmt-page-btn' +
        (i === currentPage ? ' cmt-page-active' : '') +
        '" data-page="' +
        i +
        '">' +
        i +
        '</button>';
    }
    html += '</div>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Submit new comment
  // ---------------------------------------------------------------------------

  if (textarea && submitBtn) {
    textarea.addEventListener('input', function () {
      submitBtn.disabled = textarea.value.trim().length === 0;
    });

    submitBtn.addEventListener('click', async function () {
      var content = textarea.value.trim();
      if (!content) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Odosiela sa...';

      try {
        var body = { article_id: Number(articleId), content: content };
        var replyTo = submitBtn.getAttribute('data-reply-to');
        if (replyTo) body.parent_id = Number(replyTo);

        await api('POST', '/api/comments', body);

        textarea.value = '';
        submitBtn.textContent = 'Odoslať';
        cancelReplyMode();
        await loadComments(replyTo ? currentPage : 1);
      } catch (err) {
        alert(err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odoslať';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Reply mode
  // ---------------------------------------------------------------------------

  function enterReplyMode(parentId, nickname) {
    if (!form || !textarea) return;
    cancelReplyMode();
    submitBtn.setAttribute('data-reply-to', parentId);

    var hint = document.createElement('div');
    hint.className = 'cmt-reply-hint';
    hint.innerHTML =
      'Odpovedáš na <strong>' +
      escapeHtml(nickname) +
      '</strong> ' +
      '<button type="button" class="cmt-cancel-reply">Zrušiť</button>';
    form.querySelector('.comment-form-body').prepend(hint);

    hint.querySelector('.cmt-cancel-reply').addEventListener('click', cancelReplyMode);
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function cancelReplyMode() {
    if (!submitBtn) return;
    submitBtn.removeAttribute('data-reply-to');
    var hint = form ? form.querySelector('.cmt-reply-hint') : null;
    if (hint) hint.remove();
  }

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------

  async function startEdit(commentId) {
    var el = listEl.querySelector('[data-comment-id="' + commentId + '"]');
    if (!el) return;
    var contentEl = el.querySelector('.cmt-content');
    var actionsEl = el.querySelector('.cmt-actions');
    var original = contentEl.textContent;

    contentEl.innerHTML =
      '<textarea class="comment-textarea cmt-edit-textarea" maxlength="2000">' +
      escapeHtml(original) +
      '</textarea>';
    var editTa = contentEl.querySelector('textarea');

    actionsEl.innerHTML =
      '<button class="cmt-action-btn cmt-action-save" data-save-edit="' +
      commentId +
      '">Uložiť</button>' +
      '<button class="cmt-action-btn" data-cancel-edit="' +
      commentId +
      '">Zrušiť</button>';

    editTa.focus();
    editTa.setSelectionRange(editTa.value.length, editTa.value.length);
  }

  async function saveEdit(commentId) {
    var el = listEl.querySelector('[data-comment-id="' + commentId + '"]');
    if (!el) return;
    var editTa = el.querySelector('.cmt-edit-textarea');
    if (!editTa) return;
    var content = editTa.value.trim();
    if (!content) return;

    try {
      await api('PUT', '/api/comments/' + commentId, { content: content });
      await loadComments(currentPage);
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function deleteComment(commentId) {
    if (!confirm('Naozaj chceš zmazať tento komentár?')) return;
    try {
      await api('DELETE', '/api/comments/' + commentId, null);
      await loadComments(currentPage);
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Like
  // ---------------------------------------------------------------------------

  async function toggleLike(commentId) {
    if (!currentUserId) return;
    try {
      var data = await api('POST', '/api/comments/' + commentId + '/like', {});
      var btn = listEl.querySelector('[data-like="' + commentId + '"]');
      if (!btn) return;
      btn.classList.toggle('cmt-liked', data.liked);
      var svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', data.liked ? 'currentColor' : 'none');
      var span = btn.querySelector('span');
      if (span) span.textContent = data.likes_count || '';
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Report
  // ---------------------------------------------------------------------------

  async function reportComment(commentId) {
    var reason = prompt('Dôvod nahlásenia (voliteľné):');
    if (reason === null) return; // cancel
    try {
      await api('POST', '/api/comments/' + commentId + '/report', { reason: reason || '' });
      alert('Komentár bol nahlásený. Ďakujeme.');
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Event delegation
  // ---------------------------------------------------------------------------

  listEl.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-like]');
    if (btn) {
      toggleLike(Number(btn.getAttribute('data-like')));
      return;
    }

    btn = e.target.closest('[data-reply]');
    if (btn) {
      var cmtEl = btn.closest('[data-comment-id]');
      var author = cmtEl ? cmtEl.querySelector('.cmt-author') : null;
      enterReplyMode(btn.getAttribute('data-reply'), author ? author.textContent : '');
      return;
    }

    btn = e.target.closest('[data-edit]');
    if (btn) {
      startEdit(Number(btn.getAttribute('data-edit')));
      return;
    }

    btn = e.target.closest('[data-save-edit]');
    if (btn) {
      saveEdit(Number(btn.getAttribute('data-save-edit')));
      return;
    }

    btn = e.target.closest('[data-cancel-edit]');
    if (btn) {
      loadComments(currentPage);
      return;
    }

    btn = e.target.closest('[data-delete]');
    if (btn) {
      deleteComment(Number(btn.getAttribute('data-delete')));
      return;
    }

    btn = e.target.closest('[data-report]');
    if (btn) {
      reportComment(Number(btn.getAttribute('data-report')));
      return;
    }

    btn = e.target.closest('[data-page]');
    if (btn) {
      var p = Number(btn.getAttribute('data-page'));
      if (p !== currentPage) loadComments(p);
      return;
    }
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  loadComments(1);
})();
