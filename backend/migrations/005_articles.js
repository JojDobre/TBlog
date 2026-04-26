/**
 * 005 — Articles
 *
 * Tabuľky: articles, article_revisions, article_categories,
 *          article_rubrics, article_tags, article_related
 *
 * Recenzie sú typ článku (type='review'), zdieľajú celú túto schému.
 */

exports.up = async function (knex) {
  // ---------------------------------------------------------------- articles
  await knex.schema.createTable('articles', (t) => {
    t.bigIncrements('id');
    t.enu('type', ['article', 'review']).notNullable().defaultTo('article');
    t.string('title', 255).notNullable();
    t.string('slug', 255).notNullable();
    t.text('excerpt').nullable();
    t.bigInteger('cover_media_id').unsigned().nullable();
    t.bigInteger('author_id').unsigned().notNullable();
    t.enu('status', ['draft', 'scheduled', 'published', 'archived', 'trash'])
      .notNullable()
      .defaultTo('draft');
    t.datetime('published_at').nullable();
    t.datetime('scheduled_at').nullable();
    t.datetime('deleted_at').nullable();
    t.boolean('is_featured').notNullable().defaultTo(false);
    t.json('content').notNullable();
    t.specificType('search_text', 'MEDIUMTEXT').notNullable();
    t.integer('view_count').unsigned().notNullable().defaultTo(0);
    t.enu('default_related_strategy', ['manual', 'auto', 'both'])
      .notNullable()
      .defaultTo('both');
    t.string('seo_title', 255).nullable();
    t.string('seo_description', 320).nullable();
    t.bigInteger('og_image_media_id').unsigned().nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('cover_media_id').references('id').inTable('media').onDelete('SET NULL');
    t.foreign('author_id').references('id').inTable('users').onDelete('RESTRICT');
    t.foreign('og_image_media_id').references('id').inTable('media').onDelete('SET NULL');

    t.unique('slug', { indexName: 'uq_articles_slug' });
    t.index(['status', 'published_at'], 'idx_articles_status_published');
    t.index(['type', 'status', 'published_at'], 'idx_articles_type_status_published');
    t.index('author_id', 'idx_articles_author');
    t.index(['is_featured', 'published_at'], 'idx_articles_featured');
    t.index('deleted_at', 'idx_articles_deleted');
  });

  // FULLTEXT index — raw SQL
  await knex.raw(`
    CREATE FULLTEXT INDEX ft_articles_search ON articles (title, search_text)
  `);

  // ------------------------------------------------------- article_revisions
  await knex.schema.createTable('article_revisions', (t) => {
    t.bigIncrements('id');
    t.bigInteger('article_id').unsigned().notNullable();
    t.string('title', 255).notNullable();
    t.json('content').notNullable();
    t.text('excerpt').nullable();
    t.bigInteger('editor_id').unsigned().nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('editor_id').references('id').inTable('users').onDelete('SET NULL');
    t.index(['article_id', 'created_at'], 'idx_article_revisions_article_created');
  });

  // ------------------------------------------------- article_categories (M:N)
  await knex.schema.createTable('article_categories', (t) => {
    t.bigInteger('article_id').unsigned().notNullable();
    t.bigInteger('category_id').unsigned().notNullable();
    t.boolean('is_primary').notNullable().defaultTo(false);

    t.primary(['article_id', 'category_id']);
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('category_id').references('id').inTable('categories').onDelete('CASCADE');
  });

  // ---------------------------------------------------- article_rubrics (M:N)
  await knex.schema.createTable('article_rubrics', (t) => {
    t.bigInteger('article_id').unsigned().notNullable();
    t.bigInteger('rubric_id').unsigned().notNullable();

    t.primary(['article_id', 'rubric_id']);
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('rubric_id').references('id').inTable('rubrics').onDelete('CASCADE');
  });

  // ------------------------------------------------------- article_tags (M:N)
  await knex.schema.createTable('article_tags', (t) => {
    t.bigInteger('article_id').unsigned().notNullable();
    t.bigInteger('tag_id').unsigned().notNullable();

    t.primary(['article_id', 'tag_id']);
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('tag_id').references('id').inTable('tags').onDelete('CASCADE');
  });

  // ---------------------------------------- article_related (manual relations)
  await knex.schema.createTable('article_related', (t) => {
    t.bigInteger('article_id').unsigned().notNullable();
    t.bigInteger('related_article_id').unsigned().notNullable();
    t.integer('display_order').notNullable().defaultTo(0);

    t.primary(['article_id', 'related_article_id']);
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('related_article_id').references('id').inTable('articles').onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('article_related');
  await knex.schema.dropTableIfExists('article_tags');
  await knex.schema.dropTableIfExists('article_rubrics');
  await knex.schema.dropTableIfExists('article_categories');
  await knex.schema.dropTableIfExists('article_revisions');
  await knex.schema.dropTableIfExists('articles');
};
