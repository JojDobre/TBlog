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
const adminRankingsRouter = require('./admin-rankings');
const apiRouter = require('./api');
const rankingRoutes = require('./ranking-routes');
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
router.use('/admin/rankings', adminRankingsRouter);
router.use('/admin/articles', adminArticlesRouter);
router.use('/admin', adminRouter);

router.use('/health', healthRouter);
router.use('/api', apiRouter);
router.use('/', rankingRoutes);
router.use('/', authRouter);
router.use('/', profileRouter);

// ---------------------------------------------------------------------------
// SEARCH
// ---------------------------------------------------------------------------
router.get('/hladaj', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const type = req.query.type || null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 12;
    const offset = (page - 1) * perPage;

    let results = [];
    let totalResults = 0;
    let totalPages = 1;

    if (q.length >= 2) {
      const qb = db('articles')
        .leftJoin('users', 'articles.author_id', 'users.id')
        .leftJoin('media', 'articles.cover_media_id', 'media.id')
        .where('articles.status', 'published')
        .where(function () {
          this.where('articles.title', 'like', `%${q}%`)
            .orWhere('articles.excerpt', 'like', `%${q}%`)
            .orWhere('articles.search_text', 'like', `%${q}%`);
        });

      if (type === 'article' || type === 'review') qb.where('articles.type', type);

      const countRow = await qb.clone().count({ c: '*' }).first();
      totalResults = Number(countRow.c);
      totalPages = Math.max(1, Math.ceil(totalResults / perPage));

      const rows = await qb
        .clone()
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
        .limit(perPage)
        .offset(offset);

      // Category names
      const ids = rows.map((r) => r.id);
      let catMap = new Map();
      if (ids.length > 0) {
        const catRows = await db('article_categories')
          .join('categories', 'article_categories.category_id', 'categories.id')
          .whereIn('article_categories.article_id', ids)
          .where('article_categories.is_primary', 1)
          .select('article_categories.article_id', 'categories.name');
        for (const r of catRows) catMap.set(r.article_id, r.name);
      }

      results = rows.map((a) => ({
        ...a,
        category_name: catMap.get(a.id) || null,
        viewsFormatted:
          a.view_count >= 1000
            ? (a.view_count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
            : String(a.view_count || 0),
      }));
    }

    // Categories for suggestions
    const categories = await db('categories').select('name', 'slug').orderBy('name').limit(8);

    res.render('search/index', {
      title: q ? 'Hľadanie: ' + q : 'Vyhľadávanie',
      currentPath: '/hladaj',
      q,
      type,
      results,
      totalResults,
      totalPages,
      currentPage: page,
      categories,
    });
  } catch (err) {
    log.error('search failed', { err: err.message });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// SHARED: listing helper
// ---------------------------------------------------------------------------
const PER_PAGE_PUBLIC = 13;

async function buildListing(queryBuilder, { page, sort, type }) {
  const p = Math.max(1, parseInt(page, 11) || 1);
  const offset = (p - 1) * PER_PAGE_PUBLIC;

  if (type === 'article' || type === 'review') queryBuilder.where('articles.type', type);

  const countQ = queryBuilder.clone().count({ c: '*' }).first();
  const total = Number((await countQ).c);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE_PUBLIC));

  const orderCol = sort === 'popular' ? 'articles.view_count' : 'articles.published_at';
  const rows = await queryBuilder
    .clone()
    .leftJoin('users', 'articles.author_id', 'users.id')
    .leftJoin('media', 'articles.cover_media_id', 'media.id')
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
    .orderBy(orderCol, 'desc')
    .limit(PER_PAGE_PUBLIC)
    .offset(offset);

  // Enrich with tags
  const ids = rows.map((r) => r.id);
  let tagMap = new Map();
  if (ids.length > 0) {
    const tRows = await db('article_tags')
      .join('tags', 'article_tags.tag_id', 'tags.id')
      .whereIn('article_tags.article_id', ids)
      .select('article_tags.article_id', 'tags.name', 'tags.slug');
    for (const r of tRows) {
      if (!tagMap.has(r.article_id)) tagMap.set(r.article_id, []);
      tagMap.get(r.article_id).push(r);
    }
  }

  const articles = rows.map((a) => ({
    ...a,
    tags: tagMap.get(a.id) || [],
    readTime: Math.max(3, Math.round((a.excerpt || '').split(/\s+/).length / 40)) + ' min',
    viewsFormatted:
      a.view_count >= 1000
        ? (a.view_count / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
        : String(a.view_count || 0),
  }));

  return { articles, total, totalPages, currentPage: p };
}

// ---------------------------------------------------------------------------
// CATEGORY listing
// ---------------------------------------------------------------------------
router.get('/kategorie', async (req, res, next) => {
  try {
    // Kategórie s počtom článkov
    const cats = await db('categories')
      .leftJoin(
        db('article_categories')
          .select('category_id')
          .count('* as cnt')
          .groupBy('category_id')
          .as('ac'),
        'categories.id',
        'ac.category_id'
      )
      .select(
        'categories.id',
        'categories.name',
        'categories.slug',
        db.raw('COALESCE(ac.cnt, 0) as count')
      )
      .orderBy('categories.name');

    // Články s filtrom a paginaciou
    const sort = req.query.sort || 'newest';
    const type = req.query.type || null;
    const qb = db('articles').where('articles.status', 'published');

    const { articles, total, totalPages, currentPage } = await buildListing(qb, {
      page: req.query.page,
      sort,
      type,
    });

    res.render('listing/browse', {
      title: 'Kategórie & Články',
      currentPath: '/kategorie',
      categories: cats.map((c) => ({
        name: c.name,
        href: '/kategorie/' + c.slug,
        count: Number(c.count),
      })),
      articles,
      totalArticles: total,
      totalPages,
      currentPage,
      currentSort: sort,
      currentType: type,
      baseUrl: '/kategorie',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/kategorie/:slug', async (req, res, next) => {
  try {
    const cat = await db('categories').where('slug', req.params.slug).first();
    if (!cat) return next();

    const sort = req.query.sort || 'newest';
    const type = req.query.type || null;
    const qb = db('articles')
      .join('article_categories', 'articles.id', 'article_categories.article_id')
      .where('article_categories.category_id', cat.id)
      .where('articles.status', 'published');

    const { articles, total, totalPages, currentPage } = await buildListing(qb, {
      page: req.query.page,
      sort,
      type,
    });

    const relatedTags = await db('article_tags')
      .join('tags', 'article_tags.tag_id', 'tags.id')
      .join('article_categories', 'article_tags.article_id', 'article_categories.article_id')
      .where('article_categories.category_id', cat.id)
      .select('tags.name', 'tags.slug')
      .groupBy('tags.id', 'tags.name', 'tags.slug')
      .orderByRaw('COUNT(*) DESC')
      .limit(10);

    res.render('listing/index', {
      title: cat.name,
      currentPath: '/kategorie/' + cat.slug,
      listingTitle: cat.name,
      listingName: cat.name,
      listingTypeLabel: 'Kategória',
      listingDescription: null,
      listingParentLabel: 'Kategórie',
      listingParentHref: '/kategorie',
      baseUrl: '/kategorie/' + cat.slug,
      articles,
      totalArticles: total,
      totalPages,
      currentPage,
      currentSort: sort,
      currentType: type,
      relatedTags,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// RUBRIC listing
// ---------------------------------------------------------------------------
router.get('/rubriky', async (req, res, next) => {
  try {
    const rubs = await db('rubrics')
      .leftJoin(
        db('article_rubrics').select('rubric_id').count('* as cnt').groupBy('rubric_id').as('ar'),
        'rubrics.id',
        'ar.rubric_id'
      )
      .select('rubrics.id', 'rubrics.name', 'rubrics.slug', db.raw('COALESCE(ar.cnt, 0) as count'))
      .orderBy('rubrics.display_order')
      .orderBy('rubrics.name');

    res.render('listing/taxonomy', {
      title: 'Rubriky',
      currentPath: '/rubriky',
      pageTitle: 'Rubriky',
      eyebrow: 'Prehľad',
      subtitle: 'Obsahové sekcie magazínu.',
      taxonomyType: 'rubric',
      items: rubs.map((r) => ({
        name: r.name,
        href: '/rubrika/' + r.slug,
        count: Number(r.count),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rubrika/:slug', async (req, res, next) => {
  try {
    const rub = await db('rubrics').where('slug', req.params.slug).first();
    if (!rub) return next();

    const sort = req.query.sort || 'newest';
    const type = req.query.type || null;
    const qb = db('articles')
      .join('article_rubrics', 'articles.id', 'article_rubrics.article_id')
      .where('article_rubrics.rubric_id', rub.id)
      .where('articles.status', 'published');

    const { articles, total, totalPages, currentPage } = await buildListing(qb, {
      page: req.query.page,
      sort,
      type,
    });

    res.render('listing/index', {
      title: rub.name,
      currentPath: '/rubrika/' + rub.slug,
      listingTitle: rub.name,
      listingName: rub.name,
      listingTypeLabel: 'Rubrika',
      listingDescription: null,
      listingParentLabel: 'Rubriky',
      listingParentHref: '/rubriky',
      baseUrl: '/rubrika/' + rub.slug,
      articles,
      totalArticles: total,
      totalPages,
      currentPage,
      currentSort: sort,
      currentType: type,
      relatedTags: [],
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// TAG listing
// ---------------------------------------------------------------------------
router.get('/tagy', async (req, res, next) => {
  try {
    const tags = await db('tags')
      .leftJoin(
        db('article_tags').select('tag_id').count('* as cnt').groupBy('tag_id').as('at'),
        'tags.id',
        'at.tag_id'
      )
      .select(
        'tags.id',
        'tags.name',
        'tags.slug',
        'tags.color',
        db.raw('COALESCE(at.cnt, 0) as count')
      )
      .orderBy('tags.name');

    res.render('listing/taxonomy', {
      title: 'Tagy',
      currentPath: '/tagy',
      pageTitle: 'Tagy',
      eyebrow: 'Prehľad',
      subtitle: 'Všetky tematické značky.',
      taxonomyType: 'tag',
      items: tags.map((t) => ({
        name: t.name,
        href: '/tag/' + t.slug,
        count: Number(t.count),
        color: t.color,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/tag/:slug', async (req, res, next) => {
  try {
    const tag = await db('tags').where('slug', req.params.slug).first();
    if (!tag) return next();

    const sort = req.query.sort || 'newest';
    const type = req.query.type || null;
    const qb = db('articles')
      .join('article_tags', 'articles.id', 'article_tags.article_id')
      .where('article_tags.tag_id', tag.id)
      .where('articles.status', 'published');

    const { articles, total, totalPages, currentPage } = await buildListing(qb, {
      page: req.query.page,
      sort,
      type,
    });

    res.render('listing/index', {
      title: '#' + tag.name,
      currentPath: '/tag/' + tag.slug,
      listingTitle: '#' + tag.name,
      listingName: '#' + tag.name,
      listingTypeLabel: 'Tag',
      listingDescription: null,
      listingParentLabel: 'Tagy',
      listingParentHref: '/tagy',
      baseUrl: '/tag/' + tag.slug,
      articles,
      totalArticles: total,
      totalPages,
      currentPage,
      currentSort: sort,
      currentType: type,
      relatedTags: [],
    });
  } catch (err) {
    next(err);
  }
});

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
      // section
      if (b.type === 'section' && b.media_id) mediaIds.push(b.media_id);
      // color_variants
      if (b.type === 'color_variants' && Array.isArray(b.variants)) {
        for (const v of b.variants) {
          if (v.media_id) mediaIds.push(v.media_id);
        }
      }
      // review_banner
      if (b.type === 'review_banner') {
        if (b.background_media_id) mediaIds.push(b.background_media_id);
        if (Array.isArray(b.slider_media_ids)) {
          for (const mid of b.slider_media_ids) {
            if (mid) mediaIds.push(mid);
          }
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
      .select(
        'ra.id',
        'ra.title',
        'ra.slug',
        'ra.published_at',
        'ra.view_count',
        'rm.thumbnail_path as cover_thumb'
      )
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
          'ra.view_count',
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

    // Review mock data (neskôr z DB — Phase 8)
    const reviewData =
      article.type === 'review'
        ? {
            score: 9.1,
            badge: "Editor's Choice",
            verdict_title: 'Náš verdikt',
            verdict_text: article.excerpt || '',
            breakdown: [
              { label: 'Dizajn', val: 9.2 },
              { label: 'Displej', val: 9.5 },
              { label: 'Výkon', val: 9.0 },
              { label: 'Kamera', val: 9.6 },
              { label: 'Batéria', val: 8.4 },
              { label: 'Software', val: 9.0 },
              { label: 'Cena/výkon', val: 8.8 },
            ],
            specs: [
              { label: 'Čip', value: 'Tensor G5 (3 nm)' },
              { label: 'RAM', value: '12 GB LPDDR5X' },
              { label: 'Displej', value: '6,7" LTPO OLED, 120 Hz' },
              { label: 'Hlavná kamera', value: '50 MPx f/1.6 OIS' },
              { label: 'Batéria', value: '5 100 mAh, 45 W' },
              { label: 'OS', value: 'Android 16, 7 rokov' },
              { label: 'Cena', value: '1 099 €' },
            ],
            pros: [
              'Kamera, ktorá konečne vie, kedy má prestať s HDR',
              '7 rokov softvérovej podpory',
              'Batéria dva dni bežnej záťaže',
            ],
            cons: [
              '45 W nabíjanie je málo pre túto cenu',
              'Žiadne fyzické tlačidlo na kameru',
              'Multi-core výkon zaostáva za Apple',
            ],
          }
        : { score: null, breakdown: [], specs: [], pros: [], cons: [] };

    const viewTemplate = article.type === 'review' ? 'article/review' : 'article/show';

    res.render(viewTemplate, {
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
      reviewData,
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

router.use((req, res) => {
  res.status(404).render('errors/404', {
    title: 'Stránka nenájdená',
    currentPath: '',
  });
});

module.exports = router;
