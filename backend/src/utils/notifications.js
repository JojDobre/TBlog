/**
 * Notifications utility
 *
 * Pomocné funkcie na vytváranie notifikácií.
 * Nikdy nefailuje request — chyby sa logujú a potichu preskočia.
 */

'use strict';

const log = require('../logger');

/**
 * Vytvorí notifikáciu o odpovedi na komentár.
 *
 * @param {import('knex').Knex} db
 * @param {{ commentOwnerId: number, actorId: number, actorNickname: string, commentId: number, articleId: number, articleTitle: string }}
 */
async function notifyCommentReply(db, { commentOwnerId, actorId, actorNickname, commentId, articleId, articleTitle }) {
  // Nenotifikuj sám seba
  if (commentOwnerId === actorId) return;

  const title = articleTitle.length > 60 ? articleTitle.slice(0, 60) + '…' : articleTitle;
  const message = `${actorNickname} odpovedal/a na tvoj komentár v článku "${title}"`;

  try {
    await db('notifications').insert({
      user_id: commentOwnerId,
      actor_id: actorId,
      type: 'comment_reply',
      comment_id: commentId,
      article_id: articleId,
      message,
    });
  } catch (err) {
    log.warn('notification insert failed (reply)', { err: err.message, commentOwnerId, actorId });
  }
}

/**
 * Vytvorí notifikáciu o lajknutí komentáru.
 *
 * @param {import('knex').Knex} db
 * @param {{ commentOwnerId: number, actorId: number, actorNickname: string, commentId: number, articleId: number, articleTitle: string }}
 */
async function notifyCommentLike(db, { commentOwnerId, actorId, actorNickname, commentId, articleId, articleTitle }) {
  if (commentOwnerId === actorId) return;

  const title = articleTitle.length > 60 ? articleTitle.slice(0, 60) + '…' : articleTitle;
  const message = `${actorNickname} dal/a like tvojmu komentáru v článku "${title}"`;

  // Deduplikácia — ak rovnaký actor už lajkol ten istý komentár, nenotifikuj znova
  try {
    const existing = await db('notifications')
      .where({ user_id: commentOwnerId, actor_id: actorId, type: 'comment_like', comment_id: commentId })
      .first();
    if (existing) return;

    await db('notifications').insert({
      user_id: commentOwnerId,
      actor_id: actorId,
      type: 'comment_like',
      comment_id: commentId,
      article_id: articleId,
      message,
    });
  } catch (err) {
    log.warn('notification insert failed (like)', { err: err.message, commentOwnerId, actorId });
  }
}

/**
 * Počet neprečítaných notifikácií pre usera.
 */
async function unreadCount(db, userId) {
  const row = await db('notifications')
    .where({ user_id: userId, is_read: false })
    .count({ c: '*' })
    .first();
  return Number(row.c);
}

module.exports = {
  notifyCommentReply,
  notifyCommentLike,
  unreadCount,
};
