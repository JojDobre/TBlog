/**
 * 006 — Comments
 *
 * Tabuľky: comments (threaded, dvojúrovňové), comment_likes, comment_reports
 */

exports.up = async function (knex) {
  // ---------------------------------------------------------------- comments
  await knex.schema.createTable('comments', (t) => {
    t.bigIncrements('id');
    t.bigInteger('article_id').unsigned().notNullable();
    t.bigInteger('user_id').unsigned().notNullable();
    t.bigInteger('parent_id').unsigned().nullable();
    t.text('content').notNullable();
    t.boolean('is_deleted_by_admin').notNullable().defaultTo(false);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('parent_id').references('id').inTable('comments').onDelete('CASCADE');

    t.index(
      ['article_id', 'parent_id', 'created_at'],
      'idx_comments_article_parent_created'
    );
    t.index('user_id', 'idx_comments_user');
  });

  // ----------------------------------------------------------- comment_likes
  await knex.schema.createTable('comment_likes', (t) => {
    t.bigInteger('comment_id').unsigned().notNullable();
    t.bigInteger('user_id').unsigned().notNullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    t.primary(['comment_id', 'user_id']);
    t.foreign('comment_id').references('id').inTable('comments').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // ---------------------------------------------------------- comment_reports
  await knex.schema.createTable('comment_reports', (t) => {
    t.bigIncrements('id');
    t.bigInteger('comment_id').unsigned().notNullable();
    t.bigInteger('reporter_id').unsigned().nullable();
    t.string('reason', 500).nullable();
    t.boolean('is_resolved').notNullable().defaultTo(false);
    t.bigInteger('resolved_by').unsigned().nullable();
    t.datetime('resolved_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('comment_id').references('id').inTable('comments').onDelete('CASCADE');
    t.foreign('reporter_id').references('id').inTable('users').onDelete('SET NULL');
    t.foreign('resolved_by').references('id').inTable('users').onDelete('SET NULL');

    t.index(['is_resolved', 'created_at'], 'idx_comment_reports_resolved');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('comment_reports');
  await knex.schema.dropTableIfExists('comment_likes');
  await knex.schema.dropTableIfExists('comments');
};
