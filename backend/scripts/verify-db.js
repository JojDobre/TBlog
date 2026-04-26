#!/usr/bin/env node
/**
 * Bytezone — verify DB
 *
 * Vypíše počet a názvy tabuliek v aktuálnej databáze. Užitočné po
 * `npm run migrate` na overenie, že všetko zbehlo.
 *
 * Spustenie:
 *   node backend/scripts/verify-db.js
 */

'use strict';

const path = require('path');

const config = require(path.resolve(__dirname, '..', '..', 'config'));
const knexfile = require(path.resolve(__dirname, '..', '..', 'knexfile'));
const knex = require('knex')(knexfile[config.app.env] || knexfile.development);

async function main() {
  console.log(`\nPripojené: ${config.db.host}:${config.db.port}/${config.db.database}\n`);

  try {
    const result = await knex.raw(
      `
      SELECT TABLE_NAME, TABLE_ROWS
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
      `,
      [config.db.database]
    );
    const rows = result[0] || result;

    if (rows.length === 0) {
      console.log('Databáza je prázdna. Spusti `npm run migrate`.');
      return;
    }

    console.log(`Tabuliek: ${rows.length}\n`);
    for (const r of rows) {
      const name = String(r.TABLE_NAME).padEnd(35);
      const rowsCount = r.TABLE_ROWS != null ? `${r.TABLE_ROWS} riadkov` : '?';
      console.log(`  ${name} ${rowsCount}`);
    }
    console.log('');
  } catch (err) {
    console.error('❌ Chyba:', err.message);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

main();
