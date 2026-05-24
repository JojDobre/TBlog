/**
 * Dashboard stats utility
 *
 * Načíta všetky dáta pre dashboard/stats karty jedným volaním.
 * Výsledok je objekt `s` posielaný do šablón.
 */

'use strict';

const db = require('../db');

async function loadDashboardStats() {
  const s = {};
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(todayStart - 86400000);
  const sevenDaysAgo = new Date(now - 7 * 86400000);
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  const sixtyDaysAgo = new Date(now - 60 * 86400000);
  const sixMonthsAgo = new Date(now - 180 * 86400000);

  // ===========================================================================
  // OBSAH
  // ===========================================================================

  // Overview counts
  const [totalArticles, totalPublished, totalComments, totalMedia] = await Promise.all([
    db('articles').count({ c: '*' }).first().then(r => Number(r.c)),
    db('articles').where('status', 'published').count({ c: '*' }).first().then(r => Number(r.c)),
    db('comments').count({ c: '*' }).first().then(r => Number(r.c)),
    db('media').count({ c: '*' }).first().then(r => Number(r.c)),
  ]);
  s.totalArticles = totalArticles;
  s.totalPublished = totalPublished;
  s.totalComments = totalComments;
  s.totalMedia = totalMedia;

  // Views 30d + previous 30d for growth
  const [views30d, viewsPrev30d, uniqueVisitors30d] = await Promise.all([
    db('page_visits').where('viewed_at', '>=', thirtyDaysAgo).count({ c: '*' }).first().then(r => Number(r.c)),
    db('page_visits').where('viewed_at', '>=', sixtyDaysAgo).where('viewed_at', '<', thirtyDaysAgo).count({ c: '*' }).first().then(r => Number(r.c)),
    db('page_visits').where('viewed_at', '>=', thirtyDaysAgo).countDistinct({ c: 'ip_hash' }).first().then(r => Number(r.c)),
  ]);
  s.views30d = views30d;
  s.viewsPrev30d = viewsPrev30d;
  s.viewsGrowth = viewsPrev30d > 0 ? Math.round(((views30d - viewsPrev30d) / viewsPrev30d) * 100) : 0;
  s.uniqueVisitors30d = uniqueVisitors30d;

  // Scheduled articles
  s.scheduled = await db('articles')
    .leftJoin('users', 'articles.author_id', 'users.id')
    .where('articles.status', 'scheduled')
    .select('articles.id', 'articles.title', 'articles.scheduled_at', 'users.nickname as author')
    .orderBy('articles.scheduled_at', 'asc')
    .limit(10);

  // Draft articles
  s.drafts = await db('articles')
    .leftJoin('users', 'articles.author_id', 'users.id')
    .where('articles.status', 'draft')
    .select('articles.id', 'articles.title', 'articles.updated_at', 'users.nickname as author')
    .orderBy('articles.updated_at', 'desc')
    .limit(10);

  // Recently published
  s.recentlyPublished = await db('articles')
    .leftJoin('users', 'articles.author_id', 'users.id')
    .where('articles.status', 'published')
    .select('articles.id', 'articles.title', 'articles.published_at', 'articles.view_count', 'users.nickname as author')
    .orderBy('articles.published_at', 'desc')
    .limit(5);

  // Top today (by page_visits)
  s.topToday = await db('page_visits')
    .join('articles', 'page_visits.article_id', 'articles.id')
    .where('page_visits.viewed_at', '>=', todayStart)
    .whereNotNull('page_visits.article_id')
    .select('articles.id', 'articles.title', 'articles.slug')
    .count({ views: '*' })
    .groupBy('articles.id', 'articles.title', 'articles.slug')
    .orderBy('views', 'desc')
    .limit(5);
  s.topToday.forEach(r => { r.views = Number(r.views); });

  // Trending (biggest view growth last 7d vs previous 7d)
  const trendingRaw = await db('page_visits')
    .join('articles', 'page_visits.article_id', 'articles.id')
    .where('page_visits.viewed_at', '>=', sevenDaysAgo)
    .whereNotNull('page_visits.article_id')
    .where('articles.status', 'published')
    .select('articles.id', 'articles.title')
    .count({ views: '*' })
    .groupBy('articles.id', 'articles.title')
    .orderBy('views', 'desc')
    .limit(5);
  s.trending = trendingRaw.map(r => ({ ...r, views: Number(r.views) }));

  // No image
  s.noImage = await db('articles')
    .whereNull('cover_media_id')
    .where('status', 'published')
    .select('id', 'title')
    .orderBy('published_at', 'desc')
    .limit(10);

  // Awaiting review
  s.awaitingReview = await db('articles')
    .leftJoin('users', 'articles.author_id', 'users.id')
    .where('articles.status', 'review')
    .select('articles.id', 'articles.title', 'articles.updated_at', 'users.nickname as author')
    .orderBy('articles.updated_at', 'desc')
    .limit(10);

  // Stale articles (published, not updated in 6 months)
  s.staleArticles = await db('articles')
    .where('status', 'published')
    .where('updated_at', '<', sixMonthsAgo)
    .select('id', 'title', 'updated_at', 'view_count')
    .orderBy('updated_at', 'asc')
    .limit(10);

  // Recently edited
  s.recentlyEdited = await db('articles')
    .leftJoin('users', 'articles.author_id', 'users.id')
    .select('articles.id', 'articles.title', 'articles.updated_at', 'articles.status', 'users.nickname as author')
    .orderBy('articles.updated_at', 'desc')
    .limit(5);

  // Most commented
  s.mostCommented = await db('comments')
    .join('articles', 'comments.article_id', 'articles.id')
    .where('comments.is_deleted_by_admin', false)
    .select('articles.id', 'articles.title')
    .count({ cnt: '*' })
    .groupBy('articles.id', 'articles.title')
    .orderBy('cnt', 'desc')
    .limit(5);
  s.mostCommented.forEach(r => { r.cnt = Number(r.cnt); });

  // Low SEO (missing seo_title or seo_description)
  s.lowSeo = await db('articles')
    .where('status', 'published')
    .where(function () {
      this.whereNull('seo_title').orWhere('seo_title', '').orWhereNull('seo_description').orWhere('seo_description', '');
    })
    .select('id', 'title')
    .orderBy('published_at', 'desc')
    .limit(10);

  // No tags
  s.noTags = await db('articles')
    .leftJoin('article_tags', 'articles.id', 'article_tags.article_id')
    .where('articles.status', 'published')
    .whereNull('article_tags.article_id')
    .select('articles.id', 'articles.title')
    .limit(10);

  // No category
  s.noCategory = await db('articles')
    .leftJoin('article_categories', 'articles.id', 'article_categories.article_id')
    .where('articles.status', 'published')
    .whereNull('article_categories.article_id')
    .select('articles.id', 'articles.title')
    .limit(10);

  // Longest read (by content length)
  s.longestRead = await db('articles')
    .where('status', 'published')
    .select('id', 'title', db.raw('LENGTH(content) as content_len'))
    .orderBy('content_len', 'desc')
    .limit(5);
  s.longestRead.forEach(r => {
    const words = Math.round(Number(r.content_len) / 6);
    r.readTime = Math.max(1, Math.round(words / 200));
  });

  // ===========================================================================
  // RECENZIE
  // ===========================================================================

  const reviewScores = await db('ranking_items as ri')
    .join('articles as a', 'ri.article_id', 'a.id')
    .leftJoin('ranking_item_values as riv', 'riv.ranking_item_id', 'ri.id')
    .leftJoin('ranking_criteria as rc', 'rc.id', 'riv.criterion_id')
    .where('a.status', 'published')
    .where('a.type', 'review')
    .groupBy('ri.id', 'ri.article_id', 'a.title', 'ri.override_score')
    .select(
      'a.id', 'a.title', 'ri.override_score',
      db.raw("AVG(CASE WHEN rc.field_type != 'price' THEN riv.value_decimal END) as avg_score")
    );

  const scoredReviews = reviewScores.map(r => {
    const score = r.override_score != null ? Number(r.override_score)
      : r.avg_score != null ? Math.round(Number(r.avg_score) * 10) / 10 : null;
    return { id: r.id, title: r.title, score };
  }).filter(r => r.score !== null);

  s.topReviews = [...scoredReviews].sort((a, b) => b.score - a.score).slice(0, 5);
  s.bestRated = s.topReviews.slice(0, 5);
  s.worstRated = [...scoredReviews].sort((a, b) => a.score - b.score).slice(0, 5);

  s.unpublishedReviews = await db('articles')
    .leftJoin('users', 'articles.author_id', 'users.id')
    .where('articles.type', 'review')
    .whereNot('articles.status', 'published')
    .select('articles.id', 'articles.title', 'articles.status', 'users.nickname as author')
    .orderBy('articles.updated_at', 'desc')
    .limit(10);

  // ===========================================================================
  // KOMUNITA
  // ===========================================================================

  // New comments 24h
  s.newComments24h = await db('comments')
    .where('created_at', '>=', todayStart)
    .count({ c: '*' }).first().then(r => Number(r.c));

  s.newCommentsWeek = await db('comments')
    .where('created_at', '>=', sevenDaysAgo)
    .count({ c: '*' }).first().then(r => Number(r.c));

  // Recently deleted comments
  s.recentlyDeleted = await db('comments')
    .join('articles', 'comments.article_id', 'articles.id')
    .leftJoin('users', 'comments.user_id', 'users.id')
    .where('comments.is_deleted_by_admin', true)
    .select('comments.id', 'comments.content', 'comments.created_at', 'articles.title as article_title', 'users.nickname as user_name')
    .orderBy('comments.updated_at', 'desc')
    .limit(5);

  // Top commenters
  s.topCommenters = await db('comments')
    .join('users', 'comments.user_id', 'users.id')
    .where('comments.is_deleted_by_admin', false)
    .select('users.id', 'users.nickname')
    .count({ cnt: '*' })
    .groupBy('users.id', 'users.nickname')
    .orderBy('cnt', 'desc')
    .limit(5);
  s.topCommenters.forEach(r => { r.cnt = Number(r.cnt); });

  // New registrations
  s.newRegistrations = await db('users')
    .select('id', 'nickname', 'email', 'role', 'created_at')
    .orderBy('created_at', 'desc')
    .limit(5);

  // Online users (page_visits in last 5 min)
  const fiveMinAgo = new Date(now - 5 * 60000);
  s.onlineUsers = await db('page_visits')
    .where('viewed_at', '>=', fiveMinAgo)
    .countDistinct({ c: 'ip_hash' })
    .first().then(r => Number(r.c));

  // Top authors (by published articles count)
  s.topAuthors = await db('articles')
    .join('users', 'articles.author_id', 'users.id')
    .where('articles.status', 'published')
    .select('users.id', 'users.nickname')
    .count({ cnt: '*' })
    .groupBy('users.id', 'users.nickname')
    .orderBy('cnt', 'desc')
    .limit(5);
  s.topAuthors.forEach(r => { r.cnt = Number(r.cnt); });

  // ===========================================================================
  // NÁVŠTEVNOSŤ
  // ===========================================================================

  // Views today
  s.viewsToday = await db('page_visits')
    .where('viewed_at', '>=', todayStart)
    .count({ c: '*' }).first().then(r => Number(r.c));

  s.viewsYesterday = await db('page_visits')
    .where('viewed_at', '>=', yesterday)
    .where('viewed_at', '<', todayStart)
    .count({ c: '*' }).first().then(r => Number(r.c));

  // Unique visitors today
  s.uniqueToday = await db('page_visits')
    .where('viewed_at', '>=', todayStart)
    .countDistinct({ c: 'ip_hash' }).first().then(r => Number(r.c));

  // Views 30d daily (for chart)
  s.viewsDaily = await db('page_visits')
    .where('viewed_at', '>=', thirtyDaysAgo)
    .select(db.raw('DATE(viewed_at) as day'))
    .count({ views: '*' })
    .groupBy('day')
    .orderBy('day', 'asc');
  s.viewsDaily.forEach(r => { r.views = Number(r.views); });

  // Top pages
  s.topPages = await db('page_visits')
    .where('viewed_at', '>=', thirtyDaysAgo)
    .select('path')
    .count({ views: '*' })
    .groupBy('path')
    .orderBy('views', 'desc')
    .limit(10);
  s.topPages.forEach(r => { r.views = Number(r.views); });

  // Best hour
  s.bestHour = await db('page_visits')
    .where('viewed_at', '>=', thirtyDaysAgo)
    .select(db.raw('HOUR(viewed_at) as h'))
    .count({ cnt: '*' })
    .groupBy('h')
    .orderBy('cnt', 'desc')
    .first();
  s.bestHourVal = s.bestHour ? Number(s.bestHour.h) : null;
  s.bestHourCount = s.bestHour ? Number(s.bestHour.cnt) : 0;

  // Best day of week
  s.bestDayData = await db('page_visits')
    .where('viewed_at', '>=', thirtyDaysAgo)
    .select(db.raw('DAYOFWEEK(viewed_at) as dow'))
    .count({ cnt: '*' })
    .groupBy('dow')
    .orderBy('cnt', 'desc')
    .first();
  const dayNames = ['', 'Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
  s.bestDayName = s.bestDayData ? dayNames[Number(s.bestDayData.dow)] || '?' : '—';
  s.bestDayCount = s.bestDayData ? Number(s.bestDayData.cnt) : 0;

  // Traffic trend (daily for 30d)
  s.trafficTrend = s.viewsDaily; // reuse

  // Devices (parse user_agent_short)
  const deviceRows = await db('page_visits')
    .where('viewed_at', '>=', thirtyDaysAgo)
    .whereNotNull('user_agent_short')
    .select('user_agent_short')
    .limit(5000);
  let mobile = 0, desktop = 0, tablet = 0;
  deviceRows.forEach(r => {
    const ua = (r.user_agent_short || '').toLowerCase();
    if (/mobile|iphone|android.*mobile/.test(ua)) mobile++;
    else if (/ipad|tablet|android(?!.*mobile)/.test(ua)) tablet++;
    else desktop++;
  });
  const devTotal = mobile + desktop + tablet || 1;
  s.devices = {
    mobile: Math.round(mobile / devTotal * 100),
    desktop: Math.round(desktop / devTotal * 100),
    tablet: Math.round(tablet / devTotal * 100),
  };

  // ===========================================================================
  // SEO
  // ===========================================================================

  s.seoWithTitle = await db('articles').where('status', 'published').whereNotNull('seo_title').where('seo_title', '!=', '').count({ c: '*' }).first().then(r => Number(r.c));
  s.seoWithDesc = await db('articles').where('status', 'published').whereNotNull('seo_description').where('seo_description', '!=', '').count({ c: '*' }).first().then(r => Number(r.c));
  s.seoTotal = totalPublished;

  // Missing meta
  s.missingMeta = s.lowSeo; // reuse

  // Duplicate titles
  s.duplicateTitles = await db('articles')
    .where('status', 'published')
    .select('seo_title')
    .count({ cnt: '*' })
    .groupBy('seo_title')
    .having('cnt', '>', 1)
    .whereNotNull('seo_title')
    .where('seo_title', '!=', '')
    .orderBy('cnt', 'desc')
    .limit(10);
  s.duplicateTitles.forEach(r => { r.cnt = Number(r.cnt); });

  // ===========================================================================
  // BEZPEČNOSŤ
  // ===========================================================================

  s.activeSessions = await db('sessions').count({ c: '*' }).first().then(r => Number(r.c));

  s.uploadStorage = await db('media').sum({ total: 'size_bytes' }).first().then(r => {
    const bytes = Number(r.total || 0);
    if (bytes > 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return Math.round(bytes / 1024) + ' KB';
  });
  s.uploadCount = totalMedia;

  s.serverUptime = Math.round(process.uptime() / 3600);
  s.serverMemory = Math.round(process.memoryUsage().heapUsed / 1048576);
  s.nodeVersion = process.version;

  // ===========================================================================
  // POKROČILÉ
  // ===========================================================================

  // Top tags
  s.topTags = await db('article_tags')
    .join('tags', 'article_tags.tag_id', 'tags.id')
    .select('tags.name', 'tags.slug')
    .count({ cnt: '*' })
    .groupBy('tags.id', 'tags.name', 'tags.slug')
    .orderBy('cnt', 'desc')
    .limit(10);
  s.topTags.forEach(r => { r.cnt = Number(r.cnt); });

  // Dead content (published, 0 views)
  s.deadContent = await db('articles')
    .where('status', 'published')
    .where(function () { this.where('view_count', 0).orWhereNull('view_count'); })
    .select('id', 'title', 'published_at')
    .orderBy('published_at', 'desc')
    .limit(10);

  return s;
}

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

module.exports = { loadDashboardStats, fmt };
