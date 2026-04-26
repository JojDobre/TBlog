/**
 * Cron: trash cleanup
 *
 * Schedule: každý deň o 03:00
 * Akcia: zmaže články v stave 'trash' starší ako TRASH_RETENTION_DAYS dní.
 *
 * Implementácia tela príde v Phase 5 (články backend), tu len placeholder
 * aby sme videli že cron beží.
 */

'use strict';

const log = require('../logger');
// const db = require('../db');
// const config = require('../../../config');

module.exports = async function trashCleanup() {
  log.info('cron:trash-cleanup tick (placeholder, nemaže ešte nič)');

  // TODO Phase 5:
  // const cutoff = new Date(Date.now() - config.defaults.trashRetentionDays * 86400_000);
  // const deleted = await db('articles')
  //   .where('status', 'trash')
  //   .where('deleted_at', '<', cutoff)
  //   .del();
  // log.info('cron:trash-cleanup done', { deleted });
};
