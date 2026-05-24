/**
 * ByteZone — Frontend JS (Phase 6.1)
 *
 * Hero slider: auto-rotácia každých 6.5s, dot navigation, arrows.
 */

(function () {
  'use strict';

  var slider = document.querySelector('[data-hero-slider]');
  if (!slider) return;

  var slides = slider.querySelectorAll('.hero-slide');
  var dots = slider.querySelectorAll('[data-slide-dot]');
  var prevBtn = slider.querySelector('[data-slide-prev]');
  var nextBtn = slider.querySelector('[data-slide-next]');

  if (slides.length <= 1) return;

  var current = 0;
  var interval = null;
  var DELAY = 6500;

  function goTo(idx) {
    slides[current].classList.remove('hero-slide--active');
    dots[current].classList.remove('active');

    current = ((idx % slides.length) + slides.length) % slides.length;

    slides[current].classList.add('hero-slide--active');
    dots[current].classList.add('active');
  }

  function next() {
    goTo(current + 1);
  }
  function prev() {
    goTo(current - 1);
  }

  function startAuto() {
    stopAuto();
    interval = setInterval(next, DELAY);
  }

  function stopAuto() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  // Dot clicks
  dots.forEach(function (dot) {
    dot.addEventListener('click', function (e) {
      e.stopPropagation();
      var idx = Number(dot.getAttribute('data-slide-dot'));
      goTo(idx);
      startAuto(); // reset timer
    });
  });

  // Arrow clicks
  if (prevBtn)
    prevBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      prev();
      startAuto();
    });
  if (nextBtn)
    nextBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      next();
      startAuto();
    });

  // Pause on hover, resume on leave
  slider.addEventListener('mouseenter', stopAuto);
  slider.addEventListener('mouseleave', startAuto);

  startAuto();

  // Carousel scroll buttons
  var track = document.querySelector('[data-carousel-track]');
  var prevC = document.querySelector('[data-carousel-prev]');
  var nextC = document.querySelector('[data-carousel-next]');
  if (track && prevC && nextC) {
    prevC.addEventListener('click', function () {
      track.scrollBy({ left: -340, behavior: 'smooth' });
    });
    nextC.addEventListener('click', function () {
      track.scrollBy({ left: 340, behavior: 'smooth' });
    });
  }
})();

// ---- Mobile menu ----
var burger = document.getElementById('nav-burger');
var mobileMenu = document.getElementById('mobile-menu');
var menuClose = document.getElementById('mobile-menu-close');

function toggleMenu(open) {
  if (!mobileMenu) return;
  var isOpen = typeof open === 'boolean' ? open : !mobileMenu.classList.contains('open');
  mobileMenu.classList.toggle('open', isOpen);
  document.body.classList.toggle('menu-open', isOpen);
}

if (burger)
  burger.addEventListener('click', function () {
    toggleMenu(true);
  });
if (menuClose)
  menuClose.addEventListener('click', function () {
    toggleMenu(false);
  });

// Mobile theme toggle
var mobileTheme = document.getElementById('mobile-theme-toggle');
if (mobileTheme) {
  mobileTheme.addEventListener('click', function () {
    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.click();
  });
}

// ---- Share button ----
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-share]');
  if (!btn) return;
  e.preventDefault();
  if (navigator.share) {
    navigator.share({ title: document.title, url: location.href });
  } else {
    navigator.clipboard.writeText(location.href).then(function () {
      var orig = btn.innerHTML;
      btn.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Skopírované!';
      setTimeout(function () {
        btn.innerHTML = orig;
      }, 2000);
    });
  }
});

// ---- Bookmark button (localStorage) ----
var BOOKMARKS_KEY = 'bz_bookmarks';

function getBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function isBookmarked(url) {
  return getBookmarks().some(function (b) {
    return b.url === url;
  });
}

