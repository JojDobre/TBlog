// Google Consent Mode v2 — musí bežať PRED analytics scriptom
// Načítava sa SYNCHRONNE (bez defer) v head.ejs
(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    dataLayer.push(arguments);
  }
  // Ak gtag ešte neexistuje globálne, vytvor
  if (!window.gtag) window.gtag = gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
  });

  // Ak už má uložený súhlas, updatni hneď
  var c = localStorage.getItem('bz_consent');
  if (c === 'all') {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted',
    });
  } else if (c === 'necessary') {
    gtag('consent', 'update', {
      analytics_storage: 'granted',
    });
  }
})();
