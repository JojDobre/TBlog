/**
 * Comments utility functions
 *
 * Validácia, formátovanie a DB helper queries pre komentáre.
 */

'use strict';

const MAX_CONTENT_LENGTH = 2000;
const MIN_CONTENT_LENGTH = 1;
const MAX_REPORT_REASON_LENGTH = 500;

// ---------------------------------------------------------------------------
// Validácia
// ---------------------------------------------------------------------------

/**
 * Validuje obsah komentáru.
 * @returns {{ ok: boolean, error?: string, content?: string }}
 */
function validateContent(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Obsah komentáru je povinný.' };
  }
  const content = raw.trim();
  if (content.length < MIN_CONTENT_LENGTH) {
    return { ok: false, error: 'Komentár nesmie byť prázdny.' };
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: `Komentár je príliš dlhý (max ${MAX_CONTENT_LENGTH} znakov).` };
  }
  return { ok: true, content };
}

/**
 * Validuje dôvod nahlásenia.
 * @returns {{ ok: boolean, error?: string, reason?: string|null }}
 */
function validateReportReason(raw) {
  if (raw == null || raw === '') {
    return { ok: true, reason: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Neplatný dôvod.' };
  }
  const reason = raw.trim().slice(0, MAX_REPORT_REASON_LENGTH);
  return { ok: true, reason: reason || null };
}

// ---------------------------------------------------------------------------
// Formátovanie
// ---------------------------------------------------------------------------

/**
 * Naformátuje DB row komentáru pre API response.
 * Skryje obsah ak bol zmazaný adminom.
 */
function formatComment(row) {
  const c = {
    id: row.id,
    article_id: row.article_id,
    parent_id: row.parent_id || null,
    content: row.is_deleted_by_admin ? null : row.content,
    is_deleted_by_admin: !!row.is_deleted_by_admin,
    is_edited: row.updated_at && row.created_at
      ? new Date(row.updated_at).getTime() > new Date(row.created_at).getTime() + 1000
      : false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      id: row.user_id,
      nickname: row.nickname || '[zmazaný]',
      avatar_path: row.avatar_path || null,
    },
    likes_count: Number(row.likes_count) || 0,
    liked_by_me: false, // nastaví sa v route podľa prihláseného usera
  };
  return c;
}

/**
 * Zostaví stromovú štruktúru komentárov (dvojúrovňové vlákna).
 * Top-level komentáre + ich replies (všetky odpovede plochom pod parent).
 */
function buildTree(comments) {
  const topLevel = [];
  const repliesMap = new Map(); // parent_id -> [comments]

  for (const c of comments) {
    if (!c.parent_id) {
      topLevel.push({ ...c, replies: [] });
    } else {
      if (!repliesMap.has(c.parent_id)) repliesMap.set(c.parent_id, []);
      repliesMap.get(c.parent_id).push(c);
    }
  }

  for (const top of topLevel) {
    top.replies = repliesMap.get(top.id) || [];
  }

  return topLevel;
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Načíta komentáre pre článok.
 *
 * @param {import('knex').Knex} db
 * @param {number} articleId
 * @param {{ page?: number, perPage?: number, userId?: number|null }} opts
 * @returns {Promise<{ comments: object[], total: number, page: number, totalPages: number }>}
 */
async function loadComments(db, articleId, opts = {}) {
  const page = Math.max(1, opts.page || 1);
  const perPage = opts.perPage || 20;
  const userId = opts.userId || null;

  // Celkový počet top-level komentárov (pre paging)
  const countRow = await db('comments')
    .where('article_id', articleId)
    .whereNull('parent_id')
    .count({ c: '*' })
    .first();
  const total = Number(countRow.c);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  if (total === 0) {
    return { comments: [], total: 0, page: 1, totalPages: 1 };
  }

  // Top-level IDs pre aktuálnu stránku
  const topIds = await db('comments')
    .where('article_id', articleId)
    .whereNull('parent_id')
    .orderBy('created_at', 'asc')
    .limit(perPage)
    .offset((page - 1) * perPage)
    .pluck('id');

  if (topIds.length === 0) {
    return { comments: [], total, page, totalPages };
  }

  // Načítaj top-level + ich replies v jednom query
  const rows = await db('comments')
    .leftJoin('users', 'comments.user_id', 'users.id')
    .leftJoin('media as avatar_media', 'users.avatar_media_id', 'avatar_media.id')
    .leftJoin(
      db('comment_likes')
        .select('comment_id')
        .count({ c: '*' })
        .groupBy('comment_id')
        .as('lk'),
      'comments.id',
      'lk.comment_id'
    )
    .where(function () {
      this.whereIn('comments.id', topIds)
        .orWhereIn('comments.parent_id', topIds);
    })
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
      'avatar_media.thumbnail_path as avatar_path',
      db.raw('COALESCE(lk.c, 0) as likes_count')
    )
    .orderBy('comments.created_at', 'asc');

  // Formátuj
  let comments = rows.map(formatComment);

  // Ak je user prihlásený, načítaj jeho likes
  if (userId) {
    const commentIds = comments.map((c) => c.id);
    const likedIds = await db('comment_likes')
      .where('user_id', userId)
      .whereIn('comment_id', commentIds)
      .pluck('comment_id');
    const likedSet = new Set(likedIds);
    for (const c of comments) {
      c.liked_by_me = likedSet.has(c.id);
    }
  }

  const tree = buildTree(comments);

  return { comments: tree, total, page, totalPages };
}

module.exports = {
  MAX_CONTENT_LENGTH,
  MIN_CONTENT_LENGTH,
  MAX_REPORT_REASON_LENGTH,
  validateContent,
  validateReportReason,
  formatComment,
  buildTree,
  loadComments,
};
