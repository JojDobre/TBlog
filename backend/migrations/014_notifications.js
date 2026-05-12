/**
 * 014 — Notifications
 *
 * Tabuľka: notifications
 * Typy: comment_reply, comment_like
 */

exports.up = async function (knex) {
  await knex.schema.createTable('notifications', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.bigInteger('actor_id').unsigned().nullable();
    t.enu('type', ['comment_reply', 'comment_like']).notNullable();
    t.bigInteger('comment_id').unsigned().nullable();
    t.bigInteger('article_id').unsigned().nullable();
    t.string('message', 500).notNullable();
    t.boolean('is_read').notNullable().defaultTo(false);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('actor_id').references('id').inTable('users').onDelete('SET NULL');
    t.foreign('comment_id').references('id').inTable('comments').onDelete('CASCADE');
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');

    t.index(['user_id', 'is_read', 'created_at'], 'idx_notifications_user_read');
    t.index(['user_id', 'created_at'], 'idx_notifications_user_created');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('notifications');
};
