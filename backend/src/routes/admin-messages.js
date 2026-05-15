/**
 * Admin contact messages routes  (Phase 2 — Balík B)
 *
 * Zobrazenie správ z kontaktného formulára: /admin/messages
 * Tabuľka: contact_messages
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));
const db = require('../db');
const log = require('../logger');
const { generateToken } = require('../middleware/csrf');

// =========================================================================
// LIST
// =========================================================================

router.get('/', async (req, res, next) => {
  try {
    const tab = req.query.tab === 'read' ? 'read' : 'unread';
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;

    let qb = db('contact_messages').orderBy('created_at', 'desc');
    let countQb = db('contact_messages');

    if (tab === 'unread') {
      qb = qb.where('is_read', 0);
      countQb = countQb.where('is_read', 0);
    } else {
      qb = qb.where('is_read', 1);
      countQb = countQb.where('is_read', 1);
    }

    if (q) {
      qb = qb.where(function () {
        this.where('name', 'like', `%${q}%`)
          .orWhere('email', 'like', `%${q}%`)
          .orWhere('subject', 'like', `%${q}%`)
          .orWhere('message', 'like', `%${q}%`);
      });
      countQb = countQb.where(function () {
        this.where('name', 'like', `%${q}%`)
          .orWhere('email', 'like', `%${q}%`)
          .orWhere('subject', 'like', `%${q}%`)
          .orWhere('message', 'like', `%${q}%`);
      });
    }

    const [items, countRow, unreadCount] = await Promise.all([
      qb.clone().limit(perPage).offset(offset),
      countQb.clone().count({ c: '*' }).first(),
      db('contact_messages').where('is_read', 0).count({ c: '*' }).first(),
    ]);

    const total = Number(countRow.c);
    const totalPages = Math.ceil(total / perPage) || 1;

    res.render('admin/messages/index', {
      title: 'Kontaktné správy',
      currentPath: '/admin/messages',
      pageTitle: 'Kontaktné správy',
      items,
      activeTab: tab,
      unreadCount: Number(unreadCount.c),
      query: { q },
      pagination: { page, totalPages, total },
      csrfToken: res.locals.csrfToken,
      flash: {
        marked: !!req.query.marked,
        deleted: !!req.query.deleted,
        err: req.query.err || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// DETAIL (modal-less — zobrazí sa v tabuľke cez expand, ale aj standalone)
// =========================================================================

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    const msg = await db('contact_messages').where('id', id).first();
    if (!msg) return res.redirect('/admin/messages?err=' + encodeURIComponent('Správa nenájdená.'));

    // Auto-mark as read
    if (!msg.is_read) {
      await db('contact_messages').where('id', id).update({ is_read: 1, read_at: new Date() });
      msg.is_read = 1;
      msg.read_at = new Date();
    }

    res.render('admin/messages/detail', {
      title: 'Správa #' + id,
      currentPath: '/admin/messages',
      pageTitle: 'Správa #' + id,
      msg,
      csrfToken: res.locals.csrfToken,
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// MARK READ / UNREAD
// =========================================================================

router.post('/:id/toggle-read', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    const msg = await db('contact_messages').where('id', id).first();
    if (!msg) return res.redirect('/admin/messages?err=' + encodeURIComponent('Správa nenájdená.'));

    const newRead = msg.is_read ? 0 : 1;
    await db('contact_messages')
      .where('id', id)
      .update({
        is_read: newRead,
        read_at: newRead ? new Date() : null,
      });

    log.info('contact message toggled', { id, is_read: newRead, userId: req.user.id });
    res.redirect('/admin/messages?marked=1');
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// MARK ALL READ
// =========================================================================

router.post('/mark-all-read', async (req, res, next) => {
  try {
    const count = await db('contact_messages')
      .where('is_read', 0)
      .update({ is_read: 1, read_at: new Date() });

    log.info('contact messages all marked read', { count, userId: req.user.id });
    res.redirect('/admin/messages?marked=1');
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
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    await db('contact_messages').where('id', id).del();
    log.info('contact message deleted', { id, userId: req.user.id });
    res.redirect('/admin/messages?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
