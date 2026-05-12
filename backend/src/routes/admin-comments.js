/**
 * Admin comments routes  (mounted at /admin/comments)
 *
 * GET  /                  — list s filtrami
 * POST /:id/toggle-delete — soft delete / restore
 * POST /:id/hard-delete   — permanentné zmazanie
 * POST /reports/:id/resolve — vyriešenie reportu
 * POST /bulk              — bulk akcie (delete, restore)
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

const PER_PAGE = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFlash(req) {
  return {
    deleted: !!req.query.deleted,
    restored: !!req.query.restored,
    resolved: !!req.query.resolved,
    err: req.query.err ? String(req.query.err) : null,
  };
}

function parseId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Tab definície
const TABS = [
  { key: 'all',      label: 'Všetky',      filter: {} },
  { key: 'reported', label: 'Nahlásené',   filter: { reported: true } },
  { key: 'deleted',  label: 'Zmazané',     filter: { deleted: true } },
];

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const tab = TABS.find((t) => t.key === req.query.tab) || TABS[0];
    const q = String(req.query.q || '').trim().slice(0, 200);
    const articleFilter = req.query.article ? Number(req.query.article) : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    // Base query
    const buildWhere = (qb) => {
      if (tab.filter.reported) {
        qb.whereExists(function () {
          this.select(db.raw(1))
            .from('comment_reports')
            .whereRaw('comment_reports.comment_id = comments.id')
            .where('comment_reports.is_resolved', false);
        });
      }
      if (tab.filter.deleted) {
        qb.where('comments.is_deleted_by_admin', true);
      }
      if (q) {
        qb.where(function () {
          this.where('comments.content', 'like', `%${q}%`)
            .orWhere('users.nickname', 'like', `%${q}%`);
        });
      }
      if (articleFilter) {
        qb.where('comments.article_id', articleFilter);
      }
      return qb;
    };

    // Count
    const countRow = await buildWhere(
      db('comments').leftJoin('users', 'comments.user_id', 'users.id')
    ).count({ c: '*' }).first();
    const total = Number(countRow.c);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    // Rows
    const rows = await buildWhere(
      db('comments')
        .leftJoin('users', 'comments.user_id', 'users.id')
        .leftJoin('articles', 'comments.article_id', 'articles.id')
    )
      .select(
        'comments.id',
        'comments.article_id',
        'comments.user_id',
        'comments.parent_id',
        'comments.content',
        'comments.is_deleted_by_admin',
        'comments.created_at',
        'comments.updated_at',
        'users.nickname',
        'articles.title as article_title',
        'articles.slug as article_slug',
        'articles.type as article_type'
      )
      .orderBy('comments.created_at', 'desc')
      .limit(PER_PAGE)
      .offset(offset);

    // Reports count per comment
    const commentIds = rows.map((r) => r.id);
    let reportsMap = new Map();
    if (commentIds.length > 0) {
      const reportCounts = await db('comment_reports')
        .whereIn('comment_id', commentIds)
        .where('is_resolved', false)
        .select('comment_id')
        .count({ c: '*' })
        .groupBy('comment_id');
      for (const r of reportCounts) {
        reportsMap.set(r.comment_id, Number(r.c));
      }
    }

    // Tab counts
    const counts = {};
    counts.all = await db('comments').count({ c: '*' }).first().then((r) => Number(r.c));
    counts.reported = await db('comment_reports')
      .where('is_resolved', false)
      .countDistinct({ c: 'comment_id' })
      .first()
      .then((r) => Number(r.c));
    counts.deleted = await db('comments')
      .where('is_deleted_by_admin', true)
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));

    // Enrich rows
    const comments = rows.map((r) => ({
      ...r,
      reports_count: reportsMap.get(r.id) || 0,
      content_short: r.content
        ? r.content.slice(0, 150) + (r.content.length > 150 ? '…' : '')
        : '',
    }));

    res.render('admin/comments/index', {
      title: 'Komentáre',
      currentPath: '/admin/comments',
      pageTitle: 'Komentáre',
      comments,
      tabs: TABS,
      activeTab: tab.key,
      counts,
      query: { q, page, tab: tab.key, article: articleFilter },
      pagination: { total, totalPages, page, perPage: PER_PAGE },
      flash: buildFlash(req),
      csrfToken: generateToken(req, res),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// TOGGLE SOFT DELETE
// ---------------------------------------------------------------------------

router.post('/:id/toggle-delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/comments?err=Neplatné ID');

    const comment = await db('comments').where('id', id).first();
    if (!comment) return res.redirect('/admin/comments?err=Komentár nenájdený');

    const newVal = !comment.is_deleted_by_admin;
    await db('comments').where('id', id).update({ is_deleted_by_admin: newVal });

    log.info('admin comment toggle-delete', { id, deleted: newVal, adminId: req.user.id });

    const flag = newVal ? 'deleted=1' : 'restored=1';
    res.redirect('/admin/comments?' + flag);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// HARD DELETE
// ---------------------------------------------------------------------------

router.post('/:id/hard-delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/comments?err=Neplatné ID');

    await db('comments').where('id', id).del();

    log.info('admin comment hard-delete', { id, adminId: req.user.id });
    res.redirect('/admin/comments?deleted=1');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// RESOLVE REPORT
// ---------------------------------------------------------------------------

router.post('/reports/:id/resolve', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/comments?err=Neplatné ID reportu');

    await db('comment_reports').where('id', id).update({
      is_resolved: true,
      resolved_by: req.user.id,
      resolved_at: db.fn.now(),
    });

    log.info('admin report resolved', { reportId: id, adminId: req.user.id });
    res.redirect('/admin/comments?tab=reported&resolved=1');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DETAIL — zobrazí komentár + jeho reporty
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/comments');

    const comment = await db('comments')
      .leftJoin('users', 'comments.user_id', 'users.id')
      .leftJoin('articles', 'comments.article_id', 'articles.id')
      .where('comments.id', id)
      .select(
        'comments.*',
        'users.nickname',
        'articles.title as article_title',
        'articles.slug as article_slug',
        'articles.type as article_type'
      )
      .first();

    if (!comment) return res.redirect('/admin/comments?err=Komentár nenájdený');

    const reports = await db('comment_reports')
      .leftJoin('users as reporter', 'comment_reports.reporter_id', 'reporter.id')
      .leftJoin('users as resolver', 'comment_reports.resolved_by', 'resolver.id')
      .where('comment_reports.comment_id', id)
      .select(
        'comment_reports.*',
        'reporter.nickname as reporter_nickname',
        'resolver.nickname as resolver_nickname'
      )
      .orderBy('comment_reports.created_at', 'desc');

    res.render('admin/comments/detail', {
      title: 'Komentár #' + id,
      currentPath: '/admin/comments',
      pageTitle: 'Komentár #' + id,
      comment,
      reports,
      csrfToken: generateToken(req, res),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
