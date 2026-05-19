/**
 * Banner stats utility — načítanie štatistík pre admin
 */

'use strict';

const db = require('../db');

/**
 * Celkový súhrn pre dashboard kartu
 */
async function getDashboardStats() {
  const totals = await db('banner_events')
    .select(
      db.raw("SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as total_views"),
      db.raw("SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as total_clicks")
    )
    .first();

  const totalViews = Number(totals?.total_views || 0);
  const totalClicks = Number(totals?.total_clicks || 0);
  const avgCtr = totalViews > 0 ? Math.round((totalClicks / totalViews) * 10000) / 100 : 0;

  const activeBanners = await db('banners')
    .where('status', 'active')
    .count({ c: '*' })
    .first()
    .then((r) => Number(r.c));

  // Top 5 bannerov podľa views
  const topBanners = await db('banner_events')
    .join('banners', 'banner_events.banner_id', 'banners.id')
    .select(
      'banners.id',
      'banners.name',
      db.raw("SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views"),
      db.raw("SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks")
    )
    .groupBy('banners.id', 'banners.name')
    .orderBy('views', 'desc')
    .limit(5);

  return {
    totalViews,
    totalClicks,
    avgCtr,
    activeBanners,
    topBanners: topBanners.map((b) => {
      const v = Number(b.views);
      const c = Number(b.clicks);
      return {
        id: b.id,
        name: b.name,
        views: v,
        clicks: c,
        ctr: v > 0 ? Math.round((c / v) * 10000) / 100 : 0,
      };
    }),
  };
}

/**
 * Stats pre admin banner list (views/clicks/ctr per banner)
 */
async function getListStats(bannerIds) {
  if (!bannerIds || bannerIds.length === 0) return new Map();

  const rows = await db('banner_events')
    .whereIn('banner_id', bannerIds)
    .select(
      'banner_id',
      db.raw("SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) as views"),
      db.raw("SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks")
    )
    .groupBy('banner_id');

  const map = new Map();
  for (const r of rows) {
    const v = Number(r.views);
    const c = Number(r.clicks);
    map.set(r.banner_id, {
      views: v,
      clicks: c,
      ctr: v > 0 ? Math.round((c / v) * 10000) / 100 : 0,
    });
  }
  return map;
}

module.exports = {
  getDashboardStats,
  getListStats,
};
