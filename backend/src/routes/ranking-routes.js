/**
 * Public ranking routes — Phase 9 (updated)
 *
 * Zmeny oproti pôvodnej verzii:
 * - Cover obrázky z článkov (cover_thumb, cover_full)
 * - Cena extrahovaná z kritéria typu 'price'
 * - Reálne štatistiky v hero sekcii (/rebricky)
 * - Sort direction fix
 */

'use strict';

const express = require('express');
const db = require('../db');
const log = require('../logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadRankingItems(rankingId, ranking) {
  const criteria = await db('ranking_criteria')
    .where('ranking_id', rankingId)
    .orderBy('display_order');

  const items = await db('ranking_items')
    .leftJoin('articles', 'ranking_items.article_id', 'articles.id')
    .leftJoin('media', 'articles.cover_media_id', 'media.id')
    .where('ranking_items.ranking_id', rankingId)
    .select(
      'ranking_items.*',
      'articles.title as article_title',
      'articles.slug as article_slug',
      'articles.type as article_type',
      'articles.excerpt as article_excerpt',
      'articles.published_at',
      'media.original_path as cover_full',
      'media.thumbnail_path as cover_thumb'
    );

  const itemIds = items.map((i) => i.id);
  const valuesMap = new Map();
  if (itemIds.length > 0) {
    const vals = await db('ranking_item_values').whereIn('ranking_item_id', itemIds);
    for (const v of vals) {
      if (!valuesMap.has(v.ranking_item_id)) valuesMap.set(v.ranking_item_id, []);
      valuesMap.get(v.ranking_item_id).push(v);
    }
  }

  // Nájdi price kritérium (ak existuje)
  const priceCriterion = criteria.find((c) => c.field_type === 'price');
  const dateCriterion = criteria.find((c) => c.field_type === 'date');

  items.forEach((item) => {
    item.values = valuesMap.get(item.id) || [];
    item.name = item.article_id ? item.article_title : item.custom_name;
    item.brand = item.custom_brand || '';
    item.slug = item.article_id ? item.article_slug : null;
    item.type = item.article_id ? item.article_type : 'product';

    // Cover obrázok
    const imgPath = item.cover_thumb || item.cover_full || null;
    item.image = imgPath ? '/uploads/' + imgPath : null;

    // Cena z price kritéria
    if (priceCriterion) {
      const priceVal = item.values.find((v) => Number(v.criterion_id) === priceCriterion.id);
      if (priceVal && priceVal.value_decimal !== null) {
        item.price = Number(priceVal.value_decimal).toLocaleString('sk-SK') + ' €';
      } else if (priceVal && priceVal.value_text) {
        item.price = priceVal.value_text;
      } else {
        item.price = '';
      }
    } else {
      item.price = '';
    }
    if (dateCriterion) {
      const dateVal = item.values.find((v) => Number(v.criterion_id) === dateCriterion.id);
      item.date = dateVal && dateVal.value_text ? dateVal.value_text : '';
    } else {
      item.date = '';
    }

    // Skóre
    if (item.override_score !== null && item.override_score !== undefined) {
      item.score = Number(item.override_score);
    } else {
      const numericVals = item.values
        .filter((v) => {
          if (v.value_decimal === null) return false;
          const criterion = criteria.find((c) => c.id === Number(v.criterion_id));
          return criterion && criterion.field_type !== 'price';
        })
        .map((v) => Number(v.value_decimal));
      item.score =
        numericVals.length > 0
          ? Math.round((numericVals.reduce((a, b) => a + b, 0) / numericVals.length) * 10) / 10
          : null;
    }

    // Scores array pre frontend (label + val), vynechaj price
    item.scores = criteria
      .filter((c) => c.field_type !== 'price' && c.field_type !== 'date')
      .map((c) => {
        const val = item.values.find((v) => Number(v.criterion_id) === c.id);
        return {
          label: c.name,
          val: val && val.value_decimal !== null ? Number(val.value_decimal) : 0,
          text: val && val.value_text ? val.value_text : null,
          unit: c.unit,
        };
      });
  });

  // Zoraď
  if (ranking.admin_override) {
    items.sort((a, b) => (a.manual_position || 999) - (b.manual_position || 999));
  } else {
    const dir = ranking.sort_direction === 'asc' ? -1 : 1;
    items.sort((a, b) => ((b.score || 0) - (a.score || 0)) * dir);
  }

  items.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return { items, criteria };
}

