/**
 * Cron: trash cleanup  (Phase 5.2)
 *
 * Schedule: denne 03:00.
 * Akcia: permanentne zmaže články kde status='trash' AND
 *        deleted_at < NOW() - INTERVAL <trashRetentionDays> DAY.
 *
 * `trashRetentionDays` je v config.defaults (default 30).
 *
 * FK CASCADE odstrania aj relácie (article_categories, article_rubrics,
 * article_tags, article_revisions, comments, atď.).
 */

'use strict';

const log = require('../logger');
const db = require('../db');
const config = require('../../../config');

module.exports = async function trashCleanup() {
  try {
    const days = config.defaults.trashRetentionDays || 30;
    const cutoff = new Date(Date.now() - days * 86_400_000);

    const candidates = await db('articles')
      .where('status', 'trash')
      .where('deleted_at', '<', cutoff)
      .select('id', 'title', 'deleted_at');

    if (candidates.length === 0) {
      log.debug('cron:trash-cleanup: nothing to delete', { days });
      return;
    }

    const deleted = await db('articles')
      .where('status', 'trash')
      .where('deleted_at', '<', cutoff)
      .del();

    log.info('cron:trash-cleanup: deleted', {
      count: deleted,
      retentionDays: days,
      ids: candidates.map((c) => c.id),
    });
  } catch (err) {
    log.error('cron:trash-cleanup failed', { err: err.message, stack: err.stack });
  }
};
