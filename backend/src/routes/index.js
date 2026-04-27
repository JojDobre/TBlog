/**
 * Routes index
 *
 *   /admin/*   → admin router
 *   /health    → health checks
 *   /register, /login, /logout, /forgot → public auth router
 *   /          → home page
 *   /dev       → debug welcome
 */

'use strict';

const express = require('express');

const adminRouter = require('./admin');
const authRouter = require('./auth');
const healthRouter = require('./health');
const config = require('../../../config');

const router = express.Router();

router.use('/admin', adminRouter);
router.use('/health', healthRouter);
router.use('/', authRouter);

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
