/**
 * Admin users routes  (mounted at /admin/users)
 *
 * GET  /                    — zoznam s filtrami (role, status, search)
 * GET  /:id                 — detail používateľa
 * POST /:id/role            — zmena role
 * POST /:id/ban             — zabanovanie
 * POST /:id/unban           — odbanovanie
 * POST /:id/reset-password  — reset hesla (manuálne alebo generované)
 * POST /:id/delete          — permanentné zmazanie
 */

'use strict';

const express = require('express');
const crypto = require('crypto');

const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const auth = require('../utils/auth');

const router = express.Router();
router.use(requireAuth());
router.use(requireRole('admin'));

const PER_PAGE = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFlash(req) {
  return {
    success: req.query.success ? String(req.query.success) : null,
    err: req.query.err ? String(req.query.err) : null,
  };
}

function parseId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function generateRandomPassword(length = 16) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Tab definície
const TABS = [
  { key: 'all', label: 'Všetci' },
  { key: 'admin', label: 'Admini' },
  { key: 'editor', label: 'Editori' },
  { key: 'reader', label: 'Čitatelia' },
  { key: 'banned', label: 'Zablokovaní' },
];

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const activeTab = TABS.find((t) => t.key === req.query.tab)?.key || 'all';
    const q = String(req.query.q || '')
      .trim()
      .slice(0, 200);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    const buildWhere = (qb) => {
      if (activeTab === 'banned') {
        qb.where('users.is_banned', true);
      } else if (['admin', 'editor', 'reader'].includes(activeTab)) {
        qb.where('users.role', activeTab);
      }
      if (q) {
        qb.where(function () {
          this.where('users.nickname', 'like', `%${q}%`).orWhere('users.email', 'like', `%${q}%`);
        });
      }
      return qb;
    };

    // Count
    const countRow = await buildWhere(db('users')).count({ c: '*' }).first();
    const total = Number(countRow.c);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    // Rows
    const rows = await buildWhere(
      db('users').leftJoin('media', 'users.avatar_media_id', 'media.id')
    )
      .select(
        'users.id',
        'users.nickname',
        'users.email',
        'users.role',
        'users.is_banned',
        'users.last_login_at',
        'users.created_at',
        db.raw('media.thumbnail_path as avatar_path')
      )
      .orderBy('users.created_at', 'desc')
      .limit(PER_PAGE)
      .offset(offset);

    // Tab counts
    const counts = {};
    counts.all = await db('users')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    counts.admin = await db('users')
      .where('role', 'admin')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    counts.editor = await db('users')
      .where('role', 'editor')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    counts.reader = await db('users')
      .where('role', 'reader')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    counts.banned = await db('users')
      .where('is_banned', true)
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));

    res.render('admin/users/index', {
      title: 'Používatelia',
      currentPath: '/admin/users',
      pageTitle: 'Používatelia',
      users: rows,
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
// DETAIL
// ---------------------------------------------------------------------------

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/users');

    const user = await db('users')
      .leftJoin('media', 'users.avatar_media_id', 'media.id')
      .where('users.id', id)
      .select('users.*', db.raw('media.thumbnail_path as avatar_path'))
      .first();

    if (!user) return res.redirect('/admin/users?err=Používateľ nenájdený');

    // Social links
    const socialLinks = await db('user_social_links').where('user_id', id).orderBy('platform');

    // Ban history
    const bans = await db('user_bans')
      .leftJoin('users as admin', 'user_bans.banned_by', 'admin.id')
      .where('user_bans.user_id', id)
      .select('user_bans.*', 'admin.nickname as admin_nickname')
      .orderBy('user_bans.created_at', 'desc');

    // Recent comments
    const comments = await db('comments')
      .leftJoin('articles', 'comments.article_id', 'articles.id')
      .where('comments.user_id', id)
      .select(
        'comments.id',
        'comments.content',
        'comments.is_deleted_by_admin',
        'comments.created_at',
        'articles.title as article_title',
        'articles.slug as article_slug'
      )
      .orderBy('comments.created_at', 'desc')
      .limit(20);

    // Stats
    const stats = {};
    stats.comments = await db('comments')
      .where('user_id', id)
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    stats.articles = await db('articles')
      .where('author_id', id)
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));

    res.render('admin/users/detail', {
      title: user.nickname,
      currentPath: '/admin/users',
      pageTitle: user.nickname,
      u: user,
      socialLinks,
      bans,
      comments,
      stats,
      flash: buildFlash(req),
      csrfToken: generateToken(req, res),
      minPasswordLength: auth.MIN_PASSWORD_LENGTH,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// CHANGE ROLE
// ---------------------------------------------------------------------------

router.post('/:id/role', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/users?err=Neplatné ID');

    const validRoles = ['admin', 'editor', 'reader'];
    const newRole = req.body.role;
    if (!validRoles.includes(newRole)) {
      return res.redirect(`/admin/users/${id}?err=Neplatná rola`);
    }

    // Nemôžeš zmeniť rolu sám sebe
    if (id === req.user.id) {
      return res.redirect(`/admin/users/${id}?err=Nemôžeš zmeniť vlastnú rolu`);
    }

    await db('users').where('id', id).update({ role: newRole });
    log.info('admin user role changed', { userId: id, newRole, adminId: req.user.id });

    res.redirect(`/admin/users/${id}?success=Rola zmenená na ${newRole}`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// BAN
// ---------------------------------------------------------------------------

router.post('/:id/ban', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/users?err=Neplatné ID');

    if (id === req.user.id) {
      return res.redirect(`/admin/users/${id}?err=Nemôžeš zablokovať sám seba`);
    }

    const reason =
      String(req.body.reason || '')
        .trim()
        .slice(0, 1000) || null;

    await db('users').where('id', id).update({ is_banned: true });
    await db('user_bans').insert({
      user_id: id,
      banned_by: req.user.id,
      reason,
    });

    log.info('admin user banned', { userId: id, reason, adminId: req.user.id });
    res.redirect(`/admin/users/${id}?success=Používateľ bol zablokovaný`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// UNBAN
// ---------------------------------------------------------------------------

router.post('/:id/unban', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/users?err=Neplatné ID');

    await db('users').where('id', id).update({ is_banned: false });

    // Označ posledný otvorený ban ako ukončený
    const lastBan = await db('user_bans')
      .where('user_id', id)
      .whereNull('unbanned_at')
      .orderBy('created_at', 'desc')
      .first();

    if (lastBan) {
      await db('user_bans').where('id', lastBan.id).update({ unbanned_at: db.fn.now() });
    }

    log.info('admin user unbanned', { userId: id, adminId: req.user.id });
    res.redirect(`/admin/users/${id}?success=Používateľ bol odblokovaný`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// RESET PASSWORD
// ---------------------------------------------------------------------------

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/users?err=Neplatné ID');

    const mode = req.body.mode; // 'manual' alebo 'generate'
    let newPassword;

    if (mode === 'manual') {
      newPassword = req.body.password;
      const pwErr = auth.validatePassword(newPassword);
      if (pwErr) {
        return res.redirect(`/admin/users/${id}?err=${encodeURIComponent(pwErr)}`);
      }
    } else {
      newPassword = generateRandomPassword();
    }

    await auth.changePassword(id, newPassword);
    log.info('admin password reset', { userId: id, mode, adminId: req.user.id });

    if (mode === 'generate') {
      // Zobraz vygenerované heslo cez flash
      return res.redirect(
        `/admin/users/${id}?success=${encodeURIComponent('Nové heslo: ' + newPassword)}`
      );
    }

    res.redirect(`/admin/users/${id}?success=Heslo bolo zmenené`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/users?err=Neplatné ID');

    if (id === req.user.id) {
      return res.redirect(`/admin/users/${id}?err=Nemôžeš zmazať vlastný účet`);
    }

    const user = await db('users').where('id', id).first();
    if (!user) return res.redirect('/admin/users?err=Používateľ nenájdený');

    await db('users').where('id', id).del();
    log.info('admin user deleted', { userId: id, nickname: user.nickname, adminId: req.user.id });

    res.redirect('/admin/users?success=Používateľ bol zmazaný');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
