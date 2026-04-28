/**
 * Cron: scheduled publish  (Phase 5.2)
 *
 * Schedule: každých 5 minút.
 * Akcia: zoberie články kde status='scheduled' AND scheduled_at <= NOW(),
 *        prepne ich na 'published' a nastaví published_at = NOW().
 */

'use strict';

const log = require('../logger');
const db = require('../db');

module.exports = async function scheduledPublish() {
  try {
    const now = new Date();

    // Najprv zisti koľko sa toho dotýka (pre log)
    const due = await db('articles')
      .where('status', 'scheduled')
      .where('scheduled_at', '<=', now)
      .select('id', 'title', 'scheduled_at');

    if (due.length === 0) {
      log.debug('cron:scheduled-publish: nothing due');
      return;
    }

    const updated = await db('articles')
      .where('status', 'scheduled')
      .where('scheduled_at', '<=', now)
      .update({
        status: 'published',
        published_at: now,
      });

    log.info('cron:scheduled-publish: published', {
      count: updated,
      ids: due.map((a) => a.id),
    });
  } catch (err) {
    log.error('cron:scheduled-publish failed', { err: err.message, stack: err.stack });
  }
};
