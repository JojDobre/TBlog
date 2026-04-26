/**
 * Health check route
 *
 * GET /health           — základný status, vždy 200 ak Express beží
 * GET /health/db        — pingne DB, 200/503 podľa výsledku
 *
 * Užitočné pre Docker healthcheck a externý monitoring.
 */

'use strict';

const express = require('express');
const db = require('../db');
const config = require('../../../config');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    name: config.app.name,
    env: config.app.env,
    uptime_sec: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

router.get('/db', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      db: 'disconnected',
      message: err.message,
    });
  }
});

module.exports = router;
