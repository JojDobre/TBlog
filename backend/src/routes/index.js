/**
 * Routes index
 *
 * Mountuje všetky routes:
 *   /admin/*  →  admin router
 *   /health   →  health checks
 *   /         →  home page
 *   /dev      →  dev welcome (debug)
 */

'use strict';

const express = require('express');

const adminRouter = require('./admin');
const healthRouter = require('./health');
const config = require('../../../config');

const router = express.Router();

// Admin a health (špecifické prefixy najprv)
router.use('/admin', adminRouter);
router.use('/health', healthRouter);

// Home — verejná úvodná stránka
router.get('/', (req, res) => {
  res.render('home/index', {
    title: null, // bez prefixu v <title>
    currentPath: req.path,
  });
});

// Dev debug stránka (ostáva z Phase 1.3)
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
