'use strict';

/**
 * Pridá articles.read_time_min — čas čítania v minútach, počítaný pri uložení
 * článku z content blokov. Backfill: node backend/scripts/backfill-read-time.js
 */

exports.up = async function (knex) {
  await knex.raw('ALTER TABLE articles ADD COLUMN read_time_min INT UNSIGNED NULL AFTER view_count');
};

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE articles DROP COLUMN read_time_min');
};
