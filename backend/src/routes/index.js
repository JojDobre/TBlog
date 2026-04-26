/**
 * Routes index
 *
 * Všetky routes sa registrujú tu. V budúcnosti pribudnú ďalšie routery
 * (admin, api, články...).
 */

'use strict';

const express = require('express');
const config = require('../../../config');

const healthRouter = require('./health');

const router = express.Router();

// /health — Docker healthcheck + monitoring
router.use('/health', healthRouter);

// GET / — dev placeholder uvítacia stránka
router.get('/', (req, res) => {
  res.render('_dev/welcome', {
    title: config.app.name,
    appName: config.app.name,
    env: config.app.env,
    nodeVersion: process.version,
    serverTime: new Date().toISOString(),
  });
});

module.exports = router;
