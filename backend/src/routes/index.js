/**
 * Routes index
 *   /admin/media → admin media (mounted PRED /admin lebo má vlastný 404 fallback)
 *   /admin/*     → admin
 *   /health      → health checks
 *   /register, /login, /logout, /forgot → public auth
 *   /profil, /u/:nickname → profile
 *   /            → home
 *   /dev         → debug welcome
 */

'use strict';

const express = require('express');

const adminRouter = require('./admin');
const adminMediaRouter = require('./admin-media');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const healthRouter = require('./health');
const config = require('../../../config');

const router = express.Router();

router.use('/admin/media', adminMediaRouter);
router.use('/admin', adminRouter);
router.use('/health', healthRouter);
router.use('/', authRouter);
router.use('/', profileRouter);

router.get('/', (req, res) => {
  res.render('home/index', { title: null });
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
