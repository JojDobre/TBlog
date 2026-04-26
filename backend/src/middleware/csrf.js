/**
 * CSRF middleware (csrf-csrf, double-submit cookie pattern)
 *
 * V Phase 1.3 ešte nemontujeme — formuláre prídu vo Phase 2.
 * Tento súbor exportuje konfiguráciu, ktorá sa neskôr aplikuje
 * cez `csrfProtection` na router/route.
 *
 * Použitie (v neskorších fázach):
 *   const { csrfProtection, generateToken } = require('./middleware/csrf');
 *   router.post('/login', csrfProtection, loginHandler);
 *   // v GET handlere ktorý renderuje login formulár:
 *   res.render('login', { csrfToken: generateToken(req, res) });
 *
 * Pozn.: vyžaduje cookie-parser pred ním (mountnutý v app.js).
 */

'use strict';

const { doubleCsrf } = require('csrf-csrf');
const config = require('../../../config');

const {
  invalidCsrfTokenError,
  generateToken,
  validateRequest,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => config.session.secret,
  getSessionIdentifier: (req) => req.sessionID || 'anonymous',
  cookieName: config.app.isProd ? '__Host-bytezone.csrf' : 'bytezone.csrf',
  cookieOptions: {
    sameSite: 'lax',
    secure: config.session.secure,
    httpOnly: true,
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) =>
    req.headers['x-csrf-token'] || (req.body && req.body._csrf),
});

module.exports = {
  csrfProtection: doubleCsrfProtection,
  generateToken,
  validateRequest,
  invalidCsrfTokenError,
};
