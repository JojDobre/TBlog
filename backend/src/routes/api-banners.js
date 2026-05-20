/**
 * Banner tracking API  (mounted at /api/banners)
 *
 * POST /track  — zaznamená view alebo click
 * GET  /stats/:id — stats pre admin (JSON)
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashIp(ip) {
  const salt = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update((ip || '') + salt)
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// POST /track — fire-and-forget tracking
// ---------------------------------------------------------------------------

router.post('/track', async (req, res) => {
  try {
    const bannerId = Number(req.body.banner_id);
    const eventType = req.body.event_type;
    const pageUrl = String(req.body.page_url || '').slice(0, 500) || null;
    const positionKey = String(req.body.position_key || '').slice(0, 100) || null;

    if (!bannerId || !['view', 'click'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid params' });
    }

    const ipHash = hashIp(req.ip || req.connection.remoteAddress);
    const ua = String(req.get('user-agent') || '').slice(0, 500) || null;

    // Insert event (fire-and-forget)
    db('banner_events')
      .insert({
        banner_id: bannerId,
        event_type: eventType,
        page_url: pageUrl,
        position_key: positionKey,
        ip_hash: ipHash,
        user_agent: ua,
      })
      .catch(() => {});

    // Upsert denná agregácia
    const today = new Date().toISOString().slice(0, 10);
    const viewInc = eventType === 'view' ? 1 : 0;
    const clickInc = eventType === 'click' ? 1 : 0;

    const existing = await db('banner_stats_daily')
      .where({ banner_id: bannerId, day: today })
      .first();

    if (existing) {
      await db('banner_stats_daily')
        .where('id', existing.id)
        .increment('views', viewInc)
        .increment('clicks', clickInc);
    } else {
      await db('banner_stats_daily')
        .insert({
          banner_id: bannerId,
          day: today,
          views: viewInc,
          clicks: clickInc,
          unique_views: 0,
          unique_clicks: 0,
        })
        .catch(() => {
          // Race condition — retry as update
          db('banner_stats_daily')
            .where({ banner_id: bannerId, day: today })
            .increment('views', viewInc)
            .increment('clicks', clickInc)
            .catch(() => {});
        });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'tracking failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/:id — detailné stats pre admin
// ---------------------------------------------------------------------------

router.get('/stats/:id', async (req, res) => {
  try {
    const bannerId = Number(req.params.id);
    if (!bannerId) return res.status(400).json({ error: 'Invalid ID' });

    // Celkové počty
    const totals = await db('banner_events')
      .where('banner_id', bannerId)
      .select(
        db.raw("SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as total_views"),
        db.raw("SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as total_clicks"),
        db.raw("COUNT(DISTINCT CASE WHEN event_type = 'view' THEN ip_hash END) as unique_views"),
        db.raw("COUNT(DISTINCT CASE WHEN event_type = 'click' THEN ip_hash END) as unique_clicks")
      )
      .first();

    // Denné stats za posledných 30 dní
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const daily = await db('banner_stats_daily')
      .where('banner_id', bannerId)
      .where('day', '>=', thirtyDaysAgo)
      .orderBy('day', 'asc')
      .select('day', 'views', 'clicks');

    // Top stránky
    const topPages = await db('banner_events')
      .where('banner_id', bannerId)
      .where('event_type', 'view')
      .whereNotNull('page_url')
      .select('page_url')
      .count({ c: '*' })
      .groupBy('page_url')
      .orderBy('c', 'desc')
      .limit(10);

    // Top pozície
    const topPositions = await db('banner_events')
      .where('banner_id', bannerId)
      .where('event_type', 'view')
      .whereNotNull('position_key')
      .select('position_key')
      .count({ c: '*' })
      .groupBy('position_key')
      .orderBy('c', 'desc')
      .limit(10);

    const totalViews = Number(totals?.total_views || 0);
    const totalClicks = Number(totals?.total_clicks || 0);

    res.json({
      totals: {
        views: totalViews,
        clicks: totalClicks,
        unique_views: Number(totals?.unique_views || 0),
        unique_clicks: Number(totals?.unique_clicks || 0),
        ctr: totalViews > 0 ? Math.round((totalClicks / totalViews) * 10000) / 100 : 0,
      },
      daily,
      topPages: topPages.map((p) => ({ url: p.page_url, count: Number(p.c) })),
      topPositions: topPositions.map((p) => ({ key: p.position_key, count: Number(p.c) })),
    });
  } catch (err) {
    res.status(500).json({ error: 'stats failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /stats-summary — súhrn pre admin list (všetky bannery)
// ---------------------------------------------------------------------------

router.get('/stats-summary', async (req, res) => {
  try {
    const rows = await db('banner_events')
      .select(
        'banner_id',
        db.raw("SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views"),
        db.raw("SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks")
      )
      .groupBy('banner_id');

    const map = {};
    for (const r of rows) {
      const views = Number(r.views);
      const clicks = Number(r.clicks);
      map[r.banner_id] = {
        views,
        clicks,
        ctr: views > 0 ? Math.round((clicks / views) * 10000) / 100 : 0,
      };
    }

    res.json(map);
  } catch (err) {
    res.status(500).json({ error: 'summary failed' });
  }
});

// ---------------------------------------------------------------------------
// GET /list — zoznam bannerov pre editor block picker
// ---------------------------------------------------------------------------

router.get('/list', async (req, res) => {
  try {
    const rows = await db('banners')
      .leftJoin('banner_placements', 'banners.id', 'banner_placements.banner_id')
      .leftJoin('banner_positions', 'banner_placements.position_id', 'banner_positions.id')
      .select(
        'banners.id',
        'banners.name',
        'banners.type',
        'banners.template_key',
        'banners.status',
        db.raw("GROUP_CONCAT(banner_positions.label SEPARATOR ', ') as positions")
      )
      .groupBy('banners.id')
      .orderBy('banners.name');

    res.json({ banners: rows });
  } catch (err) {
    res.status(500).json({ error: 'list failed' });
  }
});

module.exports = router;
