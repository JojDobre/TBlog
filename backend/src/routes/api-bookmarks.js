/**
 * Bookmarks API
 *
 * POST /api/bookmarks/toggle  — pridaj/odober bookmark
 * GET  /api/bookmarks/check   — je článok uložený? (?article_id=X)
 * GET  /api/bookmarks         — zoznam uložených (JSON)
 */

'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// Všetky endpointy vyžadujú prihlásenie
router.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Neprihlásený' });
  next();
});

// POST /toggle
router.post('/toggle', async (req, res) => {
  try {
    const articleId = Number(req.body.article_id);
    if (!articleId || !Number.isInteger(articleId)) {
      return res.status(400).json({ error: 'Neplatné article_id' });
    }

    const existing = await db('user_bookmarks')
      .where({ user_id: req.user.id, article_id: articleId })
      .first();

    if (existing) {
      await db('user_bookmarks').where('id', existing.id).del();
      return res.json({ ok: true, saved: false });
    }

    await db('user_bookmarks').insert({
      user_id: req.user.id,
      article_id: articleId,
    });
    res.json({ ok: true, saved: true });
  } catch (err) {
    res.status(500).json({ error: 'Chyba' });
  }
});

// GET /check?article_id=X
router.get('/check', async (req, res) => {
  try {
    const articleId = Number(req.query.article_id);
    if (!articleId) return res.json({ saved: false });

    const existing = await db('user_bookmarks')
      .where({ user_id: req.user.id, article_id: articleId })
      .first();

    res.json({ saved: !!existing });
  } catch (err) {
    res.status(500).json({ error: 'Chyba' });
  }
});

// GET / — zoznam
router.get('/', async (req, res) => {
  try {
    const rows = await db('user_bookmarks')
      .join('articles', 'user_bookmarks.article_id', 'articles.id')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
      .where('user_bookmarks.user_id', req.user.id)
      .where('articles.status', 'published')
      .select(
        'articles.id',
        'articles.title',
        'articles.slug',
        'articles.excerpt',
        'articles.type',
        'articles.published_at',
        'articles.view_count',
        'users.nickname as author_name',
        'media.thumbnail_path as cover_thumb',
        'user_bookmarks.created_at as saved_at'
      )
      .orderBy('user_bookmarks.created_at', 'desc');

    res.json({ bookmarks: rows });
  } catch (err) {
    res.status(500).json({ error: 'Chyba' });
  }
});

module.exports = router;
