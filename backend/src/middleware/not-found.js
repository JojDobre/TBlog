/**
 * 404 handler — koncový middleware, chytí všetko čo nezachytili routes.
 *
 * Pre /admin/* renderuje admin 404 (tmavý sidebar layout).
 * Pre /api/* vráti JSON.
 * Inak public 404 (verejný layout).
 *
 * Pozn.: admin router má svoj vlastný 404 fallback — sem sa dostane
 * len keď request neprešiel ani cez admin router (nezvyčajné).
 */

'use strict';

module.exports = function notFoundHandler(req, res, _next) {
  res.status(404);

  if (req.path.startsWith('/api/')) {
    return res.json({ error: 'Not found', path: req.originalUrl });
  }

  if (req.accepts('html')) {
    if (req.path.startsWith('/admin')) {
      return res.render('admin/errors/404', {
        title: 'Stránka nenájdená',
        currentPath: req.path,
        url: req.originalUrl,
      });
    }
    return res.render('errors/404', {
      title: 'Stránka nenájdená',
      currentPath: req.path,
      url: req.originalUrl,
    });
  }

  res.type('txt').send('Not found');
};
