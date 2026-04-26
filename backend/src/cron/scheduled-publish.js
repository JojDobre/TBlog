/**
 * Cron: scheduled publish
 *
 * Schedule: každých 5 minút
 * Akcia: zoberie články v stave 'scheduled' kde scheduled_at <= NOW()
 *        a prepne ich na 'published' s published_at = NOW().
 *
 * Implementácia tela príde v Phase 5 (články backend).
 */

'use strict';

const log = require('../logger');
// const db = require('../db');

module.exports = async function scheduledPublish() {
  log.debug('cron:scheduled-publish tick (placeholder)');

  // TODO Phase 5:
  // const now = new Date();
  // const updated = await db('articles')
  //   .where('status', 'scheduled')
  //   .where('scheduled_at', '<=', now)
  //   .update({ status: 'published', published_at: now });
  // if (updated > 0) log.info('cron:scheduled-publish published articles', { count: updated });
};
