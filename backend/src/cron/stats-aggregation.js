/**
 * Cron: stats aggregation
 *
 * Schedule: každý deň o 03:30
 * Akcia: agreguje včerajšie záznamy z `page_visits` do `page_visits_daily`,
 *        a zmaže `page_visits` staršie ako RAW_STATS_RETENTION_DAYS dní.
 *
 * Implementácia tela príde v Phase 15 (dashboard štatistík).
 */

'use strict';

const log = require('../logger');
// const db = require('../db');
// const config = require('../../../config');

module.exports = async function statsAggregation() {
  log.info('cron:stats-aggregation tick (placeholder)');

  // TODO Phase 15:
  //   1. Vyber všetky riadky z page_visits za včerajší deň
  //   2. GROUP BY path, COUNT(*) views, COUNT(DISTINCT ip_hash) unique_visitors
  //   3. INSERT do page_visits_daily (ON DUPLICATE KEY UPDATE)
  //   4. DELETE FROM page_visits WHERE viewed_at < NOW() - INTERVAL X DAY
};
