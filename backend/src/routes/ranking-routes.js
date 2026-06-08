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
const bannerLoader = require('../utils/banner-loader');

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
    .leftJoin('media as item_media', 'ranking_items.cover_media_id', 'item_media.id')
    .select(
      'ranking_items.*',
      'articles.title as article_title',
      'articles.slug as article_slug',
      'articles.type as article_type',
      'articles.excerpt as article_excerpt',
      'articles.published_at',
      'media.original_path as cover_full',
      'media.thumbnail_path as cover_thumb',
      'item_media.thumbnail_path as item_cover_thumb',
      'item_media.original_path as item_cover_full'
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
    item.url = item.article_id ? '/clanok/' + item.article_slug : item.custom_url || null;
    item.type = item.article_id ? item.article_type : 'product';

    // Cover obrázok
    const imgPath =
      item.cover_thumb || item.cover_full || item.item_cover_thumb || item.item_cover_full || null;
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
      .filter((c) => !['price', 'date', 'icon_group', 'info_group'].includes(c.field_type))
      .map((c) => {
        const val = item.values.find((v) => Number(v.criterion_id) === c.id);
        var numVal = val && val.value_decimal !== null ? Number(val.value_decimal) : 0;
        var colorClass = 'great';
        if (c.color_ref_criterion_id) {
          // Základ = hodnota iného kritéria pre tento produkt
          var refVal = item.values.find(function (v) {
            return Number(v.criterion_id) === Number(c.color_ref_criterion_id);
          });
          var total = refVal && refVal.value_decimal !== null ? Number(refVal.value_decimal) : 0;
          if (total > 0) {
            var ratio = numVal / total;
            if (c.color_max) ratio = ratio * (total / c.color_max);
            if (ratio >= 0.95) colorClass = 'great';
            else if (ratio >= 0.85) colorClass = 'good';
            else if (ratio >= 0.7) colorClass = 'mid';
            else colorClass = 'low';
          }
        } else if (c.color_max) {
          var r2 = c.color_max > 0 ? numVal / c.color_max : 0;
          if (r2 >= 0.9) colorClass = 'great';
          else if (r2 >= 0.75) colorClass = 'good';
          else if (r2 >= 0.6) colorClass = 'mid';
          else colorClass = 'low';
        }
        return {
          label: c.name,
          val: numVal,
          text: val && val.value_text ? val.value_text : null,
          unit: c.unit,
          colorClass: colorClass,
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

  // Load icon_group / info_group data
  const groupCriteria = criteria.filter(
    (c) => c.field_type === 'icon_group' || c.field_type === 'info_group'
  );
  const groupData = {};

  for (const gc of groupCriteria) {
    const options = await db('ranking_criterion_options')
      .leftJoin('media', 'ranking_criterion_options.icon_media_id', 'media.id')
      .where('ranking_criterion_options.criterion_id', gc.id)
      .select(
        'ranking_criterion_options.*',
        'media.thumbnail_path as icon_thumb',
        'media.original_path as icon_path'
      )
      .orderBy('ranking_criterion_options.display_order');

    groupData[gc.id] = {
      criterion: gc,
      options: options,
      topLevel: options.filter((o) => !o.parent_id),
      children: {},
    };
    // Build children map
    options
      .filter((o) => o.parent_id)
      .forEach((o) => {
        if (!groupData[gc.id].children[o.parent_id]) groupData[gc.id].children[o.parent_id] = [];
        groupData[gc.id].children[o.parent_id].push(o);
      });
  }

  // Load selected options per item
  if (itemIds.length > 0 && groupCriteria.length > 0) {
    const allOptionIds = [];
    for (const gc of groupCriteria) {
      groupData[gc.id].options.forEach((o) => allOptionIds.push(o.id));
    }
    if (allOptionIds.length > 0) {
      const selectedRows = await db('ranking_item_options')
        .whereIn('ranking_item_id', itemIds)
        .whereIn('option_id', allOptionIds)
        .select('ranking_item_id', 'option_id');
      const selectedMap = new Map();
      for (const r of selectedRows) {
        if (!selectedMap.has(r.ranking_item_id)) selectedMap.set(r.ranking_item_id, new Set());
        selectedMap.get(r.ranking_item_id).add(r.option_id);
      }
      items.forEach((item) => {
        item.selectedOptions = selectedMap.get(item.id) || new Set();
      });
    }
  }
  items.forEach((item) => {
    if (!item.selectedOptions) item.selectedOptions = new Set();
  });

  return { items, criteria, groupData };
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
      const { items, criteria, groupData } = await loadRankingItems(r.id, r);
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

    const banners = await bannerLoader.getBannersForPositions(['ranking_top']);

    res.render('ranking/index', {
      title: 'Rebríčky',
      currentPath: '/rebricky',
      rankingGroups,
      stats,
      banners,
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

    const { items, criteria, groupData } = await loadRankingItems(ranking.id, ranking);

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
      methodology: ranking.methodology || null,
    };

    const banners = await bannerLoader.getBannersForPositions(['ranking_top']);

    res.render('ranking/show', {
      title: ranking.name,
      currentPath: '/rebricky',
      ranking: templateRanking,
      items,
      criteria,
      groupData,
      banners,
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

    const { items, criteria, groupData } = await loadRankingItems(ranking.id, ranking);

    const templateRanking = {
      slug: ranking.slug,
      title: ranking.name,
      subtitle: ranking.description || '',
      category: '',
      updated: 'Aktualizované ' + formatDateSk(ranking.updated_at),
      methodology: ranking.methodology || null,
    };

    const scoreLabels = criteria
      .filter((c) => !['price', 'date', 'icon_group', 'info_group'].includes(c.field_type))
      .map((c) => c.name);

    const banners = await bannerLoader.getBannersForPositions(['ranking_top']);

    res.render('ranking/table', {
      title: ranking.name + ' — Tabuľka',
      currentPath: '/rebricky',
      ranking: templateRanking,
      items,
      criteria,
      groupData,
      scoreLabels,
      banners,
    });
  } catch (err) {
    log.error('ranking table failed', { err: err.message });
    next(err);
  }
});

module.exports = router;
