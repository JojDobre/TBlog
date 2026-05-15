/**
 * Admin pages routes  (Phase 2 — static pages)
 *
 * CRUD pre statické stránky: /admin/pages
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));
const db = require('../db');
const log = require('../logger');
const pages = require('../utils/pages');
const { generateToken } = require('../middleware/csrf');

// =========================================================================
// LIST
// =========================================================================

router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;

    let qb = db('pages').orderBy('display_order', 'asc').orderBy('created_at', 'desc');
    let countQb = db('pages');

    if (q) {
      qb = qb.where('title', 'like', `%${q}%`);
      countQb = countQb.where('title', 'like', `%${q}%`);
    }

    const [items, countRow] = await Promise.all([
      qb.clone().limit(perPage).offset(offset),
      countQb.clone().count({ c: '*' }).first(),
    ]);

    const total = Number(countRow.c);
    const totalPages = Math.ceil(total / perPage) || 1;

    res.render('admin/pages/index', {
      title: 'Stránky',
      currentPath: '/admin/pages',
      pageTitle: 'Stránky',
      items,
      query: { q },
      pagination: { page, totalPages, total },
      csrfToken: res.locals.csrfToken,
      flash: {
        created: !!req.query.created,
        updated: !!req.query.updated,
        deleted: !!req.query.deleted,
        err: req.query.err || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// NEW
// =========================================================================

router.get('/new', (req, res) => {
  const template = pages.TEMPLATES.includes(req.query.template) ? req.query.template : 'default';

  const defaultContent = pages.getTemplateDefaults(template);

  res.render('admin/pages/edit', {
    title: 'Nová stránka',
    currentPath: '/admin/pages',
    pageTitle: 'Nová stránka',
    pg: {
      title: '',
      slug: '',
      template,
      status: 'draft',
      seo_title: '',
      seo_description: '',
      show_in_footer: 0,
      show_in_header: 0,
      display_order: 0,
    },
    content: defaultContent,
    errors: {},
    csrfToken: res.locals.csrfToken,
    isNew: true,
    templates: pages.TEMPLATES,
    flash: {},
  });
});

// =========================================================================
// CREATE
// =========================================================================

router.post('/', async (req, res, next) => {
  try {
    const { value, errors } = pages.validatePageMeta(req.body, { isNew: true });
    const rawContent = pages.parseContentJson(req.body);
    if (rawContent === null) errors.content = 'Obsah stránky je v zlom formáte.';

    const { blocks: cleanBlocks } = pages.sanitizePageBlocks(rawContent || []);

    // slug
    let finalSlug = value.slug;
    if (!finalSlug && value.title) {
      finalSlug = pages.slugifyPage(value.title);
    }
    if (finalSlug) {
      const existing = await db('pages').where('slug', finalSlug).first();
      if (existing) {
        finalSlug = await pages.ensureUniquePageSlug(db, finalSlug);
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/pages/edit', {
        title: 'Nová stránka',
        currentPath: '/admin/pages',
        pageTitle: 'Nová stránka',
        pg: { ...value, slug: finalSlug },
        content: cleanBlocks,
        errors,
        csrfToken: res.locals.csrfToken,
        isNew: true,
        templates: pages.TEMPLATES,
        flash: {},
      });
    }

    const [id] = await db('pages').insert({
      title: value.title,
      slug: finalSlug,
      template: value.template,
      content: JSON.stringify(cleanBlocks),
      status: value.status,
      seo_title: value.seo_title,
      seo_description: value.seo_description,
      show_in_footer: value.show_in_footer,
      show_in_header: value.show_in_header,
      display_order: value.display_order,
    });

    log.info('page created', { id, slug: finalSlug, userId: req.user.id });
    res.redirect(`/admin/pages/${id}/edit?created=1`);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// EDIT
// =========================================================================

router.get('/:id/edit', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/pages');

    const pg = await db('pages').where('id', id).first();
    if (!pg) {
      return res.redirect('/admin/pages?err=' + encodeURIComponent('Stránka nenájdená.'));
    }

    let content = [];
    try {
      content = typeof pg.content === 'string' ? JSON.parse(pg.content) : pg.content || [];
      if (!Array.isArray(content)) content = [];
    } catch {
      content = [];
    }

    res.render('admin/pages/edit', {
      title: 'Upraviť: ' + pg.title,
      currentPath: '/admin/pages',
      pageTitle: pg.title,
      pg,
      content,
      errors: {},
      csrfToken: res.locals.csrfToken,
      isNew: false,
      templates: pages.TEMPLATES,
      flash: {
        created: !!req.query.created,
        updated: !!req.query.updated,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// UPDATE
// =========================================================================

router.post('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/pages');

    const existing = await db('pages').where('id', id).first();
    if (!existing) {
      return res.redirect('/admin/pages?err=' + encodeURIComponent('Stránka nenájdená.'));
    }

    const { value, errors } = pages.validatePageMeta(req.body, { isNew: false });
    const rawContent = pages.parseContentJson(req.body);
    if (rawContent === null) errors.content = 'Obsah stránky je v zlom formáte.';

    const { blocks: cleanBlocks } = pages.sanitizePageBlocks(rawContent || []);

    let finalSlug = value.slug || pages.slugifyPage(value.title);
    if (finalSlug !== existing.slug) {
      const dup = await db('pages').where('slug', finalSlug).whereNot('id', id).first();
      if (dup) finalSlug = await pages.ensureUniquePageSlug(db, finalSlug, id);
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/pages/edit', {
        title: 'Upraviť: ' + existing.title,
        currentPath: '/admin/pages',
        pageTitle: existing.title,
        pg: { ...existing, ...value, slug: finalSlug },
        content: cleanBlocks,
        errors,
        csrfToken: res.locals.csrfToken,
        isNew: false,
        templates: pages.TEMPLATES,
        flash: {},
      });
    }

    await db('pages')
      .where('id', id)
      .update({
        title: value.title,
        slug: finalSlug,
        template: value.template,
        content: JSON.stringify(cleanBlocks),
        status: value.status,
        seo_title: value.seo_title,
        seo_description: value.seo_description,
        show_in_footer: value.show_in_footer,
        show_in_header: value.show_in_header,
        display_order: value.display_order,
      });

    log.info('page updated', { id, slug: finalSlug, userId: req.user.id });
    res.redirect(`/admin/pages/${id}/edit?updated=1`);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// DELETE
// =========================================================================

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/pages');

    const pg = await db('pages').where('id', id).first();
    if (!pg) {
      return res.redirect('/admin/pages?err=' + encodeURIComponent('Stránka nenájdená.'));
    }

    await db('pages').where('id', id).del();
    log.info('page deleted', { id, slug: pg.slug, userId: req.user.id });
    res.redirect('/admin/pages?deleted=1');
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// API: get template defaults (pre JS na frontend)
// =========================================================================

router.get('/api/template-defaults/:template', (req, res) => {
  const tpl = req.params.template;
  if (!pages.TEMPLATES.includes(tpl)) {
    return res.status(400).json({ error: 'Neplatná šablóna.' });
  }
  res.json({ blocks: pages.getTemplateDefaults(tpl) });
});

module.exports = router;
