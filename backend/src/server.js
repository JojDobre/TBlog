#!/usr/bin/env node
/**
 * Bytezone — server entry point
 *
 * Spustenie:
 *   npm run dev      (nodemon, auto-reload)
 *   npm start        (production)
 *
 * Lifecycle:
 *   1. Pripojiť sa k DB (kontrola)
 *   2. Spustiť Express HTTP server
 *   3. Spustiť cron joby
 *   4. Pri SIGTERM/SIGINT → graceful shutdown:
 *        - prestať prijímať nové requesty
 *        - zastaviť cron
 *        - počkať na dokončenie aktívnych requestov (max 10s)
 *        - zatvoriť knex pool
 *        - exit
 */

'use strict';

const config = require('../../config');
const log = require('./logger');
const db = require('./db');
const cron = require('./cron');
const createApp = require('./app');

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main() {
  // -------------------------------------------------------------- 1. DB ping
  try {
    await db.raw('SELECT 1');
    log.info('DB connected', {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
    });
  } catch (err) {
    log.error('DB connection failed at startup', { err: err.message });
    log.error('Tipy: beží Docker? Sú v .env správne credentials?');
    process.exit(1);
  }

  // ------------------------------------------------------- 2. Build & listen
  const app = createApp();
  const server = app.listen(config.app.port, () => {
    log.info(`Bytezone server running`, {
      env: config.app.env,
      url: config.app.baseUrl,
      port: config.app.port,
      pid: process.pid,
    });
  });

  // ----------------------------------------------------------------- 3. Cron
  cron.start();

  // ---------------------------------------------- 4. Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}, shutting down gracefully...`);

    // núdzový timer — ak shutdown trvá moc dlho, kill
    const killTimer = setTimeout(() => {
      log.error('Shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    killTimer.unref();

    // a) prestať prijímať requesty
    server.close((err) => {
      if (err) log.error('Server close error', { err: err.message });
      else log.info('HTTP server closed');
    });

    // b) zastaviť cron
    cron.stop();

    // c) zatvoriť knex pool
    try {
      await db.destroy();
      log.info('DB pool closed');
    } catch (err) {
      log.error('DB pool close error', { err: err.message });
    }

    log.info('Shutdown complete');
    clearTimeout(killTimer);
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ---------------------------------------- crash handlers (last resort)
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (err) => {
    log.error('Uncaught exception', { err: err.message, stack: err.stack });
    // tu by mal proces zomrieť — ostávame žiť len kvôli logovaniu
    shutdown('uncaughtException');
  });
}

main().catch((err) => {
  log.error('Fatal startup error', { err: err.message, stack: err.stack });
  process.exit(1);
});
