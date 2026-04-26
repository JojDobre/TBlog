/**
 * Logger
 *
 * Jednoduchý štruktúrovaný logger nad konzolou. V dev režime farebný,
 * v produkcii čisto JSON na stdout (pre prípadný log shipper).
 *
 * Použitie:
 *   const log = require('./logger');
 *   log.info('Server started', { port: 3000 });
 *   log.error('DB connection failed', { err: err.message });
 *
 * Úrovne: debug < info < warn < error
 * Default LOG_LEVEL = info v prod, debug v dev.
 */

'use strict';

const config = require('../../config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS = {
  debug: '\x1b[90m', // gray
  info: '\x1b[36m', // cyan
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};
const RESET = '\x1b[0m';

const minLevel = LEVELS[(process.env.LOG_LEVEL || (config.app.isDev ? 'debug' : 'info'))] || 20;

function format(level, message, meta) {
  const ts = new Date().toISOString();

  if (config.app.isDev) {
    const color = COLORS[level] || '';
    const metaStr = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${color}[${ts}] ${level.toUpperCase().padEnd(5)}${RESET} ${message}${metaStr}`;
  }

  return JSON.stringify({ ts, level, message, ...meta });
}

function log(level, message, meta = {}) {
  if (LEVELS[level] < minLevel) return;
  const line = format(level, message, meta);
  if (level === 'error' || level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
