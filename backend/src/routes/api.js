/**
 * API routes  (mounted at /api)
 *
 * Phase 9 — article search for ranking autocomplete
 *
 * GET /api/articles/search?q=...  — hľadá published články, max 10 výsledkov
 */

'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

router.get('/articles/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const rows = await db('articles')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
      .where(function () {
        this.where('articles.title', 'like', `%${q}%`).orWhere('articles.slug', 'like', `%${q}%`);
      })
      .whereIn('articles.status', ['published', 'draft'])
      .select(
        'articles.id',
        'articles.title',
        'articles.slug',
        'articles.type',
        'articles.status',
        'media.thumbnail_path as cover_thumb'
      )
      .orderBy('articles.updated_at', 'desc')
      .limit(10);

    res.json({ results: rows });
  } catch (err) {
    next(err);
  }
});

// Zoznam aktívnych rebríčkov (pre select v article editore)
router.get('/rankings', async (req, res, next) => {
  try {
    const rows = await db('rankings')
      .where('status', 'active')
      .orderBy('name')
      .select('id', 'name', 'slug');
    res.json({ rankings: rows });
  } catch (err) {
    next(err);
  }
});

// Kritériá rebríčka
router.get('/rankings/:id/criteria', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const criteria = await db('ranking_criteria')
      .where('ranking_id', id)
      .orderBy('display_order')
      .select('id', 'name', 'field_type', 'unit', 'is_filterable', 'is_total');
    res.json({ criteria });
  } catch (err) {
    next(err);
  }
});

// Rebríčky, v ktorých je článok (s hodnotami)
router.get('/articles/:id/rankings', async (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
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

    // Načítaj hodnoty
    for (const item of items) {
      const vals = await db('ranking_item_values').where('ranking_item_id', item.item_id);
      item.values = {};
      for (const v of vals) {
        item.values[v.criterion_id] =
          v.value_decimal !== null ? Number(v.value_decimal) : v.value_text;
      }
    }

    res.json({ rankings: items });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
