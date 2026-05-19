/**
 * Banner loader utility
 *
 * Načíta aktívne bannery pre danú pozíciu (alebo viacero pozícií).
 * Ak je na pozícii viac bannerov, vyberie náhodný.
 */

'use strict';

const db = require('../db');

/**
 * Načíta 1 náhodný aktívny banner pre danú pozíciu.
 *
 * @param {string} positionKey — kľúč pozície (napr. 'home_in_feed', 'article_sidebar')
 * @returns {object|null}
 */
async function getRandomBanner(positionKey) {
  const now = new Date();

  const rows = await db('banners')
    .join('banner_placements', 'banners.id', 'banner_placements.banner_id')
    .join('banner_positions', 'banner_placements.position_id', 'banner_positions.id')
    .leftJoin('media', 'banners.image_media_id', 'media.id')
    .where('banner_positions.key', positionKey)
    .where('banners.status', 'active')
    .where(function () {
      this.whereNull('banners.starts_at').orWhere('banners.starts_at', '<=', now);
    })
    .where(function () {
      this.whereNull('banners.ends_at').orWhere('banners.ends_at', '>', now);
    })
    .select('banners.*', 'media.thumbnail_path', 'media.original_path');

  if (rows.length === 0) return null;

  // Náhodný výber
  const banner = rows[Math.floor(Math.random() * rows.length)];

  // Parsuj template_data
  if (banner.template_data) {
    try {
      banner._td = JSON.parse(banner.template_data);
    } catch (e) {
      banner._td = {};
    }
  } else {
    banner._td = {};
  }

  return banner;
}

/**
 * Načíta bannery pre viacero pozícií naraz (1 query, zoskupí podľa pozície).
 *
 * @param {string[]} positionKeys — pole kľúčov pozícií
 * @returns {Object<string, object|null>} — mapa { positionKey: banner|null }
 */
async function getBannersForPositions(positionKeys) {
  if (!positionKeys || positionKeys.length === 0) return {};

  const now = new Date();

  const rows = await db('banners')
    .join('banner_placements', 'banners.id', 'banner_placements.banner_id')
    .join('banner_positions', 'banner_placements.position_id', 'banner_positions.id')
    .leftJoin('media', 'banners.image_media_id', 'media.id')
    .whereIn('banner_positions.key', positionKeys)
    .where('banners.status', 'active')
    .where(function () {
      this.whereNull('banners.starts_at').orWhere('banners.starts_at', '<=', now);
    })
    .where(function () {
      this.whereNull('banners.ends_at').orWhere('banners.ends_at', '>', now);
    })
    .select(
      'banners.*',
      'media.thumbnail_path',
      'media.original_path',
      'banner_positions.key as position_key'
    );

  // Zoskup podľa pozície
  const grouped = {};
  for (const key of positionKeys) {
    grouped[key] = [];
  }
  for (const row of rows) {
    if (!grouped[row.position_key]) grouped[row.position_key] = [];
    grouped[row.position_key].push(row);
  }

  // Vyber náhodný pre každú pozíciu
  const result = {};
  for (const key of positionKeys) {
    const list = grouped[key] || [];
    if (list.length === 0) {
      result[key] = null;
    } else {
      const banner = list[Math.floor(Math.random() * list.length)];
      if (banner.template_data) {
        try {
          banner._td = JSON.parse(banner.template_data);
        } catch (e) {
          banner._td = {};
        }
      } else {
        banner._td = {};
      }
      result[key] = banner;
    }
  }

  return result;
}

module.exports = {
  getRandomBanner,
  getBannersForPositions,
};
