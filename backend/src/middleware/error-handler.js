/**
 * Error handler — finálny middleware (4 argumenty!).
 *
 * Logguje chybu a podľa cesty + Accept hlavičky vráti:
 *   - JSON (pre /api/* a XHR)
 *   - admin 500 stránku (pre /admin/*)
 *   - public 500 stránku (inak)
 */

'use strict';

const log = require('../logger');
const config = require('../../../config');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  const logFn = status >= 500 ? log.error : log.warn;
  logFn('Request error', {
    status,
    method: req.method,
    path: req.originalUrl,
    err: err.message,
    stack: config.app.isDev ? err.stack : undefined,
  });

  res.status(status);

  if (req.path.startsWith('/api/') || req.xhr) {
    return res.json({
      error: status >= 500 ? 'Interná chyba servera' : err.message,
      ...(config.app.isDev && { stack: err.stack }),
    });
  }

  const title = status >= 500 ? 'Chyba servera' : 'Chyba';
  const message =
    status >= 500 ? 'Niečo sa pokazilo. Skús to znova.' : err.message;
  const stack = config.app.isDev ? err.stack : null;

  if (req.accepts('html')) {
    if (req.path.startsWith('/admin')) {
      return res.render('admin/errors/500', {
        title,
        currentPath: req.path,
        status,
        message,
        stack,
      });
    }
    return res.render('errors/500', {
      title,
      currentPath: req.path,
      status,
      message,
      stack,
    });
  }

  res.type('txt').send(`Error ${status}`);
};
