/**
 * Error handler — finálny middleware (4 argumenty!).
 *
 * Logguje chybu a podľa Accept hlavičky vráti HTML alebo JSON.
 * V dev režime ukáže stack trace, v prod len generickú správu.
 */

'use strict';

const log = require('../logger');
const config = require('../../../config');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  // niektoré errory majú vlastný status (napr. multer, csrf-csrf)
  const status = err.status || err.statusCode || 500;

  // logujeme všetky 5xx ako error, 4xx ako warn
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

  if (req.accepts('html')) {
    return res.render('errors/500', {
      title: status >= 500 ? 'Chyba servera' : 'Chyba',
      status,
      message: status >= 500 ? 'Niečo sa pokazilo. Skús to znova.' : err.message,
      stack: config.app.isDev ? err.stack : null,
    });
  }

  res.type('txt').send(`Error ${status}`);
};