function formatDateSk(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = [
    'januára',
    'februára',
    'marca',
    'apríla',
    'mája',
    'júna',
    'júla',
    'augusta',
    'septembra',
    'októbra',
    'novembra',
    'decembra',
  ];
  return `${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// LIST — /rebricky
// ---------------------------------------------------------------------------
router.get('/rebricky', async (req, res, next) => {
  try {
    const rankings = await db('rankings').where('status', 'active').orderBy('created_at', 'desc');

    // Reálne štatistiky
    const totalProducts = await db('ranking_items').countDistinct({ c: 'id' }).first();
    const totalRankings = rankings.length;
    const totalCriteria = await db('ranking_criteria').countDistinct({ c: 'id' }).first();

    const stats = {
      products: Number(totalProducts?.c || 0),
      rankings: totalRankings,
      criteria: Number(totalCriteria?.c || 0),
    };

    const rankingGroups = [];
    for (const r of rankings) {
      const { items, criteria } = await loadRankingItems(r.id, r);
      const top3 = items.slice(0, 3);

      let category = '';
      if (items.length > 0 && items[0].article_id) {
        const catRow = await db('article_categories')
          .join('categories', 'article_categories.category_id', 'categories.id')
          .where('article_categories.article_id', items[0].article_id)
          .where('article_categories.is_primary', 1)
          .select('categories.name')
          .first();
        if (catRow) category = catRow.name;
      }

      rankingGroups.push({
        slug: r.slug,
        title: r.name,
        subtitle: r.description || '',
        category: category,
        updated: 'Aktualizované ' + formatDateSk(r.updated_at),
        top3: top3.map((i) => ({
          rank: i.rank,
          name: i.name,
          brand: i.brand,
          score: i.score,
          price: i.price,
          slug: i.slug,
          image: i.image,
        })),
        itemCount: items.length,
        criteriaCount: criteria.length,
      });
    }

    res.render('ranking/index', {
      title: 'Rebríčky',
      currentPath: '/rebricky',
      rankingGroups,
      stats,
    });
  } catch (err) {
    log.error('ranking list failed', { err: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DETAIL — /rebricky/:slug
// ---------------------------------------------------------------------------
router.get('/rebricky/:slug', async (req, res, next) => {
  try {
    const ranking = await db('rankings')
      .where('slug', req.params.slug)
      .where('status', 'active')
      .first();
    if (!ranking) return next();

    const { items, criteria } = await loadRankingItems(ranking.id, ranking);

    let category = '';
    if (items.length > 0 && items[0].article_id) {
      const catRow = await db('article_categories')
        .join('categories', 'article_categories.category_id', 'categories.id')
        .where('article_categories.article_id', items[0].article_id)
        .where('article_categories.is_primary', 1)
        .select('categories.name')
        .first();
      if (catRow) category = catRow.name;
    }

    const templateRanking = {
      slug: ranking.slug,
      title: ranking.name,
      subtitle: ranking.description || '',
      category: category,
      updated: 'Aktualizované ' + formatDateSk(ranking.updated_at),
    };

    res.render('ranking/show', {
      title: ranking.name,
      currentPath: '/rebricky',
      ranking: templateRanking,
      items,
    });
  } catch (err) {
    log.error('ranking detail failed', { err: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// TABLE — /rebricky/:slug/tabulka
// ---------------------------------------------------------------------------
router.get('/rebricky/:slug/tabulka', async (req, res, next) => {
  try {
    const ranking = await db('rankings')
      .where('slug', req.params.slug)
      .where('status', 'active')
      .first();
    if (!ranking) return next();

    const { items, criteria } = await loadRankingItems(ranking.id, ranking);

    const templateRanking = {
      slug: ranking.slug,
      title: ranking.name,
      subtitle: ranking.description || '',
      category: '',
      updated: 'Aktualizované ' + formatDateSk(ranking.updated_at),
    };

    const scoreLabels = criteria
      .filter((c) => c.field_type !== 'price' && c.field_type !== 'date')
      .map((c) => c.name);

    res.render('ranking/table', {
      title: ranking.name + ' — Tabuľka',
      currentPath: '/rebricky',
      ranking: templateRanking,
      items,
      scoreLabels,
    });
  } catch (err) {
    log.error('ranking table failed', { err: err.message });
    next(err);
  }
});

module.exports = router;
