/**
 * Media usages tracking  (Phase 5.5)
 *
 * `media_usages` je index kde sa každé médium používa. Pri uložení článku
 * synchronizujeme jeho riadky:
 *   - cover_media_id   → usage_type='article_cover'
 *   - og_image_media_id → usage_type='og_image'
 *   - image bloky      → usage_type='article_block' (jeden riadok per blok)
 *   - gallery bloky (Phase 5.6) → 'article_block' per item
 *
 * Strategy: replace — pri save najprv DELETE všetkých riadkov pre daný
 * article_id, potom INSERT nových.
 *
 * Volá sa v rovnakej transakcii ako article update, aby buď oboje alebo nič.
 */

'use strict';

/**
 * Extrahuje všetky media_id-y z poľa blokov.
 * Vráti pole čísel (môže obsahovať duplicity, dedup-uje sa neskôr).
 */
function extractBlockMediaIds(blocks) {
  if (!Array.isArray(blocks)) return [];
  const ids = [];
  for (const b of blocks) {
    if (!b || !b.type) continue;
    if (b.type === 'image' && Number.isInteger(b.media_id)) {
      ids.push(b.media_id);
    } else if (b.type === 'gallery' && Array.isArray(b.items)) {
      // Phase 5.6 — gallery
      for (const item of b.items) {
        if (item && Number.isInteger(item.media_id)) ids.push(item.media_id);
      }
    }
  }
  return ids;
}

/**
 * Synchronizuje media_usages pre článok.
 *
 * @param {Knex.Transaction} trx
 * @param {Number} articleId
 * @param {Object} opts
 *   - coverMediaId        — number|null
 *   - ogImageMediaId      — number|null
 *   - blocks              — pole content blokov (extrahuje image/gallery IDs)
 */
async function syncArticleMediaUsages(trx, articleId, { coverMediaId, ogImageMediaId, blocks }) {
  // 1. Delete all existing usages for this article
  await trx('media_usages').where('article_id', articleId).del();

  // 2. Build new rows
  const rows = [];
  if (coverMediaId) {
    rows.push({
      media_id: coverMediaId,
      usage_type: 'article_cover',
      article_id: articleId,
    });
  }
  if (ogImageMediaId) {
    rows.push({
      media_id: ogImageMediaId,
      usage_type: 'og_image',
      article_id: articleId,
    });
  }

  // Block images — dedup per (media_id), pretože jeden image môže byť v
  // článku len raz v indexe (jeden image = jeden riadok); ak je v dvoch
  // blokoch, stačí jeden záznam.
  const blockIds = [...new Set(extractBlockMediaIds(blocks))];
  for (const mid of blockIds) {
    rows.push({
      media_id: mid,
      usage_type: 'article_block',
      article_id: articleId,
    });
  }

  // 3. Insert (ak je čo)
  if (rows.length > 0) {
    await trx('media_usages').insert(rows);
  }
}

module.exports = {
  extractBlockMediaIds,
  syncArticleMediaUsages,
};