function toggleBookmark(url, title) {
  var bookmarks = getBookmarks();
  var idx = bookmarks.findIndex(function (b) {
    return b.url === url;
  });
  if (idx > -1) {
    bookmarks.splice(idx, 1);
  } else {
    bookmarks.unshift({ url: url, title: title, saved_at: new Date().toISOString() });
    if (bookmarks.length > 100) bookmarks = bookmarks.slice(0, 100);
  }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  return idx === -1; // true = saved, false = removed
}

function updateBookmarkBtn(btn, saved) {
  var svg = btn.querySelector('svg');
  if (saved) {
    btn.classList.add('btn-bookmarked');
    if (svg) svg.setAttribute('fill', 'currentColor');
    btn.lastChild.textContent = ' Uložené';
  } else {
    btn.classList.remove('btn-bookmarked');
    if (svg) svg.setAttribute('fill', 'none');
    btn.lastChild.textContent = ' Uložiť';
  }
}

// ---- Bookmark (localStorage + DB pre prihlásených) ----
var BOOKMARKS_KEY = 'bz_bookmarks';
var isLoggedIn = !!document.querySelector('[data-notif-bell]');

function getLocalBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function isLocalBookmarked(url) {
  return getLocalBookmarks().some(function (b) {
    return b.url === url;
  });
}

function toggleLocalBookmark(url, title) {
  var bk = getLocalBookmarks();
  var idx = bk.findIndex(function (b) {
    return b.url === url;
  });
  if (idx > -1) {
    bk.splice(idx, 1);
  } else {
    bk.unshift({ url: url, title: title, saved_at: new Date().toISOString() });
  }
  if (bk.length > 100) bk = bk.slice(0, 100);
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bk));
  return idx === -1;
}

function updateBookmarkBtn(btn, saved) {
  var svg = btn.querySelector('svg');
  if (saved) {
    btn.classList.add('btn-bookmarked');
    if (svg) svg.setAttribute('fill', 'currentColor');
  } else {
    btn.classList.remove('btn-bookmarked');
    if (svg) svg.setAttribute('fill', 'none');
  }
  // Update text (last text node)
  var textNodes = [];
  btn.childNodes.forEach(function (n) {
    if (n.nodeType === 3 && n.textContent.trim()) textNodes.push(n);
  });
  if (textNodes.length > 0)
    textNodes[textNodes.length - 1].textContent = saved ? ' Uložené' : ' Uložiť';
}

// Init
document.querySelectorAll('[data-bookmark]').forEach(function (btn) {
  var articleId = btn.getAttribute('data-article-id');

  if (isLoggedIn && articleId) {
    // Check z DB
    fetch('/api/bookmarks/check?article_id=' + articleId, { credentials: 'same-origin' })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.saved) updateBookmarkBtn(btn, true);
      });
  } else {
    if (isLocalBookmarked(location.pathname)) updateBookmarkBtn(btn, true);
  }
});

// Click handler
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-bookmark]');
  if (!btn) return;
  e.preventDefault();
  var articleId = btn.getAttribute('data-article-id');

  if (isLoggedIn && articleId) {
    var csrf = document.querySelector('input[name="_csrf"]');
    fetch('/api/bookmarks/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf ? csrf.value : '' },
      credentials: 'same-origin',
      body: JSON.stringify({ article_id: Number(articleId) }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.ok) updateBookmarkBtn(btn, data.saved);
      });
  } else {
    var saved = toggleLocalBookmark(location.pathname, document.title);
    updateBookmarkBtn(btn, saved);
  }
});

// ---- Avatar remove ----
var avatarRm = document.querySelector('[data-avatar-remove]');
if (avatarRm) {
  avatarRm.addEventListener('click', function () {
    if (!window.confirm('Odstrániť avatar?')) return;
    var csrf = document.querySelector('input[name="_csrf"]');
    fetch('/profil/avatar/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf ? csrf.value : '',
      },
      credentials: 'same-origin',
    }).then(function () {
      location.reload();
    });
  });
}
