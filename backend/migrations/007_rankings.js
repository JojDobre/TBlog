/**
 * 007 — Rankings
 *
 * Tabuľky: rankings, ranking_criteria, ranking_items, ranking_item_values
 *
 * Cyklická závislosť:
 *   rankings.sort_criterion_id → ranking_criteria.id
 *   ranking_criteria.ranking_id → rankings.id
 *
 * Riešenie: vytvoriť rankings BEZ sort_criterion_id, potom ranking_criteria,
 * potom ALTER rankings + pridať FK.
 */

exports.up = async function (knex) {
  // ----------------------------------------------------------------- rankings
  await knex.schema.createTable('rankings', (t) => {
    t.bigIncrements('id');
    t.string('name', 160).notNullable();
    t.string('slug', 180).notNullable();
    t.text('description').nullable();
    t.bigInteger('cover_media_id').unsigned().nullable();
    t.boolean('admin_override').notNullable().defaultTo(false);
    // sort_criterion_id sa pridáva po vytvorení ranking_criteria nižšie
    t.enu('sort_direction', ['asc', 'desc']).notNullable().defaultTo('desc');
    t.integer('max_age_months').nullable();
    t.enu('status', ['active', 'archived']).notNullable().defaultTo('active');
    t.string('seo_title', 255).nullable();
    t.string('seo_description', 320).nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('cover_media_id').references('id').inTable('media').onDelete('SET NULL');
    t.unique('slug', { indexName: 'uq_rankings_slug' });
    t.index('status', 'idx_rankings_status');
  });

  // --------------------------------------------------------- ranking_criteria
  await knex.schema.createTable('ranking_criteria', (t) => {
    t.bigIncrements('id');
    t.bigInteger('ranking_id').unsigned().notNullable();
    t.string('name', 80).notNullable();
    t.enu('field_type', [
      'score_1_10',
      'decimal',
      'integer',
      'price',
      'date',
      'text',
    ]).notNullable();
    t.string('unit', 20).nullable();
    t.boolean('is_filterable').notNullable().defaultTo(false);
    t.boolean('is_total').notNullable().defaultTo(false);
    t.integer('display_order').notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('ranking_id').references('id').inTable('rankings').onDelete('CASCADE');
    t.index('ranking_id', 'idx_ranking_criteria_ranking');
  });

  // ---------------- ALTER rankings — pridať sort_criterion_id (cyklický FK)
  await knex.schema.alterTable('rankings', (t) => {
    t.bigInteger('sort_criterion_id').unsigned().nullable().after('admin_override');
    t.foreign('sort_criterion_id')
      .references('id')
      .inTable('ranking_criteria')
      .onDelete('SET NULL');
  });

  // ------------------------------------------------------------ ranking_items
  await knex.schema.createTable('ranking_items', (t) => {
    t.bigIncrements('id');
    t.bigInteger('ranking_id').unsigned().notNullable();
    t.bigInteger('article_id').unsigned().notNullable();
    t.integer('manual_position').nullable();
    t.datetime('added_at').notNullable().defaultTo(knex.fn.now());
    t.bigInteger('added_by').unsigned().nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('ranking_id').references('id').inTable('rankings').onDelete('CASCADE');
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('added_by').references('id').inTable('users').onDelete('SET NULL');

    t.unique(['ranking_id', 'article_id'], { indexName: 'uq_ranking_items_ranking_article' });
    t.index('article_id', 'idx_ranking_items_article');
  });

  // ------------------------------------------------------ ranking_item_values
  await knex.schema.createTable('ranking_item_values', (t) => {
    t.bigInteger('ranking_item_id').unsigned().notNullable();
    t.bigInteger('criterion_id').unsigned().notNullable();
    t.decimal('value_decimal', 12, 3).nullable();
    t.string('value_text', 500).nullable();
    t.date('value_date').nullable();

    t.primary(['ranking_item_id', 'criterion_id']);
    t.foreign('ranking_item_id')
      .references('id')
      .inTable('ranking_items')
      .onDelete('CASCADE');
    t.foreign('criterion_id')
      .references('id')
      .inTable('ranking_criteria')
      .onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ranking_item_values');
  await knex.schema.dropTableIfExists('ranking_items');
  await knex.schema.alterTable('rankings', (t) => {
    t.dropForeign('sort_criterion_id');
    t.dropColumn('sort_criterion_id');
  });
  await knex.schema.dropTableIfExists('ranking_criteria');
  await knex.schema.dropTableIfExists('rankings');
};
