/**
 * Article revisions  (Phase 5.3)
 *
 * Pri každom update článku uložíme snapshot starého stavu (title/content/excerpt).
 * Držíme posledných MAX_REVISIONS verzií, staršie sa orežú (FIFO).
 *
 * Volá sa z transakcie pri UPDATE — `trx` je knex transakcia.
 */

'use strict';

const MAX_REVISIONS = 5;

/**
 * Vytvor revíziu zo súčasného stavu článku PRED tým ako ho prepíšeme.
 *
 * @param {Knex.Transaction} trx
 * @param {Object} existing  — pôvodný riadok articles z DB
 * @param {Number} editorId  — req.user.id
 */
async function saveRevision(trx, existing, editorId) {
  if (!existing) return;

  // content môže byť string (raw JSON z DB) alebo objekt (po parse)
  let contentJson;
  if (typeof existing.content === 'string') {
    contentJson = existing.content;
  } else {
    contentJson = JSON.stringify(existing.content || []);
  }

  await trx('article_revisions').insert({
    article_id: existing.id,
    title: existing.title,
    content: contentJson,
    excerpt: existing.excerpt,
    editor_id: editorId || null,
  });

  // FIFO orezanie — drž len posledných MAX_REVISIONS
  const old = await trx('article_revisions')
    .where('article_id', existing.id)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .offset(MAX_REVISIONS)
    .select('id');

  if (old.length > 0) {
    await trx('article_revisions')
      .whereIn('id', old.map((r) => r.id))
      .del();
  }
}

/**
 * Načítaj zoznam revízií pre článok (pre edit page).
 */
async function listRevisions(knex, articleId) {
  const rows = await knex('article_revisions')
    .leftJoin('users', 'article_revisions.editor_id', 'users.id')
    .where('article_revisions.article_id', articleId)
    .select(
      'article_revisions.id',
      'article_revisions.title',
      'article_revisions.created_at',
      'users.nickname as editor_nickname'
    )
    .orderBy('article_revisions.created_at', 'desc')
    .orderBy('article_revisions.id', 'desc')
    .limit(MAX_REVISIONS);
  return rows;
}

module.exports = { MAX_REVISIONS, saveRevision, listRevisions };
