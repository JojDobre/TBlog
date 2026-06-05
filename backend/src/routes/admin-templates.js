'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');

const router = express.Router();
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

// LIST
router.get('/', async (req, res, next) => {
  try {
    const templates = await db('article_templates').orderBy('display_order').orderBy('name');
    res.render('admin/templates/index', {
      title: 'Šablóny článkov',
      templates,
      csrfToken: generateToken(req, res),
      flash: req.query.saved ? 'Uložené.' : req.query.deleted ? 'Šablóna odstránená.' : null,
    });
  } catch (err) {
    next(err);
  }
});

// NEW
router.get('/new', async (req, res, next) => {
  try {
    res.render('admin/templates/edit', {
      title: 'Nová šablóna',
      template: {
        id: null,
        name: '',
        icon: 'bi-file-earmark-text',
        type: 'article',
        blocks_json: '[]',
        display_order: 0,
      },
      csrfToken: generateToken(req, res),
      isNew: true,
      errors: {},
    });
  } catch (err) {
    next(err);
  }
});

// CREATE
router.post('/', async (req, res, next) => {
  try {
    const { name, icon, type, blocks_json, display_order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).render('admin/templates/edit', {
        title: 'Nová šablóna',
        template: { id: null, name, icon, type, blocks_json, display_order },
        csrfToken: generateToken(req, res),
        isNew: true,
        errors: { name: 'Názov je povinný.' },
      });
    }
    // Validate JSON
    try {
      JSON.parse(blocks_json || '[]');
    } catch {
      return res.status(400).render('admin/templates/edit', {
        title: 'Nová šablóna',
        template: { id: null, name, icon, type, blocks_json, display_order },
        csrfToken: generateToken(req, res),
        isNew: true,
        errors: { blocks_json: 'Neplatný JSON.' },
      });
    }
    const [id] = await db('article_templates').insert({
      name: name.trim(),
      icon: (icon || 'bi-file-earmark-text').trim(),
      type: type || 'article',
      blocks_json: blocks_json || '[]',
      display_order: Number(display_order) || 0,
    });
    res.redirect('/admin/templates?saved=1');
  } catch (err) {
    next(err);
  }
});

// EDIT
router.get('/:id/edit', async (req, res, next) => {
  try {
    const template = await db('article_templates').where('id', req.params.id).first();
    if (!template) return res.redirect('/admin/templates');
    res.render('admin/templates/edit', {
      title: 'Upraviť: ' + template.name,
      template,
      csrfToken: generateToken(req, res),
      isNew: false,
      errors: {},
    });
  } catch (err) {
    next(err);
  }
});

// UPDATE
router.post('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await db('article_templates').where('id', id).first();
    if (!existing) return res.redirect('/admin/templates');
    const { name, icon, type, blocks_json, display_order } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).render('admin/templates/edit', {
        title: 'Upraviť: ' + existing.name,
        template: { ...existing, name, icon, type, blocks_json, display_order },
        csrfToken: generateToken(req, res),
        isNew: false,
        errors: { name: 'Názov je povinný.' },
      });
    }
    try {
      JSON.parse(blocks_json || '[]');
    } catch {
      return res.status(400).render('admin/templates/edit', {
        title: 'Upraviť: ' + existing.name,
        template: { ...existing, name, icon, type, blocks_json, display_order },
        csrfToken: generateToken(req, res),
        isNew: false,
        errors: { blocks_json: 'Neplatný JSON.' },
      });
    }
    await db('article_templates')
      .where('id', id)
      .update({
        name: name.trim(),
        icon: (icon || 'bi-file-earmark-text').trim(),
        type: type || 'article',
        blocks_json: blocks_json || '[]',
        display_order: Number(display_order) || 0,
      });
    res.redirect('/admin/templates?saved=1');
  } catch (err) {
    next(err);
  }
});

// DELETE
router.post('/:id/delete', async (req, res, next) => {
  try {
    await db('article_templates').where('id', req.params.id).del();
    res.redirect('/admin/templates?deleted=1');
  } catch (err) {
    next(err);
  }
});

// API — JSON list for editor dropdown
router.get('/api/list', async (req, res, next) => {
  try {
    const rows = await db('article_templates').orderBy('display_order').orderBy('name');
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        type: r.type,
        blocks: JSON.parse(r.blocks_json || '[]'),
      }))
    );
  } catch (err) {
    next(err);
  }
});

// API — save from editor ("Uložiť ako šablónu")
router.post('/api/save-from-editor', async (req, res, next) => {
  try {
    const { name, type, blocks_json } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Názov je povinný.' });
    try {
      JSON.parse(blocks_json || '[]');
    } catch {
      return res.status(400).json({ error: 'Neplatný JSON.' });
    }
    const [id] = await db('article_templates').insert({
      name: name.trim(),
      icon: type === 'review' ? 'bi-star' : 'bi-file-earmark-text',
      type: type || 'article',
      blocks_json,
      display_order: 0,
    });
    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
