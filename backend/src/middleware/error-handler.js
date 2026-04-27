/**
 * Error handler — finálny middleware (4 argumenty!).
 *
 * Logguje chybu a podľa cesty + Accept hlavičky vráti:
 *   - JSON (pre /api/* a XHR)
 *   - admin 500 stránku (pre /admin/*)
 *   - public 500 stránku (inak)
 *
 * DÔLEŽITÉ: error handler môže byť volaný aj keď chyba prišla v skoršom
 * middleware (pred attachUser, setCsrfToken alebo locals injection).
 * V takom prípade res.locals nemá nastavené veci ako csrfToken, user,
 * appName atď., ktoré naše šablóny očakávajú. Preto pred renderom
 * defensívne nastavíme všetko na bezpečné defaulty.
 */

'use strict';

const log = require('../logger');
const config = require('../../../config');

function ensureLocals(req, res) {
  const l = res.locals;
  if (l.appName === undefined) l.appName = config.app.name;
  if (l.currentPath === undefined) l.currentPath = req.path;
  if (l.isDev === undefined) l.isDev = config.app.isDev;
  if (l.user === undefined) l.user = null;
  if (l.csrfToken === undefined) l.csrfToken = '';
}

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

  // Doplniť defaulty pre šablóny — chyba mohla prísť pred middleware ktorý
  // tieto hodnoty bežne nastavuje
  ensureLocals(req, res);

  const title = status >= 500 ? 'Chyba servera' : 'Chyba';
  const message =
    status >= 500 ? 'Niečo sa pokazilo. Skús to znova.' : err.message;
  const stack = config.app.isDev ? err.stack : null;

  if (req.accepts('html')) {
    const view = req.path.startsWith('/admin')
      ? 'admin/errors/500'
      : 'errors/500';

    // Render s try/catch — ak by aj samotný render zlyhal, stále vrátime
    // niečo zmysluplné namiesto výchozieho EJS error page
    try {
      return res.render(view, {
        title,
        status,
        message,
        stack,
      });
    } catch (renderErr) {
      log.error('Error page render itself failed', {
        view,
        err: renderErr.message,
      });
      // posledná záchrana — plain HTML
      return res
        .type('html')
        .send(
          `<!doctype html><html lang="sk"><meta charset="utf-8">
          <title>Chyba</title>
          <body style="font-family:sans-serif;max-width:720px;margin:4rem auto;padding:0 1.5rem">
          <h1>${status} ${title}</h1>
          <p>${message}</p>
          ${stack ? `<pre style="background:#f6f8fa;padding:1rem;border-radius:8px;overflow:auto">${escapeHtml(stack)}</pre>` : ''}
          <p><a href="/">← Späť na úvod</a></p>
          </body></html>`
        );
    }
  }

  res.type('txt').send(`Error ${status}`);
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
