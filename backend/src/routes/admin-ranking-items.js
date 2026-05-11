/**
 * Admin ranking ITEMS routes  (mounted at /admin/rankings)
 *
 * Phase 9 — Balík 2: Správa položiek rebríčka
 *
 * ITEMS (AJAX — JSON responses):
 *   POST /:id/items                    — add item (article or custom product)
 *   POST /:id/items/:iid               — update item values
 *   POST /:id/items/:iid/delete        — remove item
 *   POST /:id/items/reorder            — reorder items (manual_position)
 *
 * ARTICLE SEARCH API:
 *   GET /api/articles/search?q=...     — search articles for autocomplete
 *
 * Tieto routes sa PRILEPUJÚ k existujúcemu admin-rankings.js routeru.
 * Exportuje funkciu, ktorá príjme router a pridá routes.
 */

'use strict';

const db = require('../db');
const log = require('../logger');

module.exports = function mountItemRoutes(router) {
  // =========================================================================
  // ADD ITEM
  // =========================================================================
  router.post('/:id/items', async (req, res, next) => {
    try {
      const rankingId = Number(req.params.id);
      const ranking = await db('rankings').where('id', rankingId).first();
      if (!ranking) return res.status(404).json({ error: 'Rebríček nenájdený.' });

      const articleId = req.body.article_id ? Number(req.body.article_id) : null;
      const customName = String(req.body.custom_name || '').trim() || null;
      const customBrand = String(req.body.custom_brand || '').trim() || null;
      const overrideScore = req.body.override_score ? parseFloat(req.body.override_score) : null;

      // Validácia
      if (!articleId && !customName) {
        return res.status(400).json({ error: 'Vyber článok alebo zadaj názov produktu.' });
      }

      // Skontroluj duplicitu článku
      if (articleId) {
        const existing = await db('ranking_items')
          .where('ranking_id', rankingId)
          .where('article_id', articleId)
          .first();
        if (existing) {
          return res.status(400).json({ error: 'Tento článok je už v rebríčku.' });
        }
        const article = await db('articles').where('id', articleId).first();
        if (!article) {
          return res.status(400).json({ error: 'Článok neexistuje.' });
        }
      }

      // Max position
      const maxPos = await db('ranking_items')
        .where('ranking_id', rankingId)
        .max({ m: 'manual_position' })
        .first();
      const nextPos = (maxPos?.m ?? -1) + 1;

      const [itemId] = await db('ranking_items').insert({
        ranking_id: rankingId,
        article_id: articleId,
        custom_name: customName,
        custom_brand: customBrand,
        override_score: overrideScore,
        manual_position: nextPos,
        added_at: new Date(),
      });

      // Vlož hodnoty kritérií ak boli poslané
      const criteria = await db('ranking_criteria').where('ranking_id', rankingId);
      const valuesToInsert = [];

      for (const c of criteria) {
        const key = 'crit_' + c.id;
        if (req.body[key] !== undefined && req.body[key] !== '') {
          const isNumeric = ['score_1_10', 'decimal', 'integer', 'price'].includes(c.field_type);
          valuesToInsert.push({
            ranking_item_id: itemId,
            criterion_id: c.id,
            value_decimal: isNumeric ? parseFloat(req.body[key]) || null : null,
            value_text: !isNumeric ? String(req.body[key]).trim() : null,
          });
        }
      }

      if (valuesToInsert.length > 0) {
        await db('ranking_item_values').insert(valuesToInsert);
      }

      log.info('ranking item added', { itemId, rankingId, articleId, customName });
      res.json({ ok: true, id: itemId });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // UPDATE ITEM values
  // =========================================================================
  router.post('/:id/items/:iid', async (req, res, next) => {
    try {
      const rankingId = Number(req.params.id);
      const iid = Number(req.params.iid);

      const item = await db('ranking_items')
        .where('id', iid)
        .where('ranking_id', rankingId)
        .first();
      if (!item) return res.status(404).json({ error: 'Položka nenájdená.' });

      // Update basic fields
      const updates = {};
      if (req.body.custom_name !== undefined)
        updates.custom_name = String(req.body.custom_name).trim() || null;
      if (req.body.custom_brand !== undefined)
        updates.custom_brand = String(req.body.custom_brand).trim() || null;
      if (req.body.override_score !== undefined) {
        updates.override_score =
          req.body.override_score !== '' ? parseFloat(req.body.override_score) : null;
      }

      if (Object.keys(updates).length > 0) {
        await db('ranking_items').where('id', iid).update(updates);
      }

      // Update criterion values
      const criteria = await db('ranking_criteria').where('ranking_id', rankingId);
      for (const c of criteria) {
        const key = 'crit_' + c.id;
        if (req.body[key] === undefined) continue;

        const isNumeric = ['score_1_10', 'decimal', 'integer', 'price'].includes(c.field_type);
        const valDecimal = isNumeric
          ? req.body[key] !== ''
            ? parseFloat(req.body[key])
            : null
          : null;
        const valText = !isNumeric
          ? req.body[key] !== ''
            ? String(req.body[key]).trim()
            : null
          : null;

        const existing = await db('ranking_item_values')
          .where('ranking_item_id', iid)
          .where('criterion_id', c.id)
          .first();

        if (existing) {
          await db('ranking_item_values')
            .where('ranking_item_id', iid)
            .where('criterion_id', c.id)
            .update({
              value_decimal: valDecimal,
              value_text: valText,
            });
        } else if (valDecimal !== null || valText !== null) {
          await db('ranking_item_values').insert({
            ranking_item_id: iid,
            criterion_id: c.id,
            value_decimal: valDecimal,
            value_text: valText,
          });
        }
      }

      log.info('ranking item updated', { iid, rankingId });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // DELETE ITEM
  // =========================================================================
  router.post('/:id/items/:iid/delete', async (req, res, next) => {
    try {
      const rankingId = Number(req.params.id);
      const iid = Number(req.params.iid);

      const item = await db('ranking_items')
        .where('id', iid)
        .where('ranking_id', rankingId)
        .first();
      if (!item) return res.status(404).json({ error: 'Položka nenájdená.' });

      await db.transaction(async (trx) => {
        await trx('ranking_item_values').where('ranking_item_id', iid).del();
        await trx('ranking_items').where('id', iid).del();
      });

      log.info('ranking item deleted', { iid, rankingId });
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // =========================================================================
  // REORDER ITEMS (manual_position)
  // =========================================================================
  router.post('/:id/items/reorder', async (req, res, next) => {
    try {
      const rankingId = Number(req.params.id);
      const order = req.body.order;
      if (!Array.isArray(order)) return res.status(400).json({ error: 'Chýba pole order.' });

      await db.transaction(async (trx) => {
        for (let i = 0; i < order.length; i++) {
          await trx('ranking_items')
            .where('id', Number(order[i]))
            .where('ranking_id', rankingId)
            .update({ manual_position: i });
        }
      });

      // Zapni admin_override ak ešte nie je
      await db('rankings').where('id', rankingId).update({ admin_override: 1 });

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
};
