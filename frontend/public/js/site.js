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
    if (dots[current]) dots[current].classList.remove('active');

    current = ((idx % slides.length) + slides.length) % slides.length;

    slides[current].classList.add('hero-slide--active');
    if (dots[current]) dots[current].classList.add('active');
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

// === RVX Tabs (deep dive) ===
document.addEventListener('click', function (e) {
  var tab = e.target.closest('[data-rvx-tab]');
  if (!tab) return;
  var wrap = tab.closest('.rvx-tabs');
  if (!wrap) return;
  var idx = tab.getAttribute('data-rvx-tab');
  wrap.querySelectorAll('.rvx-tab').forEach(function (t) {
    t.classList.remove('active');
  });
  wrap.querySelectorAll('[data-rvx-pane]').forEach(function (p) {
    p.style.display = 'none';
  });
  tab.classList.add('active');
  var pane = wrap.querySelector('[data-rvx-pane="' + idx + '"]');
  if (pane) pane.style.display = '';
});

// === RVX FAQ accordion ===
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-rvx-faq]');
  if (!btn) return;
  var item = btn.closest('.rvx-faq-item');
  if (!item) return;
  var ans = item.querySelector('.rvx-faq-a');
  if (!ans) return;
  var isOpen = item.classList.contains('open');
  // Close all siblings
  var faq = item.closest('.rvx-faq');
  if (faq) {
    faq.querySelectorAll('.rvx-faq-item').forEach(function (fi) {
      fi.classList.remove('open');
      var a = fi.querySelector('.rvx-faq-a');
      if (a) a.style.display = 'none';
    });
  }
  if (!isOpen) {
    item.classList.add('open');
    ans.style.display = '';
  }
});

