/**
 * Cron orchestrator
 *
 * Spustí všetky cron joby pri štarte servera. Drží referencie na ich
 * task objekty, aby sa dali zastaviť pri graceful shutdowne.
 *
 * Časové pásmo: cron používa serverový lokálny čas. V Dockeri je server
 * v UTC (daný v docker-compose), takže schedule sú v UTC. To je v poriadku
 * — presný čas tu nie je kritický, denné joby môžu bežať o pár hodín
 * inak ako lokálny SK čas.
 */

'use strict';

const cron = require('node-cron');
const log = require('../logger');

const trashCleanup = require('./trash-cleanup');
const statsAggregation = require('./stats-aggregation');
const scheduledPublish = require('./scheduled-publish');

const tasks = [];

function safeRun(name, fn) {
  return async () => {
    try {
      await fn();
    } catch (err) {
      log.error(`cron:${name} failed`, { err: err.message, stack: err.stack });
    }
  };
}

function start() {
  // Daily 03:00 — trash cleanup
  tasks.push(
    cron.schedule('0 3 * * *', safeRun('trash-cleanup', trashCleanup), {
      scheduled: true,
    })
  );

  // Daily 03:30 — stats aggregation
  tasks.push(
    cron.schedule('30 3 * * *', safeRun('stats-aggregation', statsAggregation), {
      scheduled: true,
    })
  );

  // Every 5 minutes — scheduled publish
  tasks.push(
    cron.schedule('*/5 * * * *', safeRun('scheduled-publish', scheduledPublish), {
      scheduled: true,
    })
  );

  log.info('Cron jobs scheduled', { count: tasks.length });
}

function stop() {
  for (const t of tasks) {
    try {
      t.stop();
    } catch (_) {
      /* noop */
    }
  }
  tasks.length = 0;
  log.info('Cron jobs stopped');
}

module.exports = { start, stop };
