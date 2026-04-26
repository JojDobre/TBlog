/**
 * Security middleware (helmet)
 *
 * Nastavuje bezpečnostné HTTP hlavičky.
 *
 * CSP poznámka: zatiaľ je rozumne otvorené — povoľujeme inline štýly
 * (lebo budeš používať vlastné CSS, niekedy aj inline style atribúty)
 * a YouTube iframe (kvôli embedu vo videách). V Phase 16 to ešte
 * pritvrdíme, hlavne pre /admin endpoint.
 */

'use strict';

const helmet = require('helmet');
const config = require('../../../config');

module.exports = function buildSecurity() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline pre style atribúty
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https:', 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
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
    // X-Frame-Options: SAMEORIGIN (vyplýva už z CSP frameAncestors, ale
    // helmet to dáva default)
    crossOriginEmbedderPolicy: false, // YouTube embed by inak nefungoval
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
};
