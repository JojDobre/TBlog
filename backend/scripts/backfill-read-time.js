/**
 * Dopočíta read_time_min pre existujúce články z ich content blokov.
 * Spustenie: node backend/scripts/backfill-read-time.js
 * Idempotentné — preskakuje články s vyplneným read_time_min.
 */

'use strict';

const path = require('path');

const config = require(path.resolve(__dirname, '..', '..', 'config'));
const knexfile = require(path.resolve(__dirname, '..', '..', 'knexfile'));
const knex = require('knex')(knexfile[config.app.env] || knexfile.development);
const blocks = require(path.resolve(__dirname, '..', 'src', 'utils', 'blocks'));

async function run() {
  const rows = await knex('articles')
    .whereNull('read_time_min')
    .select('id', 'content');

  console.log(`Na spracovanie: ${rows.length}`);
  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const content =
        typeof row.content === 'string' ? JSON.parse(row.content || '[]') : row.content || [];
      const min = blocks.estimateReadTimeMin(content);
      await knex('articles').where('id', row.id).update({ read_time_min: min });
      ok++;
    } catch (err) {
      failed++;
      console.error(`  CHYBA id=${row.id}: ${err.message}`);
    }
  }

  console.log(`Hotovo. OK: ${ok}, chyby: ${failed}`);
  await knex.destroy();
}

run().catch(async (err) => {
  console.error(err);
  await knex.destroy().catch(() => {});
  process.exit(1);
});