// === RVX Before/After compare drag slider ===
(function () {
  function initCompare(frame) {
    var handle = frame.querySelector('.rv-gal-cmp-handle');
    var after = frame.querySelector('.rv-gal-cmp-after');
    if (!handle || !after) return;
    var dragging = false;
    function setPos(x) {
      var rect = frame.getBoundingClientRect();
      var pct = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      handle.style.left = pct + '%';
      after.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
    }
    frame.addEventListener('mousedown', function (e) {
      dragging = true;
      setPos(e.clientX);
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (dragging) setPos(e.clientX);
    });
    document.addEventListener('mouseup', function () {
      dragging = false;
    });
    frame.addEventListener(
      'touchstart',
      function (e) {
        dragging = true;
        setPos(e.touches[0].clientX);
      },
      { passive: true }
    );
    document.addEventListener('touchmove', function (e) {
      if (dragging) setPos(e.touches[0].clientX);
    });
    document.addEventListener('touchend', function () {
      dragging = false;
    });
  }
  document.querySelectorAll('[data-rvx-compare]').forEach(initCompare);
  // Re-init for dynamically loaded content
  var obs = new MutationObserver(function () {
    document.querySelectorAll('[data-rvx-compare]:not([data-rvx-init])').forEach(function (f) {
      f.setAttribute('data-rvx-init', '1');
      initCompare(f);
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// === RVX Lightbox ===
(function () {
  var lightbox = null;
  var imgs = [];
  var idx = 0;

  function create() {
    if (lightbox) return;
    lightbox = document.createElement('div');
    lightbox.className = 'rv-lightbox';
    lightbox.innerHTML =
      '<img class="rv-lightbox-img" src=""><button class="rv-lightbox-close" aria-label="Zavrieť">✕</button><button class="rv-lightbox-nav rv-lightbox-prev" aria-label="Predchádzajúci">‹</button><button class="rv-lightbox-nav rv-lightbox-next" aria-label="Ďalší">›</button><span class="rv-lightbox-counter"></span>';
    document.body.appendChild(lightbox);
    lightbox.querySelector('.rv-lightbox-close').addEventListener('click', close);
    lightbox.querySelector('.rv-lightbox-prev').addEventListener('click', function () {
      go(-1);
    });
    lightbox.querySelector('.rv-lightbox-next').addEventListener('click', function () {
      go(1);
    });
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', function (e) {
      if (!lightbox || !lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    });
    // Swipe support
    var startX = 0;
    lightbox.addEventListener(
      'touchstart',
      function (e) {
        startX = e.touches[0].clientX;
      },
      { passive: true }
    );
    lightbox.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) {
        dx > 0 ? go(-1) : go(1);
      }
    });
  }

  // Položka môže byť string (legacy) alebo { m: mediumSrc, f: fullSrc }
  function norm(x) {
    if (typeof x === 'string') return { m: x, f: x };
    return { m: x.m || x.f, f: x.f || x.m };
  }

  function open(images, startIdx) {
    create();
    imgs = images.map(norm);
    idx = startIdx || 0;
    show();
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function () {
      lightbox.classList.add('active');
    });
  }

  function close() {
    if (!lightbox) return;
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(function () {
      lightbox.querySelector('.rv-lightbox-img').src = '';
    }, 250);
  }

  function go(dir) {
    idx = (idx + dir + imgs.length) % imgs.length;
    show();
  }

  function show() {
    if (!lightbox || !imgs.length) return;
    var entry = imgs[idx];
    var imgEl = lightbox.querySelector('.rv-lightbox-img');
    // Medium sa zobrazí okamžite (už je v cache zo stránky) …
    imgEl.src = entry.m;
    // … a plná kvalita sa donačíta na pozadí a vymení
    if (entry.f && entry.f !== entry.m) {
      var pre = new Image();
      pre.onload = function () {
        if (imgs[idx] === entry) imgEl.src = entry.f;
      };
      pre.src = entry.f;
    }
    lightbox.querySelector('.rv-lightbox-counter').textContent = idx + 1 + ' / ' + imgs.length;
    lightbox.querySelector('.rv-lightbox-prev').style.display = imgs.length > 1 ? '' : 'none';
    lightbox.querySelector('.rv-lightbox-next').style.display = imgs.length > 1 ? '' : 'none';
  }

  document.addEventListener('click', function (e) {
    // Grid gallery with "+N" — uses data-rvx-gallery-all for ALL images
    var gridItem = e.target.closest('[data-rvx-lightbox-grid]');
    if (gridItem) {
      e.preventDefault();
      var parent = gridItem.closest('[data-rvx-gallery-all]');
      if (!parent) return;
      try {
        var allImages = JSON.parse(parent.getAttribute('data-rvx-gallery-all'));
        var startIdx = parseInt(gridItem.getAttribute('data-rvx-lightbox-grid')) || 0;
        if (allImages.length) open(allImages, startIdx);
      } catch (err) {}
      return;
    }
    // Normal lightbox — collect from parent
    var item = e.target.closest('[data-rvx-lightbox]');
    if (!item) return;
    e.preventDefault();
    var parent2 = item.parentElement;
    var allItems = parent2.querySelectorAll('[data-rvx-lightbox]');
    var images = [];
    var startIdx2 = 0;
    allItems.forEach(function (el, i) {
      var img = el.querySelector('img');
      if (img) {
        images.push({
          m: img.currentSrc || img.src,
          f: img.getAttribute('data-full') || img.src,
        });
        if (el === item) startIdx2 = i;
      }
    });
    if (images.length) open(images, startIdx2);
  });
})();

// === Agresívnejšie prednačítanie lazy obrázkov ===
// Natívne loading="lazy" načítava len ~1-2 obrazovky dopredu. Tento observer
// prepne obrázky na eager už ~3 obrazovky pred viewportom, takže pri scrollovaní
// sú už načítané.
(function () {
  if (typeof IntersectionObserver === 'undefined') return;

  var margin = Math.round(window.innerHeight * 5) + 'px';
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var img = entry.target;
        img.loading = 'eager';
        io.unobserve(img);
      });
    },
    { rootMargin: margin + ' 0px ' + margin + ' 0px' }
  );

  function scan(root) {
    (root || document).querySelectorAll('img[loading="lazy"]').forEach(function (img) {
      io.observe(img);
    });
  }

  scan(document);

  // Obrázky pridané dynamicky (napr. komentáre, notifikácie)
  var mo = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) scan(node);
      });
    });
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
