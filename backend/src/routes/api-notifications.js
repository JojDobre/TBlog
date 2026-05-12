/**
 * API notifications routes  (mounted at /api/notifications)
 *
 * GET  /         — posledných N notifikácií pre prihláseného usera
 * GET  /count    — počet neprečítaných
 * POST /read     — označiť všetky ako prečítané
 * POST /:id/read — označiť jednu ako prečítanú
 */

'use strict';

const express = require('express');

const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const notifications = require('../utils/notifications');

const router = express.Router();

// Všetky endpointy vyžadujú prihlásenie
router.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Neprihlásený.' });
  next();
});

// ---------------------------------------------------------------------------
// GET / — posledných 20 notifikácií
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const rows = await db('notifications')
      .leftJoin('users as actor', 'notifications.actor_id', 'actor.id')
      .leftJoin('articles', 'notifications.article_id', 'articles.id')
      .where('notifications.user_id', req.user.id)
      .select(
        'notifications.id',
        'notifications.type',
        'notifications.message',
        'notifications.is_read',
        'notifications.comment_id',
        'notifications.article_id',
        'notifications.created_at',
        'actor.nickname as actor_nickname',
        'articles.slug as article_slug',
        'articles.type as article_type'
      )
      .orderBy('notifications.created_at', 'desc')
      .limit(limit);

    const items = rows.map((r) => ({
      ...r,
      is_read: !!r.is_read,
      url: r.article_slug ? `/clanok/${r.article_slug}` : null,
    }));

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /count — počet neprečítaných
// ---------------------------------------------------------------------------

router.get('/count', async (req, res, next) => {
  try {
    const count = await notifications.unreadCount(db, req.user.id);
    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /read — označiť všetky ako prečítané
// ---------------------------------------------------------------------------

router.post('/read', async (req, res, next) => {
  try {
    await db('notifications')
      .where({ user_id: req.user.id, is_read: false })
      .update({ is_read: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/read — označiť jednu ako prečítanú
// ---------------------------------------------------------------------------

router.post('/:id/read', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID.' });

    await db('notifications').where({ id, user_id: req.user.id }).update({ is_read: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
