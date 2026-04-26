/**
 * Admin routes
 *
 * Phase 1.4 — len placeholdery, žiadny auth middleware ešte nebeží.
 * /admin              → redirect na dashboard
 * /admin/login        → render login form (POST vráti chybu „not yet")
 * /admin/dashboard    → render dashboard (zatiaľ bez auth)
 *
 * Vo Phase 2 sem pribudne authMiddleware (skontroluje session, presmeruje
 * na /admin/login ak nie je prihlásený), POST /login validation, atď.
 */

'use strict';

const express = require('express');
const db = require('../db');
const log = require('../logger');

const router = express.Router();

// /admin → /admin/dashboard
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

// ---------------------------------------------------------------------- login
router.get('/login', (req, res) => {
  res.render('admin/auth/login', {
    title: 'Prihlásenie',
    error: null,
    info: 'Prihlasovanie ešte nie je implementované (pribudne vo Phase 2).',
  });
});

router.post('/login', (req, res) => {
  // Phase 2 to nahradí skutočnou logikou
  res.status(501).render('admin/auth/login', {
    title: 'Prihlásenie',
    error: 'Auth ešte nie je implementovaný (Phase 2).',
    info: null,
  });
});

// ----------------------------------------------------------------- dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    // jednoduché počty pre stat cards — placeholder dáta z DB
    const [articles, comments, media, visits24h] = await Promise.all([
      db('articles').count({ c: '*' }).first().then((r) => Number(r.c)),
      db('comments').count({ c: '*' }).first().then((r) => Number(r.c)),
      db('media').count({ c: '*' }).first().then((r) => Number(r.c)),
      db('page_visits')
        .where('viewed_at', '>=', db.raw('NOW() - INTERVAL 1 DAY'))
        .count({ c: '*' })
        .first()
        .then((r) => Number(r.c)),
    ]);

    res.render('admin/dashboard/index', {
      title: 'Dashboard',
      currentPath: req.path,
      stats: { articles, comments, media, visits24h },
    });
  } catch (err) {
    log.error('admin/dashboard query failed', { err: err.message });
    next(err);
  }
});

// Záchytný handler pre admin URL ktoré ešte neexistujú —
// vyrenderuje admin 404 (s admin layoutom), nie public 404.
router.use((req, res) => {
  res.status(404).render('admin/errors/404', {
    title: 'Stránka nenájdená',
    currentPath: req.path,
    url: req.originalUrl,
  });
});

module.exports = router;
