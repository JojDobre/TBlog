/**
 * utils/article-rankings.js — Phase 9
 *
 * Helper funkcie pre načítanie a uloženie ranking dát pri editácii článku.
 * Dáta sa prenášajú ako JSON string v req.body.ranking_json
 * (kvôli express.urlencoded({ extended: false })).
 */

'use strict';

const db = require('../db');
const log = require('../logger');

/**
 * Načítaj rebríčky pre článok (pre edit formulár).
 */
async function loadArticleRankings(articleId) {
  if (!articleId) return [];

  const items = await db('ranking_items')
    .join('rankings', 'ranking_items.ranking_id', 'rankings.id')
    .where('ranking_items.article_id', articleId)
    .select(
      'ranking_items.id as item_id',
      'ranking_items.ranking_id',
      'ranking_items.override_score',
      'ranking_items.custom_brand',
      'rankings.name as ranking_name',
      'rankings.slug as ranking_slug'
    );

  for (const item of items) {
    const vals = await db('ranking_item_values').where('ranking_item_id', item.item_id);
    item.values = {};
    for (const v of vals) {
      item.values[v.criterion_id] =
        v.value_decimal !== null ? Number(v.value_decimal) : v.value_text || null;
    }
  }

  return items;
}

/**
 * Parsuj ranking_json z request body.
 * Vracia pole alebo null pri chybe.
 */
function parseRankingJson(body) {
  if (!body.ranking_json) return null;
  try {
    const parsed =
      typeof body.ranking_json === 'string' ? JSON.parse(body.ranking_json) : body.ranking_json;
    return Array.isArray(parsed) ? parsed : null;
  } catch (e) {
    return null;
  }
}

/**
 * Ulož ranking dáta z article edit formulára.
 *
 * entries je pole:
 * [
 *   { ranking_id: 5, item_id: 12, override_score: 8.5, values: { "1": 9, "2": 7.5 } },
 *   { ranking_id: 3, item_id: null, override_score: null, values: { "4": 8 } },
 * ]
 */
async function saveArticleRankings(trx, articleId, body) {
  if (!articleId) return;

  const entries = parseRankingJson(body);
  if (!entries) return; // Žiadne ranking dáta v requeste

  // Načítaj existujúce items pre tento článok
  const existingItems = await trx('ranking_items')
    .where('article_id', articleId)
    .select('id', 'ranking_id');

  const submittedRankingIds = new Set(entries.map((e) => String(e.ranking_id)));
  const existingMap = new Map(existingItems.map((i) => [String(i.ranking_id), i.id]));

  // 1. Odobrať items ktoré už nie sú v entries
  for (const existing of existingItems) {
    if (!submittedRankingIds.has(String(existing.ranking_id))) {
      await trx('ranking_item_values').where('ranking_item_id', existing.id).del();
      await trx('ranking_items').where('id', existing.id).del();
      log.info('ranking item removed from article', { articleId, rankingId: existing.ranking_id });
    }
  }

  // 2. Upsert entries
  for (const entry of entries) {
    const rankingId = Number(entry.ranking_id);
    let itemId = entry.item_id ? Number(entry.item_id) : null;
    const overrideScore = entry.override_score != null ? parseFloat(entry.override_score) : null;
    const values = entry.values || {};

    // Načítaj kritériá pre tento rebríček
    const criteria = await trx('ranking_criteria').where('ranking_id', rankingId);

    if (itemId && existingMap.has(String(rankingId))) {
      // UPDATE existujúceho
      await trx('ranking_items')
        .where('id', itemId)
        .update({
          override_score: overrideScore,
          custom_brand: entry.custom_brand || null,
          custom_name: entry.custom_name || null,
        });
    } else {
      // INSERT nového (skontroluj duplicitu)
      const dup = await trx('ranking_items')
        .where('ranking_id', rankingId)
        .where('article_id', articleId)
        .first();

      if (dup) {
        itemId = dup.id;
        await trx('ranking_items')
          .where('id', itemId)
          .update({
            override_score: overrideScore,
            custom_brand: entry.custom_brand || null,
            custom_name: entry.custom_name || null,
          });
      } else {
        const maxPos = await trx('ranking_items')
          .where('ranking_id', rankingId)
          .max({ m: 'manual_position' })
          .first();
        const nextPos = (maxPos?.m ?? -1) + 1;

        [itemId] = await trx('ranking_items').insert({
          ranking_id: rankingId,
          article_id: articleId,
          custom_brand: entry.custom_brand || null,
          custom_name: entry.custom_name || null,
          override_score: overrideScore,
          manual_position: nextPos,
          added_at: new Date(),
        });
        log.info('ranking item added from article editor', { itemId, articleId, rankingId });
      }
    }

    // Upsert hodnoty kritérií
    for (const c of criteria) {
      const rawVal = values[String(c.id)];
      if (rawVal === undefined) continue;

      const isNumeric = ['score_1_10', 'decimal', 'integer', 'price'].includes(c.field_type);
      const valDecimal = isNumeric && rawVal !== null && rawVal !== '' ? parseFloat(rawVal) : null;
      const valText = !isNumeric && rawVal !== null && rawVal !== '' ? String(rawVal).trim() : null;

      const existing = await trx('ranking_item_values')
        .where('ranking_item_id', itemId)
        .where('criterion_id', c.id)
        .first();

      if (existing) {
        await trx('ranking_item_values')
          .where('ranking_item_id', itemId)
          .where('criterion_id', c.id)
          .update({
            value_decimal: valDecimal,
            value_text: valText,
          });
      } else if (valDecimal !== null || valText !== null) {
        await trx('ranking_item_values').insert({
          ranking_item_id: itemId,
          criterion_id: c.id,
          value_decimal: valDecimal,
          value_text: valText,
        });
      }
    }
  }
}

module.exports = { loadArticleRankings, saveArticleRankings };
