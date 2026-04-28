/**
 * Admin tags routes  (mounted at /admin/tags)
 *
 * Phase 4.1
 *
 * GET  /                — list (search + pagination)
 * GET  /new             — formulár na nový tag
 * POST /                — create
 * GET  /:id/edit        — edit form
 * POST /:id             — update
 * POST /:id/delete      — delete (zablokované ak má články)
 *
 * Tagov môže byť veľa (stovky), preto:
 *   - search box (case-insensitive LIKE na name a slug)
 *   - pagination (50 per page)
 */

'use strict';

const express = require('express');

const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const {
  TAG_COLOR_PALETTE,
  slugifyName,
  ensureUniqueSlug,
  validateTag,
  randomTagColor,
} = require('../utils/taxonomy');

const router = express.Router();

router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildFlash(req) {
  return {
    created: !!req.query.created,
    updated: !!req.query.updated,
    deleted: !!req.query.deleted,
    err: req.query.err ? String(req.query.err) : null,
  };
}

// ---------------------------------------------------------------------------
// LIST  (s search + pagination)
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    // Builder pre WHERE — používame opakovane pre count aj data
    const buildWhere = (qb) => {
      if (q) {
        qb.where(function () {
          this.where('tags.name', 'like', `%${q}%`).orWhere('tags.slug', 'like', `%${q}%`);
        });
      }
      return qb;
    };

    // Total count (pre pagination)
    const totalRow = await buildWhere(db('tags')).count({ c: '*' }).first();
    const total = Number(totalRow.c);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    // Dáta + article counts
    const tags = await buildWhere(
      db('tags')
        .leftJoin('article_tags', 'tags.id', 'article_tags.tag_id')
        .select('tags.*')
        .count({ article_count: 'article_tags.article_id' })
        .groupBy('tags.id')
        .orderBy('tags.name', 'asc')
        .limit(PER_PAGE)
        .offset(offset)
    );

    res.render('admin/tags/index', {
      title: 'Tagy',
      currentPath: '/admin/tags',
      pageTitle: 'Tagy',
      tags: tags.map((t) => ({ ...t, article_count: Number(t.article_count) })),
      flash: buildFlash(req),
      query: { q, page },
      pagination: { total, totalPages, page, perPage: PER_PAGE },
      csrfToken: generateToken(req, res),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// NEW form
// ---------------------------------------------------------------------------
router.get('/new', (req, res) => {
  res.render('admin/tags/edit', {
    title: 'Nový tag',
    currentPath: '/admin/tags',
    pageTitle: 'Nový tag',
    tag: { id: null, name: '', slug: '', color: '', description: '' },
    errors: {},
    csrfToken: generateToken(req, res),
    palette: TAG_COLOR_PALETTE,
    isNew: true,
  });
});

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { value, errors } = validateTag(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/tags/edit', {
        title: 'Nový tag',
        currentPath: '/admin/tags',
        pageTitle: 'Nový tag',
        tag: { id: null, ...value },
        errors,
        csrfToken: generateToken(req, res),
        palette: TAG_COLOR_PALETTE,
        isNew: true,
      });
    }

    const baseSlug = value.slug || slugifyName(value.name);
    if (!baseSlug) {
      return res.status(400).render('admin/tags/edit', {
        title: 'Nový tag',
        currentPath: '/admin/tags',
        pageTitle: 'Nový tag',
        tag: { id: null, ...value },
        errors: { name: 'Z názvu sa nedá vygenerovať slug — zadaj ho manuálne.' },
        csrfToken: generateToken(req, res),
        palette: TAG_COLOR_PALETTE,
        isNew: true,
      });
    }
    const finalSlug = await ensureUniqueSlug('tags', baseSlug);

    // Ak farba nezadaná, vyber náhodnú z palety
    const finalColor = value.color || randomTagColor();

    const inserted = await db('tags').insert({
      name: value.name,
      slug: finalSlug,
      color: finalColor,
      description: value.description,
    });
    const id = Array.isArray(inserted) ? inserted[0] : inserted;

    log.info('tag created', { id, slug: finalSlug, color: finalColor, userId: req.user.id });
    res.redirect('/admin/tags?created=1');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// EDIT form
// ---------------------------------------------------------------------------
router.get('/:id/edit', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.redirect('/admin/tags');
    }
    const tag = await db('tags').where('id', id).first();
    if (!tag) {
      return res.redirect('/admin/tags?err=' + encodeURIComponent('Tag nenájdený.'));
    }
    res.render('admin/tags/edit', {
      title: 'Upraviť tag',
      currentPath: '/admin/tags',
      pageTitle: 'Upraviť tag',
      tag,
      errors: {},
      csrfToken: generateToken(req, res),
      palette: TAG_COLOR_PALETTE,
      isNew: false,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------
router.post('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.redirect('/admin/tags');
    }
    const existing = await db('tags').where('id', id).first();
    if (!existing) {
      return res.redirect('/admin/tags?err=' + encodeURIComponent('Tag nenájdený.'));
    }

    const { value, errors } = validateTag(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/tags/edit', {
        title: 'Upraviť tag',
        currentPath: '/admin/tags',
        pageTitle: 'Upraviť tag',
        tag: { id, ...value },
        errors,
        csrfToken: generateToken(req, res),
        palette: TAG_COLOR_PALETTE,
        isNew: false,
      });
    }

    let finalSlug = value.slug || slugifyName(value.name);
    if (!finalSlug) {
      return res.status(400).render('admin/tags/edit', {
        title: 'Upraviť tag',
        currentPath: '/admin/tags',
        pageTitle: 'Upraviť tag',
        tag: { id, ...value },
        errors: { name: 'Z názvu sa nedá vygenerovať slug — zadaj ho manuálne.' },
        csrfToken: generateToken(req, res),
        palette: TAG_COLOR_PALETTE,
        isNew: false,
      });
    }
    if (finalSlug !== existing.slug) {
      finalSlug = await ensureUniqueSlug('tags', finalSlug, id);
    }

    // Pri update — ak farba prázdna, ZACHOVAJ existujúcu (neresetuj)
    const finalColor = value.color || existing.color || randomTagColor();

    await db('tags').where('id', id).update({
      name: value.name,
      slug: finalSlug,
      color: finalColor,
      description: value.description,
    });

    log.info('tag updated', { id, slug: finalSlug, userId: req.user.id });
    res.redirect('/admin/tags?updated=1');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.redirect('/admin/tags');
    }
    const tag = await db('tags').where('id', id).first();
    if (!tag) {
      return res.redirect('/admin/tags');
    }

    const cnt = await db('article_tags')
      .where('tag_id', id)
      .count({ c: '*' })
      .first();
    if (Number(cnt.c) > 0) {
      return res.redirect(
        '/admin/tags?err=' +
          encodeURIComponent(
            `Tag "${tag.name}" sa používa v ${cnt.c} článkoch — najprv ho z nich odober.`
          )
      );
    }

    await db('tags').where('id', id).del();
    log.info('tag deleted', { id, slug: tag.slug, userId: req.user.id });
    res.redirect('/admin/tags?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
