/**
 * DB — knex singleton
 *
 * Jediný knex inštance pre celú aplikáciu. Importuj cez:
 *   const db = require('./db');
 *
 * Connection pool:
 *   - min 2, max 10 (z knexfile)
 *   - drží sa medzi requestami (NIKDY ho nezatvárať mimo graceful shutdownu)
 *
 * Graceful shutdown: server.js volá db.destroy() pri SIGTERM/SIGINT.
 */

'use strict';

const config = require('../../config');
const knexConfig = require('../../knexfile');

const env = config.app.env;
const cfg = knexConfig[env] || knexConfig.development;

const db = require('knex')(cfg);

module.exports = db;
