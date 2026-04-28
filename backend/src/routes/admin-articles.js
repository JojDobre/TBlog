/**
 * Admin articles routes  (Phase 5.2)
 *
 * Pridané: scheduled_at, is_featured, archived stavy.
 *   - status='scheduled' vyžaduje scheduled_at v budúcnosti; published_at = null
 *   - status='archived' zachováva published_at, ale nie je vo verejných listingoch
 *   - status='published' nastaví published_at pri prvom publikovaní
 *   - is_featured ako boolean (pre highlight na home)
 */

'use strict';

const express = require('express');

const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const articles = require('../utils/articles');
const blocks = require('../utils/blocks');

const router = express.Router();
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

router.get('/media-thumb/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'invalid id' });
    const m = await db('media').where('id', id)
      .select('id', 'thumbnail_path', 'original_filename', 'alt_text').first();
    if (!m) return res.status(404).json({ error: 'not found' });
    res.json(m);
  } catch (err) { next(err); }
});

const PER_PAGE = 20;
const STATUS_TABS = [
  { key: 'all',       label: 'Všetko',     filter: { excludeTrash: true } },
  { key: 'draft',     label: 'Drafty',     filter: { status: 'draft' } },
  { key: 'scheduled', label: 'Naplánované', filter: { status: 'scheduled' } },
  { key: 'published', label: 'Publikované', filter: { status: 'published' } },
  { key: 'archived',  label: 'Archív',     filter: { status: 'archived' } },
  { key: 'trash',     label: 'Kôš',        filter: { status: 'trash' } },
];

// ---------------------------------------------------------------------------
function buildFlash(req) {
  return {
    created: !!req.query.created,
    updated: !!req.query.updated,
    trashed: !!req.query.trashed,
    restored: !!req.query.restored,
    deleted: !!req.query.deleted,
    err: req.query.err ? String(req.query.err) : null,
  };
}

async function loadMediaMap(ids) {
  if (!ids || ids.length === 0) return new Map();
  const rows = await db('media').whereIn('id', ids).select('id', 'thumbnail_path', 'original_filename');
  return new Map(rows.map((r) => [r.id, r]));
}

async function loadRelations(articleId) {
  const [cats, rubs, tags] = await Promise.all([
    db('article_categories').where('article_id', articleId).select('category_id', 'is_primary'),
    db('article_rubrics').where('article_id', articleId).pluck('rubric_id'),
    db('article_tags').where('article_id', articleId).pluck('tag_id'),
  ]);
  return {
    category_ids: cats.map((c) => c.category_id),
    primary_category_id: (cats.find((c) => c.is_primary) || {}).category_id || null,
    rubric_ids: rubs,
    tag_ids: tags,
  };
}

