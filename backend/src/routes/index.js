/**
 * Routes index  (Phase 6.1 — homepage frontend)
 *
 * Pridané: homepage route načíta reálne dáta z DB.
 */

'use strict';

const express = require('express');

const adminRouter = require('./admin');
const adminMediaRouter = require('./admin-media');
const adminRubricsRouter = require('./admin-rubrics');
const adminTagsRouter = require('./admin-tags');
const adminCategoriesRouter = require('./admin-categories');
const adminArticlesRouter = require('./admin-articles');
const blockRenderer = require('../utils/block-renderer');
const authRouter = require('./auth');
const profileRouter = require('./profile');
const healthRouter = require('./health');
const config = require('../../../config');
const db = require('../db');
const log = require('../logger');

const router = express.Router();

// Špecifické admin prefixy
router.use('/admin/media', adminMediaRouter);
router.use('/admin/rubrics', adminRubricsRouter);
router.use('/admin/tags', adminTagsRouter);
router.use('/admin/categories', adminCategoriesRouter);
router.use('/admin/articles', adminArticlesRouter);
router.use('/admin', adminRouter);

router.use('/health', healthRouter);
router.use('/', authRouter);
router.use('/', profileRouter);

// ---------------------------------------------------------------------------
// ARTICLE DETAIL
// ---------------------------------------------------------------------------
router.get('/clanok/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;

    const article = await db('articles')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media as cover', 'articles.cover_media_id', 'cover.id')
      .leftJoin('media as og', 'articles.og_image_media_id', 'og.id')
      .where('articles.slug', slug)
      .where('articles.status', 'published')
      .select(
        'articles.*',
        'users.nickname as author_name',
        'cover.thumbnail_path as cover_thumb',
        'cover.original_path as cover_full',
        'og.original_path as og_path'
      )
      .first();

    if (!article) return next(); // 404

    // Increment view count (fire-and-forget)
    db('articles')
      .where('id', article.id)
      .increment('view_count', 1)
      .catch(() => {});

    // Parse content
    let content = [];
    try {
      content =
        typeof article.content === 'string' ? JSON.parse(article.content) : article.content || [];
      if (!Array.isArray(content)) content = [];
    } catch {
      content = [];
    }

    // Load media for image/gallery blocks
    const mediaIds = [];
    for (const b of content) {
      if (b.type === 'image' && b.media_id) mediaIds.push(b.media_id);
      if (b.type === 'gallery' && Array.isArray(b.items)) {
        for (const it of b.items) {
          if (it.media_id) mediaIds.push(it.media_id);
        }
      }
    }
    let mediaMap = new Map();
    if (mediaIds.length > 0) {
      const rows = await db('media')
        .whereIn('id', [...new Set(mediaIds)])
        .select('id', 'thumbnail_path', 'original_path');
      mediaMap = new Map(rows.map((r) => [r.id, r]));
    }

    // Render blocks to HTML
    const contentHtml = blockRenderer.renderBlocks(content, { mediaMap });
    const toc = blockRenderer.extractToc(content);

    // Primary category
    const catRow = await db('article_categories')
      .join('categories', 'article_categories.category_id', 'categories.id')
      .where('article_categories.article_id', article.id)
      .where('article_categories.is_primary', 1)
      .select('categories.name', 'categories.slug')
      .first();

    // Tags
    const tags = await db('article_tags')
      .join('tags', 'article_tags.tag_id', 'tags.id')
      .where('article_tags.article_id', article.id)
      .select('tags.name', 'tags.slug', 'tags.color');

    // Related articles (manuálne)
    const relatedArticles = await db('article_related')
      .join('articles as ra', 'article_related.related_article_id', 'ra.id')
      .leftJoin('media as rm', 'ra.cover_media_id', 'rm.id')
      .where('article_related.article_id', article.id)
      .where('ra.status', 'published')
      .select('ra.id', 'ra.title', 'ra.slug', 'ra.published_at', 'rm.thumbnail_path as cover_thumb')
      .orderBy('article_related.display_order', 'asc')
      .limit(5);

    // Ak nemá manuálne related, doplň auto (rovnaká kategória)
    if (relatedArticles.length === 0 && catRow) {
      const auto = await db('article_categories')
        .join('articles as ra', 'article_categories.article_id', 'ra.id')
        .leftJoin('media as rm', 'ra.cover_media_id', 'rm.id')
        .where('article_categories.category_id', function () {
          this.select('id').from('categories').where('slug', catRow.slug).first();
        })
        .where('ra.status', 'published')
        .where('ra.id', '!=', article.id)
        .select(
          'ra.id',
          'ra.title',
          'ra.slug',
          'ra.published_at',
          'rm.thumbnail_path as cover_thumb'
        )
        .orderBy('ra.published_at', 'desc')
        .limit(5);
      relatedArticles.push(...auto);
    }

    // Read time estimate from content
    let wordCount = 0;
    for (const b of content) {
      if (b.text) wordCount += b.text.split(/\s+/).length;
      if (b.type === 'list' && Array.isArray(b.items)) {
        for (const it of b.items) wordCount += String(it).split(/\s+/).length;
      }
    }
    const readTime = Math.max(3, Math.round(wordCount / 200)) + ' min';
    const viewsFormatted =
      article.view_count >= 1000
        ? (article.view_count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
        : String(article.view_count || 0);

    // OG image URL
    let ogImage = null;
    if (article.og_path) ogImage = '/uploads/' + article.og_path;
    else if (article.cover_full) ogImage = '/uploads/' + article.cover_full;

    res.render('article/show', {
      title: article.seo_title || article.title,
      currentPath: '/clanok/' + article.slug,
      article,
      contentHtml,
      toc,
      coverImage: article.cover_full || null,
      ogImage,
      category: catRow || null,
      tags,
      relatedArticles,
      readTime,
      viewsFormatted,
    });
  } catch (err) {
    log.error('article detail failed', { err: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// HOMEPAGE
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    // 1. Featured články pre slider (posledné 4 featured + published)
    const featured = await db('articles')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
      .where('articles.status', 'published')
      .where('articles.is_featured', 1)
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
        'media.original_path as cover_full'
      )
      .orderBy('articles.published_at', 'desc')
      .limit(4);

    // 2. Najnovšie články (pre Novinky sekciu — bento)
    const latest = await db('articles')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
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
        'media.original_path as cover_full'
      )
      .orderBy('articles.published_at', 'desc')
      .limit(8);

    // 3. Trending — TOP 6 najčítanejších za posledný týždeň
    const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000);
    const trending = await db('articles')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
      .where('articles.status', 'published')
      .where('articles.published_at', '>=', oneWeekAgo)
      .select(
        'articles.id',
        'articles.title',
        'articles.slug',
        'articles.excerpt',
        'articles.type',
        'articles.published_at',
        'articles.view_count',
        'users.nickname as author_name',
        'media.thumbnail_path as cover_thumb'
      )
      .orderBy('articles.view_count', 'desc')
      .limit(6);

    // Ak nie je dosť trending článkov za týždeň, dopln celkovo najčítanejšie
    if (trending.length < 6) {
      const excludeIds = trending.map((a) => a.id);
      const extra = await db('articles')
        .leftJoin('users', 'articles.author_id', 'users.id')
        .leftJoin('media', 'articles.cover_media_id', 'media.id')
        .where('articles.status', 'published')
        .whereNotIn('articles.id', excludeIds)
        .select(
          'articles.id',
          'articles.title',
          'articles.slug',
          'articles.excerpt',
          'articles.type',
          'articles.published_at',
          'articles.view_count',
          'users.nickname as author_name',
          'media.thumbnail_path as cover_thumb'
        )
        .orderBy('articles.view_count', 'desc')
        .limit(6 - trending.length);
      trending.push(...extra);
    }

    // 4. Editor's Pick — najčítanejší published článok
    const editorsPick = await db('articles')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
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
        'media.original_path as cover_full'
      )
      .orderBy('articles.view_count', 'desc')
      .first();

    // 5. Reviews — posledné published recenzie
    const reviews = await db('articles')
      .leftJoin('users', 'articles.author_id', 'users.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
      .where('articles.status', 'published')
      .where('articles.type', 'review')
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
        'media.original_path as cover_full'
      )
      .orderBy('articles.published_at', 'desc')
      .limit(6);

    // 4. Tagy pre článok (pre bento overlay tag)
    const articleIds = [...new Set([...featured, ...latest, ...trending].map((a) => a.id))];
    let tagMap = new Map();
    if (articleIds.length > 0) {
      const tagRows = await db('article_tags')
        .join('tags', 'article_tags.tag_id', 'tags.id')
        .whereIn('article_tags.article_id', articleIds)
        .select('article_tags.article_id', 'tags.name', 'tags.slug', 'tags.color');
      for (const r of tagRows) {
        if (!tagMap.has(r.article_id)) tagMap.set(r.article_id, []);
        tagMap.get(r.article_id).push(r);
      }
    }

    // 5. Primárna kategória pre článok
    let catMap = new Map();
    if (articleIds.length > 0) {
      const catRows = await db('article_categories')
        .join('categories', 'article_categories.category_id', 'categories.id')
        .whereIn('article_categories.article_id', articleIds)
        .where('article_categories.is_primary', 1)
        .select('article_categories.article_id', 'categories.name', 'categories.slug');
      for (const r of catRows) {
        catMap.set(r.article_id, r);
      }
    }

    // 6. Rubriky pre článok
    let rubMap = new Map();
    if (articleIds.length > 0) {
      const rubRows = await db('article_rubrics')
        .join('rubrics', 'article_rubrics.rubric_id', 'rubrics.id')
        .whereIn('article_rubrics.article_id', articleIds)
        .select('article_rubrics.article_id', 'rubrics.name', 'rubrics.slug');
      for (const r of rubRows) {
        if (!rubMap.has(r.article_id)) rubMap.set(r.article_id, []);
        rubMap.get(r.article_id).push(r);
      }
    }

    // Helper: obohat článok o relačné dáta
    function enrich(a) {
      return {
        ...a,
        tags: tagMap.get(a.id) || [],
        category: catMap.get(a.id) || null,
        rubrics: rubMap.get(a.id) || [],
        readTime: estimateReadTime(a.excerpt),
        viewsFormatted: formatViews(a.view_count),
      };
    }

    function estimateReadTime(excerpt) {
      // Odhad — na reálnej stránke by sa počítalo z content blokov
      if (!excerpt) return '3 min';
      const words = excerpt.split(/\s+/).length;
      const min = Math.max(3, Math.round(words / 40));
      return min + ' min';
    }

    function formatViews(count) {
      if (!count || count === 0) return '0';
      if (count >= 1000) return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
      return String(count);
    }

    res.render('home/index', {
      title: null,
      currentPath: req.path,
      featured: featured.map(enrich),
      latest: latest.map(enrich),
      trending: trending.map(enrich),
      editorsPick: editorsPick ? enrich(editorsPick) : null,
      reviews: reviews.map(enrich),
    });
  } catch (err) {
    log.error('homepage query failed', { err: err.message });
    next(err);
  }
});

router.get('/dev', (req, res) => {
  res.render('_dev/welcome', {
    title: config.app.name + ' — Debug',
    appName: config.app.name,
    env: config.app.env,
    nodeVersion: process.version,
    serverTime: new Date().toISOString(),
  });
});

module.exports = router;
