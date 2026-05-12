/**
 * Bytezone — Notifications bell dropdown
 *
 * Hookuje sa na:
 *   [data-notif-bell]     — button zvončeka
 *   [data-notif-badge]    — badge s počtom
 *   [data-notif-dropdown] — dropdown panel
 *   [data-notif-list]     — kontajner pre položky
 *
 * Polling: každých 60s kontroluje počet neprečítaných.
 * Klik na zvonček: načíta posledných 20 notifikácií.
 */

(function () {
  'use strict';

  var bell = document.querySelector('[data-notif-bell]');
  if (!bell) return;

  var badge = document.querySelector('[data-notif-badge]');
  var dropdown = document.querySelector('[data-notif-dropdown]');
  var listEl = document.querySelector('[data-notif-list]');
  var csrf = document.querySelector('[data-comments-section]');
  var csrfToken = csrf ? csrf.getAttribute('data-csrf') : '';

  // Fallback: hľadaj CSRF v meta tagu
  if (!csrfToken) {
    var meta = document.querySelector('meta[name="csrf-token"]');
    csrfToken = meta ? meta.getAttribute('content') : '';
  }

  var isOpen = false;
  var POLL_INTERVAL = 60000;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
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

  // ---------------------------------------------------------------------------
  // Badge
  // ---------------------------------------------------------------------------

  function updateBadge(count) {
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  async function pollCount() {
    try {
      var data = await api('GET', '/api/notifications/count', null);
      updateBadge(data.count || 0);
    } catch (e) {
      /* ticho */
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function iconForType(type) {
    if (type === 'comment_reply') {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    }
    if (type === 'comment_like') {
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    }
    return '';
  }

  function renderItem(n) {
    var cls = 'notif-item' + (n.is_read ? '' : ' notif-unread');
    var href = n.url || '#';
    return (
      '<a href="' +
      href +
      '" class="' +
      cls +
      '" data-notif-id="' +
      n.id +
      '">' +
      '<span class="notif-icon">' +
      iconForType(n.type) +
      '</span>' +
      '<div class="notif-body">' +
      '<span class="notif-message">' +
      escapeHtml(n.message) +
      '</span>' +
      '<span class="notif-time">' +
      timeAgo(n.created_at) +
      '</span>' +
      '</div>' +
      '</a>'
    );
  }

  async function loadNotifications() {
    if (!listEl) return;
    listEl.innerHTML = '<div class="notif-loading">Načítavam...</div>';

    try {
      var data = await api('GET', '/api/notifications', null);
      if (!data.items || data.items.length === 0) {
        listEl.innerHTML = '<div class="notif-empty">Žiadne notifikácie</div>';
        return;
      }
      listEl.innerHTML = data.items.map(renderItem).join('');
    } catch (e) {
      listEl.innerHTML = '<div class="notif-empty">Chyba pri načítaní</div>';
    }
  }

  async function markAllRead() {
    try {
      await api('POST', '/api/notifications/read', {});
      updateBadge(0);
      // Označíme vizuálne
      if (listEl) {
        listEl.querySelectorAll('.notif-unread').forEach(function (el) {
          el.classList.remove('notif-unread');
        });
      }
    } catch (e) {
      /* ticho */
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle dropdown
  // ---------------------------------------------------------------------------

  function openDropdown() {
    if (!dropdown) return;
    dropdown.classList.add('notif-open');
    isOpen = true;
    loadNotifications();
    markAllRead();
  }

  function closeDropdown() {
    if (!dropdown) return;
    dropdown.classList.remove('notif-open');
    isOpen = false;
  }

  bell.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) closeDropdown();
    else openDropdown();
  });

  // Klik mimo dropdown ho zatvorí
  document.addEventListener('click', function (e) {
    if (isOpen && !dropdown.contains(e.target) && !bell.contains(e.target)) {
      closeDropdown();
    }
  });

  // Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeDropdown();
  });

  // Klik na notifikáciu — označ ako prečítanú
  if (listEl) {
    listEl.addEventListener('click', function (e) {
      var item = e.target.closest('[data-notif-id]');
      if (item) {
        var id = item.getAttribute('data-notif-id');
        api('POST', '/api/notifications/' + id + '/read', {});
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Init + polling
  // ---------------------------------------------------------------------------

  pollCount();
  setInterval(pollCount, POLL_INTERVAL);
})();
