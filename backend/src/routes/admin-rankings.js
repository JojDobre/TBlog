/**
 * Admin rankings routes  (mounted at /admin/rankings)
 *
 * Phase 9 — Rebríčky backend
 *
 * RANKING CRUD:
 *   GET  /                    — zoznam rebríčkov
 *   GET  /new                 — formulár nový rebríček
 *   POST /                    — create
 *   GET  /:id/edit            — edit (+ inline kritériá + položky)
 *   POST /:id                 — update
 *   POST /:id/delete          — delete (zablokované ak má položky)
 *
 * CRITERIA (AJAX — JSON responses):
 *   POST /:id/criteria              — add criterion
 *   POST /:id/criteria/:cid         — update criterion
 *   POST /:id/criteria/:cid/delete  — delete criterion
 *   POST /:id/criteria/reorder      — reorder criteria
 */

'use strict';

const express = require('express');
const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');

const router = express.Router();

router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

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

function slugify(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 180);
}

async function ensureUniqueSlug(slug, excludeId) {
  let candidate = slug;
  let suffix = 1;
  while (true) {
    const q = db('rankings').where('slug', candidate);
    if (excludeId) q.whereNot('id', excludeId);
    const existing = await q.first();
    if (!existing) return candidate;
    suffix++;
    candidate = `${slug}-${suffix}`;
  }
}

function validateRanking(body) {
  const errors = {};
  const name = String(body.name || '').trim();
  const slug = String(body.slug || '').trim();
  const description = String(body.description || '').trim() || null;
  const status = ['active', 'archived'].includes(body.status) ? body.status : 'active';
  const adminOverride = body.admin_override === '1' ? 1 : 0;
  const sortDirection = body.sort_direction === 'asc' ? 'asc' : 'desc';
  const maxAgeMonths = body.max_age_months ? parseInt(body.max_age_months, 10) : null;
  const seoTitle =
    String(body.seo_title || '')
      .trim()
      .slice(0, 255) || null;
  const seoDescription =
    String(body.seo_description || '')
      .trim()
      .slice(0, 320) || null;

  if (!name || name.length < 2) errors.name = 'Názov musí mať aspoň 2 znaky.';
  if (name.length > 160) errors.name = 'Názov max 160 znakov.';
  if (maxAgeMonths !== null && (isNaN(maxAgeMonths) || maxAgeMonths < 1)) {
    errors.max_age_months = 'Musí byť kladné celé číslo alebo prázdne.';
  }

  return {
    value: {
      name,
      slug,
      description,
      status,
      admin_override: adminOverride,
      sort_direction: sortDirection,
      max_age_months: maxAgeMonths,
      seo_title: seoTitle,
      seo_description: seoDescription,
    },
    errors,
  };
}

