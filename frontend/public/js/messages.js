/**
 * Bytezone — Messages frontend
 *
 * Dva režimy:
 *   1) Inbox (#msg-list existuje)     — zoznam konverzácií
 *   2) Konverzácia (window.__CONV_ID) — vlákno správ + reply
 */

(function () {
  'use strict';

  var meta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = meta ? meta.getAttribute('content') : '';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

  function timeAgo(dateStr) {
    var diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'práve teraz';
    if (diff < 3600) return Math.floor(diff / 60) + ' min';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hod';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' d';
    return new Date(dateStr).toLocaleDateString('sk-SK');
  }

  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('sk-SK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function api(method, url, body) {
    var opts = {
      method: method,
      headers: { 'x-csrf-token': csrfToken },
      credentials: 'same-origin',
    };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(url, opts);
    return res.json();
  }

  function avatarHtml(user, size) {
    size = size || 40;
    if (!user)
      return '<div class="msg-avatar" style="width:' + size + 'px;height:' + size + 'px;">?</div>';
    if (user.avatar_thumb) {
      return (
        '<img class="msg-avatar" src="/uploads/' +
        escapeHtml(user.avatar_thumb) +
        '" alt="" style="width:' +
        size +
        'px;height:' +
        size +
        'px;">'
      );
    }
    var initials = (user.nickname || '?').slice(0, 2).toUpperCase();
    return (
      '<div class="msg-avatar" style="width:' +
      size +
      'px;height:' +
      size +
      'px;">' +
      escapeHtml(initials) +
      '</div>'
    );
  }

  // =========================================================================
  // INBOX MODE
  // =========================================================================

  var msgList = document.getElementById('msg-list');
  if (msgList && !window.__CONV_ID) {
    var currentPage = 1;

    async function loadInbox(page) {
      page = page || 1;
      try {
        var data = await api('GET', '/api/messages/conversations?page=' + page);
        renderInbox(data);
        currentPage = page;
      } catch (e) {
        msgList.innerHTML = '<div class="msg-empty">Chyba pri načítaní správ.</div>';
      }
    }

    function renderInbox(data) {
      var convs = data.conversations;
      if (!convs || convs.length === 0) {
        msgList.innerHTML =
          '<div class="msg-empty">' +
          '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3;margin-bottom:12px">' +
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
          '<div>Zatiaľ žiadne správy</div>' +
          '<div style="font-size:12px;color:var(--text-subtle);margin-top:4px;">Začni novú konverzáciu tlačidlom vyššie.</div>' +
          '</div>';
        return;
      }

      // Total unread badge
      var totalUnread = convs.reduce(function (sum, c) {
        return sum + c.unread_count;
      }, 0);
      var badge = document.getElementById('msg-total-unread');
      if (badge) {
        if (totalUnread > 0) {
          badge.textContent = totalUnread + ' neprečítaných';
          badge.style.display = '';
        } else {
          badge.style.display = 'none';
        }
      }

      var html = '';
      for (var i = 0; i < convs.length; i++) {
        var c = convs[i];
        var other = c.other_user;
        var name = other ? escapeHtml(other.nickname) : 'Neznámy';
        var isUnread = c.unread_count > 0;
        var typeLabel = '';
        if (c.type === 'broadcast')
          typeLabel = '<span class="msg-type-badge msg-type-broadcast">Systém</span>';
        if (c.type === 'contact')
          typeLabel = '<span class="msg-type-badge msg-type-contact">Kontakt</span>';

        var lastMsg = '';
        if (c.last_message) {
          var prefix = c.last_message.is_mine ? 'Ty: ' : '';
          lastMsg = prefix + escapeHtml(c.last_message.content);
        }

        html +=
          '<a href="/spravy/' +
          c.id +
          '" class="msg-item' +
          (isUnread ? ' msg-item-unread' : '') +
          '">' +
          '<div class="msg-item-avatar">' +
          avatarHtml(other) +
          '</div>' +
          '<div class="msg-item-body">' +
          '<div class="msg-item-top">' +
          '<span class="msg-item-name">' +
          name +
          '</span>' +
          typeLabel +
          (isUnread ? '<span class="msg-item-unread-dot"></span>' : '') +
          '</div>' +
          '<div class="msg-item-preview">' +
          lastMsg +
          '</div>' +
          '</div>' +
          '<div class="msg-item-time">' +
          (c.last_message ? timeAgo(c.last_message.created_at) : '') +
          '</div>' +
          '</a>';
      }

      msgList.innerHTML = html;

      // Pagination
      var pag = data.pagination;
      var pagEl = document.getElementById('msg-pagination');
      if (pagEl && pag.total > pag.perPage) {
        var totalPages = Math.ceil(pag.total / pag.perPage);
        var pagHtml = '';
        for (var p = 1; p <= totalPages; p++) {
          pagHtml +=
            '<button class="cmt-page-btn' +
            (p === pag.page ? ' cmt-page-active' : '') +
            '" data-page="' +
            p +
            '">' +
            p +
            '</button>';
        }
        pagEl.innerHTML = pagHtml;
      } else if (pagEl) {
        pagEl.innerHTML = '';
      }
    }

    // Pagination clicks
    var pagEl = document.getElementById('msg-pagination');
    if (pagEl) {
      pagEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-page]');
        if (btn) loadInbox(parseInt(btn.dataset.page, 10));
      });
    }

    // New message modal
    var newBtn = document.getElementById('msg-new-btn');
    var modal = document.getElementById('msg-new-modal');
    var closeBtn = document.getElementById('msg-modal-close');
    var cancelBtn = document.getElementById('msg-cancel-btn');
    var sendBtn = document.getElementById('msg-send-btn');
    var recipientInput = document.getElementById('msg-recipient');
    var contentInput = document.getElementById('msg-new-content');
    var errorEl = document.getElementById('msg-new-error');
    var autocompleteEl = document.getElementById('msg-autocomplete');

    function openModal() {
      modal.style.display = 'flex';
      recipientInput.focus();
    }
    function closeModal() {
      modal.style.display = 'none';
      recipientInput.value = '';
      contentInput.value = '';
      errorEl.style.display = 'none';
      autocompleteEl.innerHTML = '';
    }

    if (newBtn) newBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modal)
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });

    // Autocomplete
    var searchTimeout;
    if (recipientInput) {
      recipientInput.addEventListener('input', function () {
        clearTimeout(searchTimeout);
        var q = recipientInput.value.trim();
        if (q.length < 2) {
          autocompleteEl.innerHTML = '';
          return;
        }
        searchTimeout = setTimeout(async function () {
          var data = await api('GET', '/api/messages/users/search?q=' + encodeURIComponent(q));
          if (!data.users || data.users.length === 0) {
            autocompleteEl.innerHTML = '<div class="msg-ac-empty">Žiadne výsledky</div>';
            return;
          }
          autocompleteEl.innerHTML = data.users
            .map(function (u) {
              return (
                '<div class="msg-ac-item" data-nickname="' +
                escapeHtml(u.nickname) +
                '">' +
                avatarHtml(u, 28) +
                '<span>' +
                escapeHtml(u.nickname) +
                '</span>' +
                (u.role !== 'reader' ? '<span class="msg-ac-role">' + u.role + '</span>' : '') +
                '</div>'
              );
            })
            .join('');
        }, 300);
      });

      autocompleteEl.addEventListener('click', function (e) {
        var item = e.target.closest('[data-nickname]');
        if (item) {
          recipientInput.value = item.dataset.nickname;
          autocompleteEl.innerHTML = '';
        }
      });
    }

    // Send new message
    if (sendBtn) {
      sendBtn.addEventListener('click', async function () {
        var recipient = recipientInput.value.trim();
        var content = contentInput.value.trim();
        if (!recipient) {
          showError(errorEl, 'Zadaj príjemcu.');
          return;
        }
        if (!content) {
          showError(errorEl, 'Napíš správu.');
          return;
        }

        sendBtn.disabled = true;
        try {
          var data = await api('POST', '/api/messages/conversations', {
            recipient: recipient,
            content: content,
          });
          if (data.error) {
            showError(errorEl, data.error);
            return;
          }
          window.location.href = '/spravy/' + data.conversation_id;
        } catch (e) {
          showError(errorEl, 'Nepodarilo sa odoslať správu.');
        } finally {
          sendBtn.disabled = false;
        }
      });
    }

    function showError(el, msg) {
      el.textContent = msg;
      el.style.display = '';
    }

    loadInbox(1);
  }

  // =========================================================================
  // CONVERSATION MODE
  // =========================================================================

  var convId = window.__CONV_ID;
  var convMessages = document.getElementById('conv-messages');

  if (convId && convMessages) {
    var convPage = 1;
    var convData = null;

    async function loadConversation(page) {
      page = page || 1;
      try {
        var data = await api('GET', '/api/messages/conversations/' + convId + '?page=' + page);
        if (data.error) {
          convMessages.innerHTML = '<div class="msg-empty">' + escapeHtml(data.error) + '</div>';
          return;
        }
        convData = data;
        convPage = page;
        renderConversation(data);
      } catch (e) {
        convMessages.innerHTML = '<div class="msg-empty">Chyba pri načítaní.</div>';
      }
    }

    function renderConversation(data) {
      var conv = data.conversation;
      var msgs = data.messages;
      var other = conv.other_user;

      // Update header
      var headerUser = document.getElementById('conv-user-info');
      var breadcrumb = document.getElementById('conv-breadcrumb');
      if (other) {
        headerUser.innerHTML =
          avatarHtml(other, 36) +
          '<div class="conv-header-details">' +
          '<span class="conv-header-name">' +
          escapeHtml(other.nickname) +
          '</span>' +
          (other.role !== 'reader'
            ? '<span class="conv-header-role">' + other.role + '</span>'
            : '') +
          '</div>';
        breadcrumb.textContent = other.nickname;
      } else {
        headerUser.innerHTML = '<span>Konverzácia</span>';
      }

      // Render messages
      if (!msgs || msgs.length === 0) {
        convMessages.innerHTML = '<div class="msg-empty">Zatiaľ žiadne správy.</div>';
        return;
      }

      var html = '';
      var lastDate = '';
      for (var i = 0; i < msgs.length; i++) {
        var m = msgs[i];

        // Date separator
        var msgDate = new Date(m.created_at).toLocaleDateString('sk-SK', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        if (msgDate !== lastDate) {
          html += '<div class="conv-date-sep">' + escapeHtml(msgDate) + '</div>';
          lastDate = msgDate;
        }

        var isMine = m.sender_id && m.sender_nickname && other && m.sender_id !== other.user_id;
        var isSystem = m.is_system;

        if (isSystem) {
          html +=
            '<div class="conv-msg conv-msg-system">' +
            '<div class="conv-msg-content">' +
            escapeHtml(m.content) +
            '</div>' +
            '<div class="conv-msg-time">' +
            formatDate(m.created_at) +
            '</div>' +
            '</div>';
        } else {
          html +=
            '<div class="conv-msg ' +
            (isMine ? 'conv-msg-mine' : 'conv-msg-other') +
            '">' +
            (isMine ? '' : '<div class="conv-msg-avatar">' + avatarHtml(other, 32) + '</div>') +
            '<div class="conv-msg-bubble">' +
            '<div class="conv-msg-content">' +
            escapeHtml(m.content) +
            '</div>' +
            (m.image_path
              ? '<img class="conv-msg-image" src="/uploads/' +
                escapeHtml(m.image_path) +
                '" alt="Príloha">'
              : '') +
            '<div class="conv-msg-time">' +
            formatDate(m.created_at) +
            '</div>' +
            '</div>' +
            '</div>';
        }
      }

      convMessages.innerHTML = html;
      convMessages.scrollTop = convMessages.scrollHeight;
    }

    // Reply
    var replyText = document.getElementById('conv-reply-text');
    var replySend = document.getElementById('conv-reply-send');
    var replyError = document.getElementById('conv-reply-error');

    if (replySend) {
      replySend.addEventListener('click', sendReply);
    }
    if (replyText) {
      replyText.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendReply();
        }
      });
    }

    async function sendReply() {
      var content = replyText.value.trim();
      if (!content) return;

      replySend.disabled = true;
      replyError.style.display = 'none';

      try {
        var data = await api('POST', '/api/messages/conversations/' + convId + '/messages', {
          content: content,
        });
        if (data.error) {
          replyError.textContent = data.error;
          replyError.style.display = '';
          return;
        }
        replyText.value = '';
        loadConversation(1);
      } catch (e) {
        replyError.textContent = 'Nepodarilo sa odoslať.';
        replyError.style.display = '';
      } finally {
        replySend.disabled = false;
      }
    }

    // Polling — každých 15s
    loadConversation(1);
    setInterval(function () {
      loadConversation(1);
    }, 15000);
  }
})();