async function loadTaxonomyForForm() {
  const [rubs, cats, tagRows] = await Promise.all([
    db('rubrics').orderBy('display_order').orderBy('name').select('id', 'name'),
    db('categories').orderBy('path').select('id', 'name', 'path'),
    db('tags').orderBy('name').select('id', 'name', 'color'),
  ]);
  const categories = cats.map((c) => {
    const depth = (c.path.match(/\//g) || []).length;
    return { ...c, depth, label: '— '.repeat(depth) + c.name };
  });
  return { rubrics: rubs, categories, tags: tagRows };
}

async function syncRelations(trx, articleId, { categoryIds, primaryCategoryId, rubricIds, tagIds }) {
  await trx('article_categories').where('article_id', articleId).del();
  await trx('article_rubrics').where('article_id', articleId).del();
  await trx('article_tags').where('article_id', articleId).del();
  if (categoryIds.length > 0) {
    const rows = categoryIds.map((cid) => ({
      article_id: articleId, category_id: cid,
      is_primary: cid === primaryCategoryId ? 1 : 0,
    }));
    await trx('article_categories').insert(rows);
  }
  if (rubricIds.length > 0) {
    await trx('article_rubrics').insert(rubricIds.map((rid) => ({ article_id: articleId, rubric_id: rid })));
  }
  if (tagIds.length > 0) {
    await trx('article_tags').insert(tagIds.map((tid) => ({ article_id: articleId, tag_id: tid })));
  }
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const tab = STATUS_TABS.find((t) => t.key === req.query.tab) || STATUS_TABS[0];
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    const buildWhere = (qb) => {
      if (tab.filter.status) qb.where('articles.status', tab.filter.status);
      if (tab.filter.excludeTrash) qb.whereNot('articles.status', 'trash');
      if (q) qb.where('articles.title', 'like', `%${q}%`);
      return qb;
    };

    const totalRow = await buildWhere(db('articles')).count({ c: '*' }).first();
    const total = Number(totalRow.c);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    const rows = await buildWhere(
      db('articles')
        .leftJoin('users', 'articles.author_id', 'users.id')
        .select(
          'articles.id', 'articles.title', 'articles.slug', 'articles.type',
          'articles.status', 'articles.published_at', 'articles.scheduled_at',
          'articles.updated_at', 'articles.is_featured',
          'users.nickname as author_nickname'
        )
        .orderBy('articles.updated_at', 'desc').limit(PER_PAGE).offset(offset)
    );

    const counts = {};
    for (const t of STATUS_TABS) {
      const qb = db('articles');
      if (t.filter.status) qb.where('status', t.filter.status);
      if (t.filter.excludeTrash) qb.whereNot('status', 'trash');
      const r = await qb.count({ c: '*' }).first();
      counts[t.key] = Number(r.c);
    }

    res.render('admin/articles/index', {
      title: 'Články',
      currentPath: '/admin/articles',
      pageTitle: 'Články',
      articles: rows,
      tabs: STATUS_TABS,
      activeTab: tab.key,
      counts,
      query: { q, page, tab: tab.key },
      pagination: { total, totalPages, page, perPage: PER_PAGE },
      flash: buildFlash(req),
      csrfToken: generateToken(req, res),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// NEW
// ---------------------------------------------------------------------------
router.get('/new', async (req, res, next) => {
  try {
    const taxo = await loadTaxonomyForForm();
    res.render('admin/articles/edit', {
      title: 'Nový článok',
      currentPath: '/admin/articles',
      pageTitle: 'Nový článok',
      article: {
        id: null, type: 'article', status: 'draft',
        title: '', slug: '', excerpt: '', cover_media_id: null,
        scheduled_at: null, is_featured: 0, published_at: null,
      },
      content: [],
      mediaMap: new Map(),
      coverMedia: null,
      relations: { category_ids: [], primary_category_id: null, rubric_ids: [], tag_ids: [] },
      taxonomy: taxo,
      errors: {},
      csrfToken: generateToken(req, res),
      isNew: true,
      utils: articles,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { value, errors } = articles.validateArticleMeta(req.body, { isNew: true });
    const rawContent = articles.parseContentJson(req.body);
    if (rawContent === null) errors.content = 'Obsah článku je v zlom formáte (JSON parse zlyhal).';

    const categoryIds = articles.parseIdList(req.body.category_ids);
    const rubricIds = articles.parseIdList(req.body.rubric_ids);
    const tagIds = articles.parseIdList(req.body.tag_ids);
    const primaryCategoryId = req.body.primary_category_id ? Number(req.body.primary_category_id) : null;

    const renderAgain = async (errs) => {
      const taxo = await loadTaxonomyForForm();
      const sanitized = blocks.sanitizeBlocks(rawContent || []).blocks;
      const mediaIds = sanitized.filter((b) => b.type === 'image').map((b) => b.media_id);
      if (value.cover_media_id) mediaIds.push(value.cover_media_id);
      const mediaMap = await loadMediaMap(mediaIds);
      return res.status(400).render('admin/articles/edit', {
        title: 'Nový článok',
        currentPath: '/admin/articles',
        pageTitle: 'Nový článok',
        article: { id: null, ...value, published_at: null },
        content: sanitized, mediaMap,
        coverMedia: value.cover_media_id ? mediaMap.get(value.cover_media_id) : null,
        relations: { category_ids: categoryIds, primary_category_id: primaryCategoryId, rubric_ids: rubricIds, tag_ids: tagIds },
        taxonomy: taxo, errors: errs, csrfToken: generateToken(req, res),
        isNew: true, utils: articles,
      });
    };

    if (Object.keys(errors).length > 0) return renderAgain(errors);

    const { blocks: cleanBlocks } = blocks.sanitizeBlocks(rawContent);
    const searchText = blocks.extractSearchText(cleanBlocks);

    const baseSlug = value.slug || articles.slugifyArticle(value.title);
    if (!baseSlug) return renderAgain({ title: 'Z názvu sa nedá vygenerovať slug.' });
    const finalSlug = await articles.ensureUniqueArticleSlug(db, baseSlug);

    if (value.cover_media_id) {
      const m = await db('media').where('id', value.cover_media_id).first();
      if (!m) return renderAgain({ cover_media_id: 'Cover obrázok neexistuje.' });
    }
    if (categoryIds.length > 0) {
      const f = await db('categories').whereIn('id', categoryIds).pluck('id');
      if (f.length !== categoryIds.length) return renderAgain({ category_ids: 'Niektorá kategória neexistuje.' });
    }
    if (rubricIds.length > 0) {
      const f = await db('rubrics').whereIn('id', rubricIds).pluck('id');
      if (f.length !== rubricIds.length) return renderAgain({ rubric_ids: 'Niektorá rubrika neexistuje.' });
    }
    if (tagIds.length > 0) {
      const f = await db('tags').whereIn('id', tagIds).pluck('id');
      if (f.length !== tagIds.length) return renderAgain({ tag_ids: 'Niektorý tag neexistuje.' });
    }

    // Status logika
    const now = new Date();
    const publishedAt = value.status === 'published' ? now : null;

    let articleId;
    await db.transaction(async (trx) => {
      const inserted = await trx('articles').insert({
        type: value.type,
        title: value.title,
        slug: finalSlug,
        excerpt: value.excerpt,
        cover_media_id: value.cover_media_id,
        author_id: req.user.id,
        status: value.status,
        published_at: publishedAt,
        scheduled_at: value.scheduled_at,
        is_featured: value.is_featured,
        content: JSON.stringify(cleanBlocks),
        search_text: searchText,
      });
      articleId = Array.isArray(inserted) ? inserted[0] : inserted;
      await syncRelations(trx, articleId, {
        categoryIds,
        primaryCategoryId: categoryIds.includes(primaryCategoryId) ? primaryCategoryId : (categoryIds[0] || null),
        rubricIds, tagIds,
      });
    });

    log.info('article created', { id: articleId, slug: finalSlug, status: value.status, userId: req.user.id });
    res.redirect(`/admin/articles/${articleId}/edit?created=1`);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// EDIT
// ---------------------------------------------------------------------------
router.get('/:id/edit', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/articles');

    const article = await db('articles').where('id', id).first();
    if (!article) return res.redirect('/admin/articles?err=' + encodeURIComponent('Článok nenájdený.'));

    let content = [];
    try {
      content = typeof article.content === 'string' ? JSON.parse(article.content) : article.content || [];
      if (!Array.isArray(content)) content = [];
    } catch { content = []; }

    const relations = await loadRelations(id);
    const taxo = await loadTaxonomyForForm();
    const mediaIds = content.filter((b) => b.type === 'image').map((b) => b.media_id);
    if (article.cover_media_id) mediaIds.push(article.cover_media_id);
    const mediaMap = await loadMediaMap(mediaIds);
    const coverMedia = article.cover_media_id ? mediaMap.get(article.cover_media_id) || null : null;

    res.render('admin/articles/edit', {
      title: 'Upraviť: ' + article.title,
      currentPath: '/admin/articles',
      pageTitle: article.title,
      article, content, mediaMap, coverMedia, relations,
      taxonomy: taxo, errors: {},
      csrfToken: generateToken(req, res),
      isNew: false,
      flash: { created: !!req.query.created, updated: !!req.query.updated },
      utils: articles,
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
router.post('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/articles');

    const existing = await db('articles').where('id', id).first();
    if (!existing) return res.redirect('/admin/articles?err=' + encodeURIComponent('Článok nenájdený.'));

    const { value, errors } = articles.validateArticleMeta(req.body, { isNew: false });
    const rawContent = articles.parseContentJson(req.body);
    if (rawContent === null) errors.content = 'Obsah článku je v zlom formáte.';

    const categoryIds = articles.parseIdList(req.body.category_ids);
    const rubricIds = articles.parseIdList(req.body.rubric_ids);
    const tagIds = articles.parseIdList(req.body.tag_ids);
    const primaryCategoryId = req.body.primary_category_id ? Number(req.body.primary_category_id) : null;

    const renderAgain = async (errs) => {
      const taxo = await loadTaxonomyForForm();
      const sanitized = blocks.sanitizeBlocks(rawContent || []).blocks;
      const mediaIds = sanitized.filter((b) => b.type === 'image').map((b) => b.media_id);
      if (value.cover_media_id) mediaIds.push(value.cover_media_id);
      const mediaMap = await loadMediaMap(mediaIds);
      return res.status(400).render('admin/articles/edit', {
        title: 'Upraviť: ' + existing.title,
        currentPath: '/admin/articles',
        pageTitle: existing.title,
        article: { ...existing, ...value },
        content: sanitized, mediaMap,
        coverMedia: value.cover_media_id ? mediaMap.get(value.cover_media_id) : null,
        relations: { category_ids: categoryIds, primary_category_id: primaryCategoryId, rubric_ids: rubricIds, tag_ids: tagIds },
        taxonomy: taxo, errors: errs, csrfToken: generateToken(req, res),
        isNew: false, flash: {}, utils: articles,
      });
    };

    if (Object.keys(errors).length > 0) return renderAgain(errors);

    const { blocks: cleanBlocks } = blocks.sanitizeBlocks(rawContent);
    const searchText = blocks.extractSearchText(cleanBlocks);

    let finalSlug = value.slug || articles.slugifyArticle(value.title);
    if (!finalSlug) return renderAgain({ title: 'Z názvu sa nedá vygenerovať slug.' });
    if (finalSlug !== existing.slug) {
      finalSlug = await articles.ensureUniqueArticleSlug(db, finalSlug, id);
    }

    if (value.cover_media_id) {
      const m = await db('media').where('id', value.cover_media_id).first();
      if (!m) return renderAgain({ cover_media_id: 'Cover obrázok neexistuje.' });
    }
    if (categoryIds.length > 0) {
      const f = await db('categories').whereIn('id', categoryIds).pluck('id');
      if (f.length !== categoryIds.length) return renderAgain({ category_ids: 'Niektorá kategória neexistuje.' });
    }
    if (rubricIds.length > 0) {
      const f = await db('rubrics').whereIn('id', rubricIds).pluck('id');
      if (f.length !== rubricIds.length) return renderAgain({ rubric_ids: 'Niektorá rubrika neexistuje.' });
    }
    if (tagIds.length > 0) {
      const f = await db('tags').whereIn('id', tagIds).pluck('id');
      if (f.length !== tagIds.length) return renderAgain({ tag_ids: 'Niektorý tag neexistuje.' });
    }

    // Status logika:
    //   draft → published_at = null (resetuj)
    //   scheduled → published_at = null (cron neskôr nastaví keď publikuje)
    //   published prvýkrát → published_at = now
    //   published znova (už bol) → zachovaj pôvodné published_at
    //   archived → zachovaj published_at
    let publishedAt = existing.published_at;
    if (value.status === 'draft' || value.status === 'scheduled') {
      publishedAt = null;
    } else if (value.status === 'published' && !publishedAt) {
      publishedAt = new Date();
    }
    // archived → no change to published_at

    await db.transaction(async (trx) => {
      await trx('articles').where('id', id).update({
        type: value.type,
        title: value.title,
        slug: finalSlug,
        excerpt: value.excerpt,
        cover_media_id: value.cover_media_id,
        status: value.status,
        published_at: publishedAt,
        scheduled_at: value.scheduled_at,
        is_featured: value.is_featured,
        content: JSON.stringify(cleanBlocks),
        search_text: searchText,
      });
      await syncRelations(trx, id, {
        categoryIds,
        primaryCategoryId: categoryIds.includes(primaryCategoryId) ? primaryCategoryId : (categoryIds[0] || null),
        rubricIds, tagIds,
      });
    });

    log.info('article updated', { id, slug: finalSlug, status: value.status, userId: req.user.id });
    res.redirect(`/admin/articles/${id}/edit?updated=1`);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// TRASH / RESTORE / DELETE
// ---------------------------------------------------------------------------
router.post('/:id/trash', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/articles');
    const a = await db('articles').where('id', id).first();
    if (!a) return res.redirect('/admin/articles');
    await db('articles').where('id', id).update({ status: 'trash', deleted_at: new Date() });
    log.info('article trashed', { id, userId: req.user.id });
    res.redirect('/admin/articles?trashed=1');
  } catch (err) { next(err); }
});

router.post('/:id/restore', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/articles');
    const a = await db('articles').where('id', id).first();
    if (!a || a.status !== 'trash') return res.redirect('/admin/articles');
    await db('articles').where('id', id).update({ status: 'draft', deleted_at: null });
    log.info('article restored', { id, userId: req.user.id });
    res.redirect('/admin/articles?tab=draft&restored=1');
  } catch (err) { next(err); }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/articles');
    const a = await db('articles').where('id', id).first();
    if (!a) return res.redirect('/admin/articles');
    if (a.status !== 'trash') {
      return res.redirect('/admin/articles?err=' + encodeURIComponent('Najprv presuň článok do koša.'));
    }
    await db('articles').where('id', id).del();
    log.info('article permanently deleted', { id, userId: req.user.id });
    res.redirect('/admin/articles?tab=trash&deleted=1');
  } catch (err) { next(err); }
});

module.exports = router;
