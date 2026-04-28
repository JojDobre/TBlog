/**
 * Admin categories routes (mounted at /admin/categories)  Phase 4.2
 *
 * GET  /              — tree list
 * GET  /new           — form (s parent select)
 * POST /              — create (path = parentPath + slug)
 * GET  /:id/edit      — form
 * POST /:id           — update (pri zmene parent/slug recompute descendants)
 * POST /:id/delete    — blocked ak má deti alebo články
 */

'use strict';

const express = require('express');

const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const cats = require('../utils/categories');

const router = express.Router();
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

// ---------------------------------------------------------------------------
function buildFlash(req) {
  return {
    created: !!req.query.created,
    updated: !!req.query.updated,
    deleted: !!req.query.deleted,
    err: req.query.err ? String(req.query.err) : null,
  };
}

/**
 * Načíta tree + počet článkov (priamo priradených) per kategória.
 */
async function loadTreeWithCounts() {
  const rows = await db('categories')
    .leftJoin('article_categories', 'categories.id', 'article_categories.category_id')
    .select('categories.*')
    .count({ article_count: 'article_categories.article_id' })
    .groupBy('categories.id')
    .orderBy('categories.path', 'asc');

  // pridaj depth + child count (z path-ov)
  const allPaths = rows.map((r) => r.path);
  return rows.map((r) => {
    const depth = (r.path.match(/\//g) || []).length;
    // child_count = priame deti (path = self.path + '/' + jediný_segment)
    const prefix = r.path + '/';
    const childCount = allPaths.filter((p) => {
      if (!p.startsWith(prefix)) return false;
      const rest = p.slice(prefix.length);
      return rest.length > 0 && !rest.includes('/');
    }).length;
    return {
      ...r,
      article_count: Number(r.article_count),
      depth,
      child_count: childCount,
    };
  });
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const tree = await loadTreeWithCounts();
    res.render('admin/categories/index', {
      title: 'Kategórie',
      currentPath: '/admin/categories',
      pageTitle: 'Kategórie',
      tree,
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
router.get('/new', async (req, res, next) => {
  try {
    const parents = await cats.listAllowedParents(db, null);
    // ak je v query ?parent=N, predvyber ho
    const preselectParent = req.query.parent ? Number(req.query.parent) : null;

    res.render('admin/categories/edit', {
      title: 'Nová kategória',
      currentPath: '/admin/categories',
      pageTitle: 'Nová kategória',
      category: {
        id: null,
        name: '',
        slug: '',
        parent_id: preselectParent || null,
        description: '',
        display_order: 0,
        path: null,
      },
      parents,
      errors: {},
      csrfToken: generateToken(req, res),
      isNew: true,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { value, errors } = cats.validateCategory(req.body);

    // Skontroluj parent existenciu
    let parentRow = null;
    if (!errors.parent_id && value.parent_id !== null) {
      parentRow = await db('categories').where('id', value.parent_id).first();
      if (!parentRow) errors.parent_id = 'Nadradená kategória neexistuje.';
    }

    if (Object.keys(errors).length > 0) {
      const parents = await cats.listAllowedParents(db, null);
      return res.status(400).render('admin/categories/edit', {
        title: 'Nová kategória',
        currentPath: '/admin/categories',
        pageTitle: 'Nová kategória',
        category: { id: null, ...value, path: null },
        parents,
        errors,
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }

    const baseSlug = value.slug || cats.slugifyName(value.name);
    if (!baseSlug) {
      const parents = await cats.listAllowedParents(db, null);
      return res.status(400).render('admin/categories/edit', {
        title: 'Nová kategória',
        currentPath: '/admin/categories',
        pageTitle: 'Nová kategória',
        category: { id: null, ...value, path: null },
        parents,
        errors: { name: 'Z názvu sa nedá vygenerovať slug — zadaj ho manuálne.' },
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }

    const finalSlug = await cats.ensureUniqueCategorySlug(db, baseSlug);
    const path = cats.buildPath(parentRow ? parentRow.path : null, finalSlug);
    if (path.length > 500) {
      const parents = await cats.listAllowedParents(db, null);
      return res.status(400).render('admin/categories/edit', {
        title: 'Nová kategória',
        currentPath: '/admin/categories',
        pageTitle: 'Nová kategória',
        category: { id: null, ...value, path: null },
        parents,
        errors: { name: 'Cesta kategórie by prekročila 500 znakov — skráť slug alebo posun vyššie.' },
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }

    const inserted = await db('categories').insert({
      name: value.name,
      slug: finalSlug,
      parent_id: value.parent_id,
      path,
      description: value.description,
      display_order: value.display_order,
    });
    const id = Array.isArray(inserted) ? inserted[0] : inserted;

    log.info('category created', { id, slug: finalSlug, path, userId: req.user.id });
    res.redirect('/admin/categories?created=1');
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/categories');

    const category = await db('categories').where('id', id).first();
    if (!category) {
      return res.redirect('/admin/categories?err=' + encodeURIComponent('Kategória nenájdená.'));
    }
    const parents = await cats.listAllowedParents(db, id);

    res.render('admin/categories/edit', {
      title: 'Upraviť kategóriu',
      currentPath: '/admin/categories',
      pageTitle: 'Upraviť kategóriu',
      category,
      parents,
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/categories');

    const existing = await db('categories').where('id', id).first();
    if (!existing) {
      return res.redirect('/admin/categories?err=' + encodeURIComponent('Kategória nenájdená.'));
    }

    const { value, errors } = cats.validateCategory(req.body);

    // Cycle check
    if (!errors.parent_id && value.parent_id !== null) {
      const cycle = await cats.wouldCreateCycle(db, id, value.parent_id);
      if (cycle) errors.parent_id = 'Kategória nemôže byť potomkom samej seba.';
    }

    let parentRow = null;
    if (!errors.parent_id && value.parent_id !== null) {
      parentRow = await db('categories').where('id', value.parent_id).first();
      if (!parentRow) errors.parent_id = 'Nadradená kategória neexistuje.';
    }

    const renderEdit = async (errs) => {
      const parents = await cats.listAllowedParents(db, id);
      return res.status(400).render('admin/categories/edit', {
        title: 'Upraviť kategóriu',
        currentPath: '/admin/categories',
        pageTitle: 'Upraviť kategóriu',
        category: { id, ...value, path: existing.path },
        parents,
        errors: errs,
        csrfToken: generateToken(req, res),
        isNew: false,
      });
    };

    if (Object.keys(errors).length > 0) return renderEdit(errors);

    let finalSlug = value.slug || cats.slugifyName(value.name);
    if (!finalSlug) return renderEdit({ name: 'Z názvu sa nedá vygenerovať slug — zadaj ho manuálne.' });
    if (finalSlug !== existing.slug) {
      finalSlug = await cats.ensureUniqueCategorySlug(db, finalSlug, id);
    }

    const newPath = cats.buildPath(parentRow ? parentRow.path : null, finalSlug);
    if (newPath.length > 500) return renderEdit({ name: 'Cesta by prekročila 500 znakov.' });

    // Transaction — update self + recompute descendants ak path zmenený
    await db.transaction(async (trx) => {
      await trx('categories').where('id', id).update({
        name: value.name,
        slug: finalSlug,
        parent_id: value.parent_id,
        path: newPath,
        description: value.description,
        display_order: value.display_order,
      });
      if (newPath !== existing.path) {
        await cats.recomputeDescendantPaths(trx, existing.path, newPath);
      }
    });

    log.info('category updated', { id, slug: finalSlug, oldPath: existing.path, newPath, userId: req.user.id });
    res.redirect('/admin/categories?updated=1');
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/categories');

    const cat = await db('categories').where('id', id).first();
    if (!cat) return res.redirect('/admin/categories');

    // Skontroluj deti
    const childCount = await db('categories')
      .where('parent_id', id)
      .count({ c: '*' })
      .first();
    if (Number(childCount.c) > 0) {
      return res.redirect(
        '/admin/categories?err=' +
          encodeURIComponent(
            `Kategória "${cat.name}" má ${childCount.c} podkategórií — najprv ich zmaž alebo presuň.`
          )
      );
    }

    // Skontroluj články
    const artCount = await db('article_categories')
      .where('category_id', id)
      .count({ c: '*' })
      .first();
    if (Number(artCount.c) > 0) {
      return res.redirect(
        '/admin/categories?err=' +
          encodeURIComponent(
            `Kategória "${cat.name}" sa používa v ${artCount.c} článkoch — najprv ich z nej odober.`
          )
      );
    }

    await db('categories').where('id', id).del();
    log.info('category deleted', { id, slug: cat.slug, userId: req.user.id });
    res.redirect('/admin/categories?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
