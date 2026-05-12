/**
 * API comments routes  (mounted at /api/comments)
 *
 * GET    /:articleId          — komentáre pre článok (verejné, paginované)
 * POST   /                   — pridať komentár (prihlásený user)
 * PUT    /:id                 — editovať vlastný komentár
 * DELETE /:id                 — zmazať vlastný komentár
 * POST   /:id/like            — toggle like
 * POST   /:id/report          — nahlásiť komentár
 *
 * CSRF: globálny middleware validuje automaticky (JSON body, x-csrf-token header).
 * Auth: requireAuth len na POST/PUT/DELETE.
 */

'use strict';

const notifications = require('../utils/notifications');
const express = require('express');
const rateLimit = require('express-rate-limit');

const db = require('../db');
const log = require('../logger');
const { requireAuth } = require('../middleware/auth');
const comments = require('../utils/comments');
const config = require('../../../config');

const router = express.Router();

// ---------------------------------------------------------------------------
// Rate limit: 5 komentárov za minútu na IP
// ---------------------------------------------------------------------------

const commentWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Príliš veľa komentárov. Počkaj chvíľu.' },
  // len na write operácie (POST/PUT), nie na GET
  skip: (req) => req.method === 'GET',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Overí že komentár existuje a vráti ho, alebo pošle 404.
 */
async function findComment(id, res) {
  const row = await db('comments').where('id', id).first();
  if (!row) {
    res.status(404).json({ error: 'Komentár nenájdený.' });
    return null;
  }
  return row;
}

// ---------------------------------------------------------------------------
// GET /:articleId — načítanie komentárov
// ---------------------------------------------------------------------------

