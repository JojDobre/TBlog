/**
 * Routes index
 *
 * Phase 4.2 update: pribudol admin-categories.
 *
 * Špecifické /admin/<resource> idú PRED /admin (ktorý má catchall 404).
 */

'use strict';

const express = require('express');

const adminRouter = require('./admin');
const adminMediaRouter = require('./admin-media');
const adminRubricsRouter = require('./admin-rubrics');
const adminTagsRouter = require('./admin-tags');
const adminCategoriesRouter = require('./admin-categories');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const healthRouter = require('./health');
const config = require('../../../config');

const router = express.Router();

// Špecifické admin prefixy
router.use('/admin/media', adminMediaRouter);
router.use('/admin/rubrics', adminRubricsRouter);
router.use('/admin/tags', adminTagsRouter);
router.use('/admin/categories', adminCategoriesRouter);

// Generický /admin
router.use('/admin', adminRouter);

router.use('/health', healthRouter);
router.use('/', authRouter);
router.use('/', profileRouter);

router.get('/', (req, res) => {
  res.render('home/index', { title: null, currentPath: req.path });
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
