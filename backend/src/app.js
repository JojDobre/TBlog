/**
 * Express app builder
 *
 * Oddelený od server.js (ktorý spúšťa HTTP listener) — testovať app
 * cez supertest sa potom dá bez bindovania portu.
 *
 * Poradie middleware je zámerné, NEMENIŤ bez rozmýšľania:
 *
 *   1. trust proxy
 *   2. view engine
 *   3. compression
 *   4. helmet (security headers)
 *   5. body parsers (JSON, urlencoded)
 *   6. cookie-parser              — PRED session a CSRF
 *   7. session                    — PRED CSRF a attachUser
 *   8. morgan logging
 *   9. static files
 *   10. attachUser                — req.user, res.locals.user (PO session)
 *   11. setCsrfToken              — res.locals.csrfToken
 *   12. csrfProtection            — validácia POSTs (PO body parser, session)
 *   13. locals (appName, currentPath, isDev)
 *   14. track-visit
 *   15. routes
 *   16. 404 handler
 *   17. error handler             — finálny, MUSÍ mať 4 argumenty
 */

'use strict';

const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const db = require('./db');

const config = require('../../config');
const log = require('./logger');

const buildSecurity = require('./middleware/security');
const buildSession = require('./middleware/session');
const { attachUser } = require('./middleware/auth');
const { setCsrfToken, csrfProtection } = require('./middleware/csrf');
const trackVisit = require('./middleware/track-visit');
const notFoundHandler = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');
const routes = require('./routes');

function createApp() {
  const app = express();

  // 1. Trust proxy
  if (config.app.trustProxy) {
    app.set('trust proxy', 1);
  }

  // 2. View engine
  app.set('view engine', 'ejs');
  app.set('views', [config.paths.frontendViews, config.paths.adminViews]);

  // 3. Compression
  app.use(compression());

  // 4. Security headers
  app.use(buildSecurity());

  // 5. Body parsers (PRED CSRF — csrf-csrf číta token z req.body)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // 6. Cookies
  app.use(cookieParser());

  // 7. Session
  app.use(buildSession());

  // 8. Request logging
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

  // 9. Static files
  app.use(
    '/admin/static',
    express.static(config.paths.adminPublic, {
      maxAge: config.app.isProd ? '1d' : 0,
    })
  );
  app.use(
    '/uploads',
    express.static(config.paths.uploads, {
      maxAge: config.app.isProd ? '7d' : 0,
      immutable: config.app.isProd,
      fallthrough: true,
    })
  );
  app.use(
    express.static(config.paths.frontendPublic, {
      maxAge: config.app.isProd ? '1d' : 0,
    })
  );

  // 10. Auth — načíta usera zo session
  app.use(attachUser);

  // 11. CSRF token do res.locals (pre formuláre v šablónach)
  app.use(setCsrfToken);

  // 12. CSRF validácia (POST/PUT/DELETE/PATCH)
  app.use(csrfProtection);

  // 13. Ostatné locals — appName, currentPath, isDev, headerPages, siteSettings
  let _headerPagesCache = null;
  let _footerPagesCache = null;
  let _headerPagesCacheAt = 0;
  const HEADER_CACHE_TTL = 60000; // 60s

  // Settings cache (global for clearing from admin route)
  global.__bzSettingsCache = null;
  let _settingsCacheAt = 0;

  async function loadSettings() {
    const now = Date.now();
    if (global.__bzSettingsCache && now - _settingsCacheAt < HEADER_CACHE_TTL)
      return global.__bzSettingsCache;
    try {
      const rows = await db('settings').select('key', 'value', 'value_type');
      const s = {};
      for (const r of rows) {
        if (r.value_type === 'int') s[r.key] = r.value ? parseInt(r.value, 10) : null;
        else if (r.value_type === 'bool') s[r.key] = r.value === '1';
        else s[r.key] = r.value || '';
      }
      global.__bzSettingsCache = s;
      _settingsCacheAt = now;
      return s;
    } catch (e) {
      return global.__bzSettingsCache || {};
    }
  }

  app.use(async (req, res, next) => {
    // Load settings for all routes (including admin)
    const settings = await loadSettings();
    res.locals.siteSettings = settings;
    res.locals.appName = settings.site_title || config.app.name;
    res.locals.currentPath = req.path;
    res.locals.isDev = config.app.isDev;

    // Skip pre admin/api/static
    if (
      req.path.startsWith('/admin') ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads')
    ) {
      res.locals.headerPages = [];
      return next();
    }

    try {
      const now = Date.now();
      if (!_headerPagesCache || now - _headerPagesCacheAt > HEADER_CACHE_TTL) {
        _headerPagesCache = await db('pages')
          .where('status', 'published')
          .where('show_in_header', true)
          .select('title', 'slug')
          .orderBy('title');
        _footerPagesCache = await db('pages')
          .where('status', 'published')
          .where('show_in_footer', true)
          .select('title', 'slug')
          .orderBy('title');
        _headerPagesCacheAt = now;
      }
      res.locals.headerPages = _headerPagesCache;
      res.locals.footerPages = _footerPagesCache || [];
    } catch (e) {
      res.locals.headerPages = [];
      res.locals.footerPages = [];
    }
    next();
  });

  // 14. Visit tracking
  app.use(trackVisit);

  // 15. Routes
  app.use(routes);

  // 16. 404 handler
  app.use(notFoundHandler);

  // 17. Error handler — MUSÍ mať 4 argumenty
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
