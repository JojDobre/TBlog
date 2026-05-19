/**
 * Banner tracking — automatické sledovanie zobrazení a kliknutí
 *
 * View: IntersectionObserver — banner musí byť viditeľný aspoň 1s (50% plochy)
 * Click: delegovaný listener na [data-banner-id] linky
 */
(function () {
  'use strict';

  var API = '/api/banners/track';
  var tracked = {};

  function send(bannerId, eventType) {
    var key = bannerId + ':' + eventType;
    if (eventType === 'view' && tracked[key]) return; // view len raz za pageload
    tracked[key] = true;

    var body = JSON.stringify({
      banner_id: bannerId,
      event_type: eventType,
      page_url: location.pathname,
      position_key: null,
    });

    if (navigator.sendBeacon) {
      navigator.sendBeacon(API, new Blob([body], { type: 'application/json' }));
    } else {
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body);
    }
  }

  // -----------------------------------------------------------------------
  // VIEW tracking — IntersectionObserver (50% viditeľné, 1s)
  // -----------------------------------------------------------------------
  var banners = document.querySelectorAll('[data-banner-id]');
  if (!banners.length) return;

  var timers = {};

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var el = entry.target;
          var id = el.getAttribute('data-banner-id');
          if (!id) return;

          if (entry.isIntersecting) {
            if (!timers[id]) {
              timers[id] = setTimeout(function () {
                send(id, 'view');
                timers[id] = null;
              }, 1000);
            }
          } else {
            if (timers[id]) {
              clearTimeout(timers[id]);
              timers[id] = null;
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    banners.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    // Fallback — track all as viewed immediately
    banners.forEach(function (el) {
      var id = el.getAttribute('data-banner-id');
      if (id) send(id, 'view');
    });
  }

  // -----------------------------------------------------------------------
  // CLICK tracking — delegovaný na celý dokument
  // -----------------------------------------------------------------------
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href]');
    if (!link) return;

    var bannerEl = link.closest('[data-banner-id]');
    if (!bannerEl) return;

    var id = bannerEl.getAttribute('data-banner-id');
    if (id) send(id, 'click');
  });
})();
