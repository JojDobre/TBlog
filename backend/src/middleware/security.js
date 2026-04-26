/**
 * Security middleware (helmet)
 *
 * Nastavuje bezpečnostné HTTP hlavičky.
 *
 * CSP poznámka:
 *   - povoľujeme jsdelivr.net (Bootstrap CSS/JS, Bootstrap Icons fonty)
 *   - inline štýly povolené (style atribúty, BS komponenty)
 *   - YouTube iframe pre embed videí
 *
 * Production roadmap: namiesto CDN bundlovať Bootstrap lokálne pod /admin/static.
 * Vtedy môžeme zo CSP odstrániť jsdelivr.net a sprísniť skript zdroje.
 */

'use strict';

const helmet = require('helmet');
const config = require('../../../config');

const JSDELIVR = 'https://cdn.jsdelivr.net';
const YOUTUBE = 'https://www.youtube.com';
const YOUTUBE_NOCOOKIE = 'https://www.youtube-nocookie.com';

module.exports = function buildSecurity() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", JSDELIVR],
        scriptSrcAttr: ["'none'"], // žiadne `onclick="..."`
        styleSrc: ["'self'", "'unsafe-inline'", JSDELIVR],
        styleSrcAttr: ["'unsafe-inline'"], // style="..." atribúty (Bootstrap ich miestami používa)
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'data:', JSDELIVR],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", YOUTUBE, YOUTUBE_NOCOOKIE],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.app.isProd ? [] : null,
      },
    },
    // HSTS len v produkcii
    strictTransportSecurity: config.app.isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: false }
      : false,
    crossOriginEmbedderPolicy: false, // YouTube embed by inak nefungoval
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
};