function validateCriterion(body) {
  const errors = {};
  const name = String(body.name || '').trim();
  const fieldType = String(body.field_type || 'score_1_10');
  const unit =
    String(body.unit || '')
      .trim()
      .slice(0, 20) || null;
  const isFilterable = body.is_filterable === '1' ? 1 : 0;
  const isTotal = body.is_total === '1' ? 1 : 0;

  const validTypes = ['score_1_10', 'decimal', 'integer', 'price', 'date', 'text'];
  if (!name || name.length < 1) errors.name = 'Názov je povinný.';
  if (name.length > 80) errors.name = 'Max 80 znakov.';
  if (!validTypes.includes(fieldType)) errors.field_type = 'Neplatný typ.';

  return {
    value: { name, field_type: fieldType, unit, is_filterable: isFilterable, is_total: isTotal },
    errors,
  };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const rankings = await db('rankings')
      .leftJoin('ranking_items', 'rankings.id', 'ranking_items.ranking_id')
      .select('rankings.*')
      .count({ item_count: 'ranking_items.id' })
      .groupBy('rankings.id')
      .orderBy('rankings.created_at', 'desc');

    rankings.forEach((r) => (r.item_count = Number(r.item_count)));

    res.render('admin/rankings/index', {
      title: 'Rebríčky',
      currentPath: '/admin/rankings',
      pageTitle: 'Rebríčky',
      rankings,
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
  res.render('admin/rankings/edit', {
    title: 'Nový rebríček',
    currentPath: '/admin/rankings',
    pageTitle: 'Nový rebríček',
    ranking: {
      id: null,
      name: '',
      slug: '',
      description: '',
      status: 'active',
      admin_override: 0,
      sort_direction: 'desc',
      max_age_months: null,
      seo_title: '',
      seo_description: '',
    },
    criteria: [],
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
    const { value, errors } = validateRanking(req.body);

    if (Object.keys(errors).length > 0) {
      return res.status(400).render('admin/rankings/edit', {
        title: 'Nový rebríček',
        currentPath: '/admin/rankings',
        pageTitle: 'Nový rebríček',
        ranking: { id: null, ...value },
        criteria: [],
        errors,
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }

    const baseSlug = value.slug || slugify(value.name);
    if (!baseSlug) {
      return res.status(400).render('admin/rankings/edit', {
        title: 'Nový rebríček',
        currentPath: '/admin/rankings',
        pageTitle: 'Nový rebríček',
        ranking: { id: null, ...value },
        criteria: [],
        errors: { name: 'Z názvu sa nedá vygenerovať slug.' },
        csrfToken: generateToken(req, res),
        isNew: true,
      });
    }

    const finalSlug = await ensureUniqueSlug(baseSlug);

    const [id] = await db('rankings').insert({
      name: value.name,
      slug: finalSlug,
      description: value.description,
      status: value.status,
      admin_override: value.admin_override,
      sort_direction: value.sort_direction,
      max_age_months: value.max_age_months,
      seo_title: value.seo_title,
      seo_description: value.seo_description,
    });

    log.info('ranking created', { id, slug: finalSlug, userId: req.user.id });
    res.redirect(`/admin/rankings/${id}/edit?created=1`);
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/rankings');

    const ranking = await db('rankings').where('id', id).first();
    if (!ranking)
      return res.redirect('/admin/rankings?err=' + encodeURIComponent('Rebríček nenájdený.'));

    const criteria = await db('ranking_criteria')
      .where('ranking_id', id)
      .orderBy('display_order')
      .orderBy('id');

    // Načítaj položky s hodnotami
    const items = await db('ranking_items')
      .leftJoin('articles', 'ranking_items.article_id', 'articles.id')
      .leftJoin('media', 'articles.cover_media_id', 'media.id')
      .where('ranking_items.ranking_id', id)
      .select(
        'ranking_items.*',
        'articles.title as article_title',
        'articles.slug as article_slug',
        'articles.type as article_type',
        'media.thumbnail_path as cover_thumb'
      )
      .orderByRaw('COALESCE(ranking_items.manual_position, 999999)')
      .orderBy('ranking_items.added_at', 'desc');

    // Hodnoty pre položky
    const itemIds = items.map((i) => i.id);
    let valuesMap = new Map();
    if (itemIds.length > 0) {
      const vals = await db('ranking_item_values').whereIn('ranking_item_id', itemIds);
      for (const v of vals) {
        if (!valuesMap.has(v.ranking_item_id)) valuesMap.set(v.ranking_item_id, []);
        valuesMap.get(v.ranking_item_id).push(v);
      }
    }

    // Vypočítaj skóre pre každý item
    items.forEach((item) => {
      item.values = valuesMap.get(item.id) || [];
      item.display_name = item.article_id ? item.article_title : item.custom_name;
      item.display_brand = item.custom_brand || '';

      if (item.override_score !== null && item.override_score !== undefined) {
        item.computed_score = Number(item.override_score);
      } else {
        // Načítaj IDs kritérií, ktoré nie sú numerické (date, text) a price
        const excludeCritIds = new Set(
          criteria.filter((c) => ['date', 'text', 'price'].includes(c.field_type)).map((c) => c.id)
        );
        const numericVals = item.values
          .filter((v) => v.value_decimal !== null && !excludeCritIds.has(Number(v.criterion_id)))
          .map((v) => Number(v.value_decimal));
        item.computed_score =
          numericVals.length > 0
            ? Math.round((numericVals.reduce((a, b) => a + b, 0) / numericVals.length) * 10) / 10
            : null;
      }
    });

    // Zoraď podľa admin_override alebo computed_score
    if (ranking.admin_override) {
      items.sort((a, b) => (a.manual_position || 999) - (b.manual_position || 999));
    } else {
      items.sort((a, b) => {
        const dir = ranking.sort_direction === 'asc' ? 1 : -1;
        return ((b.computed_score || 0) - (a.computed_score || 0)) * dir;
      });
    }

    res.render('admin/rankings/edit', {
      title: 'Upraviť rebríček',
      currentPath: '/admin/rankings',
      pageTitle: ranking.name,
      ranking,
      criteria,
      items,
      errors: {},
      flash: buildFlash(req),
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/rankings');

    const existing = await db('rankings').where('id', id).first();
    if (!existing)
      return res.redirect('/admin/rankings?err=' + encodeURIComponent('Rebríček nenájdený.'));

    const { value, errors } = validateRanking(req.body);

    if (Object.keys(errors).length > 0) {
      const criteria = await db('ranking_criteria')
        .where('ranking_id', id)
        .orderBy('display_order');
      return res.status(400).render('admin/rankings/edit', {
        title: 'Upraviť rebríček',
        currentPath: '/admin/rankings',
        pageTitle: value.name || existing.name,
        ranking: { id, ...value },
        criteria,
        items: [],
        errors,
        flash: {},
        csrfToken: generateToken(req, res),
        isNew: false,
      });
    }

    let finalSlug = value.slug || slugify(value.name);
    if (finalSlug !== existing.slug) {
      finalSlug = await ensureUniqueSlug(finalSlug, id);
    }

    // Nájdi sort_criterion_id (is_total kritérium)
    const totalCriterion = await db('ranking_criteria')
      .where('ranking_id', id)
      .where('is_total', 1)
      .first();

    await db('rankings')
      .where('id', id)
      .update({
        name: value.name,
        slug: finalSlug,
        description: value.description,
        status: value.status,
        admin_override: value.admin_override,
        sort_criterion_id: totalCriterion ? totalCriterion.id : null,
        sort_direction: value.sort_direction,
        max_age_months: value.max_age_months,
        seo_title: value.seo_title,
        seo_description: value.seo_description,
      });

    log.info('ranking updated', { id, slug: finalSlug, userId: req.user.id });
    res.redirect(`/admin/rankings/${id}/edit?updated=1`);
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/rankings');

    const ranking = await db('rankings').where('id', id).first();
    if (!ranking) return res.redirect('/admin/rankings');

    const cnt = await db('ranking_items').where('ranking_id', id).count({ c: '*' }).first();
    if (Number(cnt.c) > 0) {
      return res.redirect(
        '/admin/rankings?err=' +
          encodeURIComponent(`Rebríček „${ranking.name}" má ${cnt.c} položiek — najprv ich odober.`)
      );
    }

    await db.transaction(async (trx) => {
      await trx('ranking_criteria').where('ranking_id', id).del();
      await trx('rankings').where('id', id).del();
    });

    log.info('ranking deleted', { id, slug: ranking.slug, userId: req.user.id });
    res.redirect('/admin/rankings?deleted=1');
  } catch (err) {
    next(err);
  }
});

// ===========================================================================
// CRITERIA — AJAX endpoints (JSON)
// ===========================================================================

// ADD criterion
router.post('/:id/criteria', async (req, res, next) => {
  try {
    const rankingId = Number(req.params.id);
    const ranking = await db('rankings').where('id', rankingId).first();
    if (!ranking) return res.status(404).json({ error: 'Rebríček nenájdený.' });

    const { value, errors } = validateCriterion(req.body);
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    // Ak is_total=1, odznač ostatné
    if (value.is_total) {
      await db('ranking_criteria').where('ranking_id', rankingId).update({ is_total: 0 });
    }

    // display_order = max + 1
    const maxRow = await db('ranking_criteria')
      .where('ranking_id', rankingId)
      .max({ m: 'display_order' })
      .first();
    const nextOrder = (maxRow?.m ?? -1) + 1;

    const [insertedId] = await db('ranking_criteria').insert({
      ranking_id: rankingId,
      name: value.name,
      field_type: value.field_type,
      unit: value.unit,
      is_filterable: value.is_filterable,
      is_total: value.is_total,
      display_order: nextOrder,
    });

    const criterion = await db('ranking_criteria').where('id', insertedId).first();
    log.info('criterion added', { id: insertedId, rankingId });
    res.json({ ok: true, criterion });
  } catch (err) {
    next(err);
  }
});

// UPDATE criterion
router.post('/:id/criteria/:cid', async (req, res, next) => {
  try {
    const rankingId = Number(req.params.id);
    const cid = Number(req.params.cid);
    const existing = await db('ranking_criteria')
      .where('id', cid)
      .where('ranking_id', rankingId)
      .first();
    if (!existing) return res.status(404).json({ error: 'Kritérium nenájdené.' });

    const { value, errors } = validateCriterion(req.body);
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    if (value.is_total) {
      await db('ranking_criteria')
        .where('ranking_id', rankingId)
        .whereNot('id', cid)
        .update({ is_total: 0 });
    }

    await db('ranking_criteria').where('id', cid).update({
      name: value.name,
      field_type: value.field_type,
      unit: value.unit,
      is_filterable: value.is_filterable,
      is_total: value.is_total,
    });

    const criterion = await db('ranking_criteria').where('id', cid).first();
    log.info('criterion updated', { id: cid, rankingId });
    res.json({ ok: true, criterion });
  } catch (err) {
    next(err);
  }
});

// DELETE criterion
router.post('/:id/criteria/:cid/delete', async (req, res, next) => {
  try {
    const rankingId = Number(req.params.id);
    const cid = Number(req.params.cid);
    const existing = await db('ranking_criteria')
      .where('id', cid)
      .where('ranking_id', rankingId)
      .first();
    if (!existing) return res.status(404).json({ error: 'Kritérium nenájdené.' });

    // Zmaž aj hodnoty
    const itemIds = await db('ranking_items').where('ranking_id', rankingId).pluck('id');
    if (itemIds.length > 0) {
      await db('ranking_item_values')
        .whereIn('ranking_item_id', itemIds)
        .where('criterion_id', cid)
        .del();
    }

    await db('ranking_criteria').where('id', cid).del();
    log.info('criterion deleted', { id: cid, rankingId });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// REORDER criteria
router.post('/:id/criteria/reorder', async (req, res, next) => {
  try {
    const rankingId = Number(req.params.id);
    const order = req.body.order; // array of criterion IDs
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Chýba pole order.' });

    await db.transaction(async (trx) => {
      for (let i = 0; i < order.length; i++) {
        await trx('ranking_criteria')
          .where('id', Number(order[i]))
          .where('ranking_id', rankingId)
          .update({ display_order: i });
      }
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

require('./admin-ranking-items')(router);

module.exports = router;
