/**
 * 003 — Taxonomy
 *
 * Tabuľky: rubrics, categories (hierarchické), tags
 */

exports.up = async function (knex) {
  // ------------------------------------------------------------------ rubrics
  await knex.schema.createTable('rubrics', (t) => {
    t.bigIncrements('id');
    t.string('name', 80).notNullable();
    t.string('slug', 120).notNullable();
    t.text('description').nullable();
    t.integer('display_order').notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.unique('slug', { indexName: 'uq_rubrics_slug' });
  });

  // --------------------------------------------------------------- categories
  await knex.schema.createTable('categories', (t) => {
    t.bigIncrements('id');
    t.string('name', 80).notNullable();
    t.string('slug', 120).notNullable();
    t.bigInteger('parent_id').unsigned().nullable();
    t.string('path', 500).notNullable();
    t.text('description').nullable();
    t.integer('display_order').notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('parent_id').references('id').inTable('categories').onDelete('RESTRICT');
    t.unique('slug', { indexName: 'uq_categories_slug' });
    t.index('parent_id', 'idx_categories_parent');
    t.index('path', 'idx_categories_path');
  });

  // --------------------------------------------------------------------- tags
  await knex.schema.createTable('tags', (t) => {
    t.bigIncrements('id');
    t.string('name', 64).notNullable();
    t.string('slug', 120).notNullable();
    t.specificType('color', 'CHAR(7)').nullable(); // hex `#RRGGBB`
    t.text('description').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.unique('slug', { indexName: 'uq_tags_slug' });
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('categories');
  await knex.schema.dropTableIfExists('rubrics');
};
