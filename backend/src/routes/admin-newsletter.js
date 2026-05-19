/**
 * Admin newsletter routes  (mounted at /admin/newsletter)
 *
 * GET  /           — zoznam subscribers
 * GET  /emails     — JSON pole emailov (pre kopírovanie)
 * POST /:id/delete — zmazanie subscribera
 */

'use strict';

const express = require('express');
const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');

const router = express.Router();
router.use(requireAuth());
router.use(requireRole('admin'));

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFlash(req) {
  return {
    success: req.query.success ? String(req.query.success) : null,
    err: req.query.err ? String(req.query.err) : null,
  };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'all', label: 'Všetci' },
  { key: 'active', label: 'Aktívni' },
  { key: 'unsubscribed', label: 'Odhlásení' },
];

router.get('/', async (req, res, next) => {
  try {
    const activeTab = TABS.find((t) => t.key === req.query.tab)?.key || 'all';
    const q = String(req.query.q || '').trim().slice(0, 200);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    const buildWhere = (qb) => {
      if (activeTab === 'active') qb.where('is_active', true);
      if (activeTab === 'unsubscribed') qb.where('is_active', false);
      if (q) qb.where('email', 'like', `%${q}%`);
      return qb;
    };

    const countRow = await buildWhere(db('newsletter_subscribers')).count({ c: '*' }).first();
    const total = Number(countRow.c);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    const rows = await buildWhere(db('newsletter_subscribers'))
      .orderBy('subscribed_at', 'desc')
      .limit(PER_PAGE)
      .offset(offset);

    // Tab counts
    const counts = {};
    counts.all = await db('newsletter_subscribers').count({ c: '*' }).first().then((r) => Number(r.c));
    counts.active = await db('newsletter_subscribers').where('is_active', true).count({ c: '*' }).first().then((r) => Number(r.c));
    counts.unsubscribed = await db('newsletter_subscribers').where('is_active', false).count({ c: '*' }).first().then((r) => Number(r.c));

    res.render('admin/newsletter/index', {
      title: 'Newsletter',
      currentPath: '/admin/newsletter',
      pageTitle: 'Newsletter',
      subscribers: rows,
      tabs: TABS,
      activeTab,
      counts,
      query: { q, page, tab: activeTab },
      pagination: { total, totalPages, page, perPage: PER_PAGE },
      flash: buildFlash(req),
      csrfToken: generateToken(req, res),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /emails — JSON pole aktívnych emailov
// ---------------------------------------------------------------------------

router.get('/emails', async (req, res, next) => {
  try {
    const rows = await db('newsletter_subscribers')
      .where('is_active', true)
      .select('email')
      .orderBy('email');
    const emails = rows.map((r) => r.email);
    res.json({ count: emails.length, emails });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE subscriber
// ---------------------------------------------------------------------------

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.redirect('/admin/newsletter?err=Neplatné ID');

    await db('newsletter_subscribers').where('id', id).del();
    log.info('newsletter subscriber deleted', { id, adminId: req.user.id });
    res.redirect('/admin/newsletter?success=Subscriber bol zmazaný');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
