/**
 * Rate limit middleware
 *
 * Konfigurované limitery, ktoré sa aplikujú v príslušných fázach:
 *   - loginLimiter: na /admin/login a /login (max 5 / 15 min na IP)
 *   - apiLimiter:   na /api/* (max 100 / 1 min na IP)
 *
 * V Phase 1.3 ešte nemountnuté.
 *
 * Pozn.: Default store je in-memory, čo na single-instance setup stačí.
 * Pri škálovaní na viac inštancií treba prejsť na Redis store
 * (rate-limit-redis), ale to je problém deploy fázy.
 */

'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../../../config');

const loginLimiter = rateLimit({
  windowMs: config.security.rateLimit.loginWindowMs,
  limit: config.security.rateLimit.loginMaxPerWindow,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: 'Príliš veľa pokusov o prihlásenie. Skús to znova o pár minút.',
  },
  // počítaj len neúspešné pokusy
  skipSuccessfulRequests: true,
});

const apiLimiter = rateLimit({
  windowMs: config.security.rateLimit.apiWindowMs,
  limit: config.security.rateLimit.apiMaxPerWindow,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Príliš veľa requestov. Skús to znova o chvíľu.' },
});

module.exports = { loginLimiter, apiLimiter };
