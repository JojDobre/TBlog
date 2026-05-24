/**
 * 025 — user_bookmarks: uložené články pre prihlásených
 */

exports.up = async function (knex) {
  await knex.schema.createTable('user_bookmarks', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.bigInteger('article_id').unsigned().notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.unique(['user_id', 'article_id']);
    t.index('user_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_bookmarks');
};
