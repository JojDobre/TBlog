/**
 * CSRF middleware (csrf-csrf, double-submit cookie pattern)
 *
 * Phase 3.1 update:
 *   csrfProtection skipuje multipart/form-data requesty (multer parsuje
 *   body POSTeľne a globálny CSRF middleware by nenašiel _csrf v body).
 *   Konvencia: každý route handler ktorý prijíma multipart MUSÍ po
 *   multer-i zavolať validateRequest(req) na manuálnu validáciu.
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

function setCsrfToken(req, res, next) {
  res.locals.csrfToken = generateToken(req, res, false, false);
  next();
}

/**
 * Wrapper okolo doubleCsrfProtection — skipuje multipart requesty.
 * Multipart endpointy musia validovať manuálne pomocou validateRequest.
 */
function csrfProtection(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.toLowerCase().startsWith('multipart/form-data')) {
    return next();
  }
  return doubleCsrfProtection(req, res, next);
}

module.exports = {
  csrfProtection,
  setCsrfToken,
  generateToken,
  validateRequest,
  invalidCsrfTokenError,
};
