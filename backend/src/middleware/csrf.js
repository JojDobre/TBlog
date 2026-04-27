/**
 * CSRF middleware (csrf-csrf, double-submit cookie pattern)
 *
 * Aktivované od Phase 2.1. Mounted v app.js takto:
 *
 *   app.use(setCsrfToken);     // res.locals.csrfToken — pre views
 *   app.use(csrfProtection);   // validuje POSTs/PUTs/DELETEs
 *
 * V šablónach formulárov:
 *   <input type="hidden" name="_csrf" value="<%= csrfToken %>">
 *
 * Token sa berie z req.body._csrf alebo z hlavičky X-CSRF-Token.
 *
 * Vyžaduje cookie-parser PRED touto middleware-ou (mount v app.js).
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

/**
 * Middleware: pridá `csrfToken` do res.locals aby ho EJS šablóny mohli
 * jednoducho includnúť do formulárov bez extra logiky v handleroch.
 *
 * Volá generateToken s validateOnReuse=false — ak má prehliadač starú
 * CSRF cookie z predošlej session (napr. po session.regenerate() pri logine),
 * defaultné správanie csrf-csrf by hodilo invalidCsrfTokenError. Toto by
 * sa pri každom GET requeste spotrebiteľa zmenilo na 403 chybu, čo nechceme.
 *
 * S validateOnReuse=false sa stale cookie ticho nahradí novou, čo je presne
 * to, čo potrebujeme — sessionID sa zmenilo, takže predošlý token je
 * legitímne neplatný a treba vygenerovať nový.
 */
function setCsrfToken(req, res, next) {
  res.locals.csrfToken = generateToken(req, res, false, false);
  next();
}

module.exports = {
  csrfProtection: doubleCsrfProtection,
  setCsrfToken,
  generateToken,
  validateRequest,
  invalidCsrfTokenError,
};
