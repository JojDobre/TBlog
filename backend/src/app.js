/**
 * Express app builder
 *
 * Oddelený od server.js (ktorý spúšťa HTTP listener) — testovať app
 * cez supertest sa potom dá bez bindovania portu.
 *
 * Poradie middleware je zámerné, NEMENIŤ bez rozmýšľania:
 *
 *   1. trust proxy            — aby req.ip bol správny za reverse proxy
 *   2. view engine            — EJS s 2 directories (frontend + admin)
 *   3. compression            — čo najskôr, aby sa všetko stláčalo
 *   4. helmet                 — security headers na response
 *   5. body-parser            — parse JSON/forms PRED routes
 *   6. cookie-parser          — PRED session a CSRF
 *   7. session                — PRED CSRF (CSRF id berie zo session)
 *   8. morgan                 — logging requestov
 *   9. static (admin, uploads, public)
 *   10. locals injection      — appName, currentPath, user pre views
 *   11. track-visit           — PO session, pred routes (chytí všetky GETs)
 *   12. routes                — naša aplikácia
 *   13. 404 handler           — chytí čo neprešlo cez routes
 *   14. error handler         — finálne, 4 args!
 */

'use strict';

const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

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
  // 1. Trust proxy
  // ---------------------------------------------------------------------------
  if (config.app.trustProxy) {
    app.set('trust proxy', 1);
  }

  // ---------------------------------------------------------------------------
  // 2. View engine — EJS
  // ---------------------------------------------------------------------------
  app.set('view engine', 'ejs');
  app.set('views', [
    config.paths.frontendViews, // frontend/views (verejné stránky)
    config.paths.adminViews,    // backend/src/views (admin)
  ]);

  // ---------------------------------------------------------------------------
  // 3. Compression
  // ---------------------------------------------------------------------------
  app.use(compression());

  // ---------------------------------------------------------------------------
  // 4. Security headers
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
  // 7. Request logging
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
      skip: (req) =>
        !config.app.isDev &&
        (req.path.startsWith('/uploads/') ||
          req.path.startsWith('/admin/static/') ||
          req.path.startsWith('/css/') ||
          req.path.startsWith('/js/')),
    })
  );

  // ---------------------------------------------------------------------------
  // 8. Static files
  // ---------------------------------------------------------------------------
  // Admin assets (CSS, JS) — /admin/static/*
  app.use(
    '/admin/static',
    express.static(config.paths.adminPublic, {
      maxAge: config.app.isProd ? '1d' : 0,
    })
  );

  // Verejne nahrané médiá
  app.use(
    '/uploads',
    express.static(config.paths.uploads, {
      maxAge: config.app.isProd ? '7d' : 0,
      immutable: config.app.isProd,
      fallthrough: true,
    })
  );

  // Frontend public (CSS, JS verejnej časti) — servuje sa z /
  app.use(
    express.static(config.paths.frontendPublic, {
      maxAge: config.app.isProd ? '1d' : 0,
    })
  );

  // ---------------------------------------------------------------------------
  // 9. Locals injection — premenné dostupné vo všetkých views
  // ---------------------------------------------------------------------------
  app.use((req, res, next) => {
    res.locals.appName = config.app.name;
    res.locals.currentPath = req.path;
    res.locals.user = req.session?.user || null; // Phase 2 ho nastaví
    res.locals.isDev = config.app.isDev;
    next();
  });

  // ---------------------------------------------------------------------------
  // 10. Visit tracking
  // ---------------------------------------------------------------------------
  app.use(trackVisit);

  // ---------------------------------------------------------------------------
  // 11. Routes
  // ---------------------------------------------------------------------------
  app.use(routes);

  // ---------------------------------------------------------------------------
  // 12. 404 handler
  // ---------------------------------------------------------------------------
  app.use(notFoundHandler);

  // ---------------------------------------------------------------------------
  // 13. Error handler — MUSÍ mať 4 argumenty
  // ---------------------------------------------------------------------------
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
