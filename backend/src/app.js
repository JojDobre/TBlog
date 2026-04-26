/**
 * Express app builder
 *
 * Oddelený od server.js (ktorý spúšťa HTTP listener) — testovať app
 * cez supertest sa potom dá bez bindovania portu.
 *
 * Poradie middleware je zámerné, NEMENIŤ bez rozmýšľania:
 *
 *   1. trust proxy            — aby req.ip bol správny za reverse proxy
 *   2. compression            — čo najskôr, aby sa všetko stláčalo
 *   3. helmet                 — security headers na response
 *   4. body-parser            — parse JSON/forms PRED routes
 *   5. cookie-parser          — PRED session a CSRF
 *   6. session                — PRED CSRF (CSRF id berie zo session)
 *   7. morgan                 — logging requestov
 *   8. static (uploads, public)
 *   9. track-visit            — PO session, pred routes (chytí všetky GETs)
 *   10. routes                — naša aplikácia
 *   11. 404 handler           — chytí čo neprešlo cez routes
 *   12. error handler         — finálne, 4 args!
 */

'use strict';

const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const config = require('../../config');
const log = require('./logger');

const buildSecurity = require('./middleware/security');
const buildSession = require('./middleware/session');
const trackVisit = require('./middleware/track-visit');
const notFoundHandler = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');
const routes = require('./routes');

function createApp() {
  const app = express();

  // ---------------------------------------------------------------------------
  // 1. Trust proxy (ak sme za reverse proxy v produkcii)
  // ---------------------------------------------------------------------------
  if (config.app.trustProxy) {
    app.set('trust proxy', 1);
  }

  // ---------------------------------------------------------------------------
  // 2. View engine — EJS
  // ---------------------------------------------------------------------------
  app.set('view engine', 'ejs');
  app.set('views', [
    config.paths.frontendViews,
    // admin views pridáme v Phase 1.4
  ]);
  // odstránenie zbytočných whitespace vo výstupe
  app.set('view options', { rmWhitespace: false });

  // ---------------------------------------------------------------------------
  // 3. Compression (gzip)
  // ---------------------------------------------------------------------------
  app.use(compression());

  // ---------------------------------------------------------------------------
  // 4. Security headers (helmet)
  // ---------------------------------------------------------------------------
  app.use(buildSecurity());

  // ---------------------------------------------------------------------------
  // 5. Body parsers
  // ---------------------------------------------------------------------------
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // ---------------------------------------------------------------------------
  // 6. Cookies + session
  // ---------------------------------------------------------------------------
  app.use(cookieParser());
  app.use(buildSession());

  // ---------------------------------------------------------------------------
  // 7. Request logging (morgan → náš logger)
  // ---------------------------------------------------------------------------
  const morganFormat = config.app.isDev ? 'dev' : 'combined';
  app.use(
    morgan(morganFormat, {
      stream: {
        write: (line) => {
          const trimmed = line.trim();
          if (trimmed) log.debug(trimmed);
        },
      },
      // logujeme aj statiku v dev, v prod nie
      skip: (req) => !config.app.isDev && req.path.startsWith('/uploads/'),
    })
  );

  // ---------------------------------------------------------------------------
  // 8. Static files
  // ---------------------------------------------------------------------------
  // Verejne nahrané médiá
  app.use(
    '/uploads',
    express.static(config.paths.uploads, {
      maxAge: config.app.isProd ? '7d' : 0,
      immutable: config.app.isProd,
      fallthrough: true,
    })
  );

  // Frontend public (CSS, JS, statické obrázky webu)
  app.use(
    express.static(config.paths.frontendPublic, {
      maxAge: config.app.isProd ? '1d' : 0,
    })
  );

  // ---------------------------------------------------------------------------
  // 9. Visit tracking (zápis do page_visits)
  // ---------------------------------------------------------------------------
  app.use(trackVisit);

  // ---------------------------------------------------------------------------
  // 10. Routes
  // ---------------------------------------------------------------------------
  app.use(routes);

  // ---------------------------------------------------------------------------
  // 11. 404 handler — chytí všetko ostatné
  // ---------------------------------------------------------------------------
  app.use(notFoundHandler);

  // ---------------------------------------------------------------------------
  // 12. Error handler — finálny, MUSÍ mať 4 argumenty (err, req, res, next)
  // ---------------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
