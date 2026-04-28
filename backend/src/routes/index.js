/**
 * Routes index
 *
 * Phase 4.1 update: pribudli admin-rubrics a admin-tags routes.
 *
 * Poradie mountovania:
 *   - špecifické /admin/<resource> idú PRED /admin
 *     (lebo /admin má catchall 404 fallback)
 *   - všetky public auth/profile routes
 *   - home a dev posledné
 */

'use strict';

const express = require('express');

const adminRouter = require('./admin');
const adminMediaRouter = require('./admin-media');
const adminRubricsRouter = require('./admin-rubrics');
const adminTagsRouter = require('./admin-tags');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const healthRouter = require('./health');
const config = require('../../../config');

const router = express.Router();

// ---------------------------------------------------------------------------
// Špecifické admin prefixy — MUSIA ísť pred generickým /admin
// ---------------------------------------------------------------------------
router.use('/admin/media', adminMediaRouter);
router.use('/admin/rubrics', adminRubricsRouter);
router.use('/admin/tags', adminTagsRouter);

// ---------------------------------------------------------------------------
// Generický /admin (login, dashboard, fallback 404)
// ---------------------------------------------------------------------------
router.use('/admin', adminRouter);

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
router.use('/health', healthRouter);

// ---------------------------------------------------------------------------
// Public auth + profil (v koreni)
// ---------------------------------------------------------------------------
router.use('/', authRouter);
router.use('/', profileRouter);

// ---------------------------------------------------------------------------
// Home + dev welcome
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  res.render('home/index', {
    title: null,
    currentPath: req.path,
  });
});

router.get('/dev', (req, res) => {
  res.render('_dev/welcome', {
    title: config.app.name + ' — Debug',
    appName: config.app.name,
    env: config.app.env,
    nodeVersion: process.version,
    serverTime: new Date().toISOString(),
  });
});

module.exports = router;
