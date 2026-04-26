/**
 * 404 handler — koncový middleware, chytí všetko čo nezachytili routes.
 *
 * Pre /api/* vráti JSON, inak HTML stránku.
 */

'use strict';

module.exports = function notFoundHandler(req, res, _next) {
  res.status(404);

  if (req.path.startsWith('/api/')) {
    return res.json({ error: 'Not found', path: req.originalUrl });
  }

  // Ak prehliadač akceptuje HTML, vyrenderuj 404 stránku.
  if (req.accepts('html')) {
    return res.render('errors/404', {
      title: 'Stránka nenájdená',
      url: req.originalUrl,
    });
  }

  res.type('txt').send('Not found');
};