router.get('/:articleId', async (req, res, next) => {
  try {
    const articleId = parseId(req.params.articleId);
    if (!articleId) return res.status(400).json({ error: 'Neplatné ID článku.' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = config.defaults.commentsPerPage || 20;
    const userId = req.user ? req.user.id : null;

    const result = await comments.loadComments(db, articleId, {
      page,
      perPage,
      userId,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// AUTH GATE — všetky write operácie vyžadujú prihláseného usera
// ---------------------------------------------------------------------------

router.use(requireAuth({ redirectTo: null }));

// Ak requireAuth redirectne (HTML), pre API chceme 401 JSON
router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Pre túto akciu sa musíš prihlásiť.' });
  }
  next();
});

router.use(commentWriteLimiter);

// ---------------------------------------------------------------------------
// POST / — pridanie komentáru
// ---------------------------------------------------------------------------

router.post('/', async (req, res, next) => {
  try {
    const articleId = parseId(req.body.article_id);
    if (!articleId) return res.status(400).json({ error: 'Neplatné ID článku.' });

    // Overenie že článok existuje a je publikovaný
    const article = await db('articles')
      .where('id', articleId)
      .where('status', 'published')
      .first('id');
    if (!article) return res.status(404).json({ error: 'Článok nenájdený.' });

    // Validácia obsahu
    const v = comments.validateContent(req.body.content);
    if (!v.ok) return res.status(400).json({ error: v.error });

    // Parent — voliteľný (reply)
    let parentId = null;
    if (req.body.parent_id) {
      parentId = parseId(req.body.parent_id);
      if (!parentId) return res.status(400).json({ error: 'Neplatné parent_id.' });

      const parent = await db('comments')
        .where('id', parentId)
        .where('article_id', articleId)
        .first('id', 'parent_id');
      if (!parent) return res.status(404).json({ error: 'Nadradený komentár nenájdený.' });

      // Dvojúrovňové vlákna — ak parent je reply, odpovedaj top-level parentovi
      if (parent.parent_id) {
        parentId = parent.parent_id;
      }
    }

    const [insertedId] = await db('comments').insert({
      article_id: articleId,
      user_id: req.user.id,
      parent_id: parentId,
      content: v.content,
    });

    const id = typeof insertedId === 'object' ? insertedId[0] : insertedId;

    // Načítaj vytvorený komentár so všetkými údajmi
    const row = await db('comments')
      .leftJoin('users', 'comments.user_id', 'users.id')
      .leftJoin('media as avatar_media', 'users.avatar_media_id', 'avatar_media.id')
      .where('comments.id', id)
      .select('comments.*', 'users.nickname', 'avatar_media.thumbnail_path as avatar_path')
      .first();

    const formatted = comments.formatComment({ ...row, likes_count: 0 });
    formatted.liked_by_me = false;

    log.info('comment created', { id, articleId, userId: req.user.id, parentId });
    // Notifikácia — reply
    if (parentId) {
      const parentComment = await db('comments')
        .leftJoin('articles', 'comments.article_id', 'articles.id')
        .where('comments.id', parentId)
        .select('comments.user_id', 'articles.title as article_title')
        .first();
      if (parentComment) {
        notifications.notifyCommentReply(db, {
          commentOwnerId: parentComment.user_id,
          actorId: req.user.id,
          actorNickname: req.user.nickname,
          commentId: id,
          articleId: articleId,
          articleTitle: parentComment.article_title,
        });
      }
    }
    res.status(201).json({ comment: formatted });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — editácia vlastného komentáru
// ---------------------------------------------------------------------------

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID.' });

    const comment = await findComment(id, res);
    if (!comment) return;

    // Len vlastný komentár
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Môžeš upraviť len vlastný komentár.' });
    }

    // Nesmie byť zmazaný adminom
    if (comment.is_deleted_by_admin) {
      return res.status(403).json({ error: 'Tento komentár bol zmazaný administrátorom.' });
    }

    const v = comments.validateContent(req.body.content);
    if (!v.ok) return res.status(400).json({ error: v.error });

    await db('comments').where('id', id).update({
      content: v.content,
      updated_at: db.fn.now(),
    });

    log.info('comment edited', { id, userId: req.user.id });
    res.json({ ok: true, content: v.content });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — zmazanie vlastného komentáru
// ---------------------------------------------------------------------------

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID.' });

    const comment = await findComment(id, res);
    if (!comment) return;

    // Len vlastný komentár (admin maže cez admin panel)
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Môžeš zmazať len vlastný komentár.' });
    }

    // Hard delete — replies sa zmažú cez ON DELETE CASCADE
    await db('comments').where('id', id).del();

    log.info('comment deleted', { id, userId: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/like — toggle like
// ---------------------------------------------------------------------------

router.post('/:id/like', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID.' });

    const comment = await findComment(id, res);
    if (!comment) return;

    // Toggle — existuje? odober. neexistuje? pridaj.
    const existing = await db('comment_likes')
      .where({ comment_id: id, user_id: req.user.id })
      .first();

    if (existing) {
      await db('comment_likes').where({ comment_id: id, user_id: req.user.id }).del();
    } else {
      await db('comment_likes').insert({
        comment_id: id,
        user_id: req.user.id,
      });
    }

    // Vráť aktuálny počet likes
    const countRow = await db('comment_likes').where('comment_id', id).count({ c: '*' }).first();

    res.json({
      ok: true,
      liked: !existing,
      likes_count: Number(countRow.c),
    });
    if (!existing) {
      const cmtWithArticle = await db('comments')
        .leftJoin('articles', 'comments.article_id', 'articles.id')
        .where('comments.id', id)
        .select('comments.user_id', 'comments.article_id', 'articles.title as article_title')
        .first();
      if (cmtWithArticle) {
        notifications.notifyCommentLike(db, {
          commentOwnerId: cmtWithArticle.user_id,
          actorId: req.user.id,
          actorNickname: req.user.nickname,
          commentId: id,
          articleId: cmtWithArticle.article_id,
          articleTitle: cmtWithArticle.article_title,
        });
      }
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/report — nahlásenie komentáru
// ---------------------------------------------------------------------------

router.post('/:id/report', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Neplatné ID.' });

    const comment = await findComment(id, res);
    if (!comment) return;

    // Nemôžeš nahlásiť vlastný komentár
    if (comment.user_id === req.user.id) {
      return res.status(400).json({ error: 'Nemôžeš nahlásiť vlastný komentár.' });
    }

    // Už nahlásený týmto userom?
    const existing = await db('comment_reports')
      .where({ comment_id: id, reporter_id: req.user.id })
      .first();
    if (existing) {
      return res.status(409).json({ error: 'Tento komentár si už nahlásil.' });
    }

    const v = comments.validateReportReason(req.body.reason);
    if (!v.ok) return res.status(400).json({ error: v.error });

    await db('comment_reports').insert({
      comment_id: id,
      reporter_id: req.user.id,
      reason: v.reason,
    });

    log.info('comment reported', { commentId: id, reporterId: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
