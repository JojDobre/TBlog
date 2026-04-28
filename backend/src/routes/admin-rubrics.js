/**
 * Admin rubrics routes  (mounted at /admin/rubrics)
 *
 * Phase 4.1
 *
 * GET  /                — list všetkých rubrík (s počtom článkov)
 * GET  /new             — formulár na novú rubriku
 * POST /                — create
 * GET  /:id/edit        — edit form
 * POST /:id             — update
 * POST /:id/delete      — delete (zablokované ak má články)
 *
 * CSRF: globálny middleware validuje POST automaticky (urlencoded, nie multipart).
 * Auth: requireAuth + requireRole('admin','editor').
 */

'use strict';

const express = require('express');

const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const {
  slugifyName,
  ensureUniqueSlug,
  validateRubric,
} = require('../utils/taxonomy');

const router = express.Router();

// Auth gate — všetky routes
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Zo `req.query` vytiahne flash flagy a chybu — view ich potom vie
 * jednotne renderovať.
 */
function buildFlash(req) {
  return {
    created: !!req.query.created,
    updated: !!req.query.updated,
    deleted: !!req.query.deleted,
    err: req.query.err ? String(req.query.err) : null,
  };
}

/**
 * Načítanie všetkých rubrík + počet článkov.
 * Article count bude 0 kým neprídu články (Phase 5).
 */
async function loadRubricsWithCounts() {
  const rows = await db('rubrics')
    .leftJoin('article_rubrics', 'rubrics.id', 'article_rubrics.rubric_id')
    .select('rubrics.*')
    .count({ article_count: 'article_rubrics.article_id' })
    .groupBy('rubrics.id')
    .orderBy('rubrics.display_order', 'asc')
    .orderBy('rubrics.name', 'asc');

  return rows.map((r) => ({ ...r, article_count: Number(r.article_count) }));
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const rubrics = await loadRubricsWithCounts();
    res.render('admin/rubrics/index', {
      title: 'Rubriky',
      currentPath: '/admin/rubrics',
      pageTitle: 'Rubriky',
      rubrics,
      flash: buildFlash(req),
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
  res.render('admin/rubrics/edit', {
    title: 'Nová rubrika',
    currentPath: '/admin/rubrics',
    pageTitle: 'Nová rubrika',
    rubric: { id: null, name: '', slug: '', description: '', display_order: 0 },
    errors: {},
    csrfToken: generateToken(req, res),
    isNew: true,
  });
});

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { value, errors } = validateRubric(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/rubrics/edit', {
        title: 'Nová rubrika',
        currentPath: '/admin/rubrics',
        pageTitle: 'Nová rubrika',
        rubric: { id: null, ...value },
        errors,
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }

    // Doplň slug ak nie je zadaný
    const baseSlug = value.slug || slugifyName(value.name);
    if (!baseSlug) {
      return res.status(400).render('admin/rubrics/edit', {
        title: 'Nová rubrika',
        currentPath: '/admin/rubrics',
        pageTitle: 'Nová rubrika',
        rubric: { id: null, ...value },
        errors: { name: 'Z názvu sa nedá vygenerovať slug — zadaj ho manuálne.' },
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }
    const finalSlug = await ensureUniqueSlug('rubrics', baseSlug);

    const inserted = await db('rubrics').insert({
      name: value.name,
      slug: finalSlug,
      description: value.description,
      display_order: value.display_order,
    });
    const id = Array.isArray(inserted) ? inserted[0] : inserted;

    log.info('rubric created', { id, slug: finalSlug, userId: req.user.id });
    res.redirect('/admin/rubrics?created=1');
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
      return res.redirect('/admin/rubrics');
    }
    const rubric = await db('rubrics').where('id', id).first();
    if (!rubric) {
      return res.redirect('/admin/rubrics?err=' + encodeURIComponent('Rubrika nenájdená.'));
    }
    res.render('admin/rubrics/edit', {
      title: 'Upraviť rubriku',
      currentPath: '/admin/rubrics',
      pageTitle: 'Upraviť rubriku',
      rubric,
      errors: {},
      csrfToken: generateToken(req, res),
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
      return res.redirect('/admin/rubrics');
    }

    const existing = await db('rubrics').where('id', id).first();
    if (!existing) {
      return res.redirect('/admin/rubrics?err=' + encodeURIComponent('Rubrika nenájdená.'));
    }

    const { value, errors } = validateRubric(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/rubrics/edit', {
        title: 'Upraviť rubriku',
        currentPath: '/admin/rubrics',
        pageTitle: 'Upraviť rubriku',
        rubric: { id, ...value },
        errors,
        csrfToken: generateToken(req, res),
        isNew: false,
      });
    }

    // Slug — ak prázdny vygeneruj zo name; ak sa zmenil voči existing, zaisti unikátnosť
    let finalSlug = value.slug || slugifyName(value.name);
    if (!finalSlug) {
      return res.status(400).render('admin/rubrics/edit', {
        title: 'Upraviť rubriku',
        currentPath: '/admin/rubrics',
        pageTitle: 'Upraviť rubriku',
        rubric: { id, ...value },
        errors: { name: 'Z názvu sa nedá vygenerovať slug — zadaj ho manuálne.' },
        csrfToken: generateToken(req, res),
        isNew: false,
      });
    }
    if (finalSlug !== existing.slug) {
      finalSlug = await ensureUniqueSlug('rubrics', finalSlug, id);
    }

    await db('rubrics').where('id', id).update({
      name: value.name,
      slug: finalSlug,
      description: value.description,
      display_order: value.display_order,
    });

    log.info('rubric updated', { id, slug: finalSlug, userId: req.user.id });
    res.redirect('/admin/rubrics?updated=1');
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
      return res.redirect('/admin/rubrics');
    }

    const rubric = await db('rubrics').where('id', id).first();
    if (!rubric) {
      return res.redirect('/admin/rubrics');
    }

    // Skontroluj počet článkov
    const cnt = await db('article_rubrics')
      .where('rubric_id', id)
      .count({ c: '*' })
      .first();

    if (Number(cnt.c) > 0) {
      return res.redirect(
        '/admin/rubrics?err=' +
          encodeURIComponent(
            `Rubrika "${rubric.name}" sa používa v ${cnt.c} článkoch — najprv ich z nej odober.`
          )
      );
    }

    await db('rubrics').where('id', id).del();
    log.info('rubric deleted', { id, slug: rubric.slug, userId: req.user.id });
    res.redirect('/admin/rubrics?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
