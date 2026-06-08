/**
 * 030 — Ranking: icon_group + info_group field types
 *
 * Nové field_type hodnoty: 'icon_group', 'info_group'
 *
 * ranking_criterion_options — predefinované možnosti pre skupinové kritériá
 *   - icon_group: label + icon (media_id SVG)
 *   - info_group: hierarchia title → subtitle s filtrovateľnosťou
 *
 * ranking_item_options — M:N väzba: produkt ↔ vybraná možnosť
 */

exports.up = async function (knex) {
  // 1) Extend field_type ENUM
  await knex.raw(`
    ALTER TABLE ranking_criteria
    MODIFY COLUMN field_type ENUM('score_1_10','decimal','integer','price','date','text','icon_group','info_group') NOT NULL
  `);

  // 2) Criterion options (pre icon_group aj info_group)
  await knex.schema.createTable('ranking_criterion_options', (t) => {
    t.bigIncrements('id');
    t.bigInteger('criterion_id').unsigned().notNullable();
    t.bigInteger('parent_id').unsigned().nullable(); // NULL = top-level (title), inak subtitulok
    t.string('label', 200).notNullable();
    t.text('description').nullable(); // popis pre info_group tooltip
    t.bigInteger('icon_media_id').unsigned().nullable(); // SVG ikona pre icon_group
    t.boolean('is_filterable').notNullable().defaultTo(true);
    t.integer('display_order').unsigned().notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    t.foreign('criterion_id').references('id').inTable('ranking_criteria').onDelete('CASCADE');
    t.foreign('parent_id')
      .references('id')
      .inTable('ranking_criterion_options')
      .onDelete('CASCADE');
    t.foreign('icon_media_id').references('id').inTable('media').onDelete('SET NULL');
    t.index('criterion_id', 'idx_rco_criterion');
    t.index('parent_id', 'idx_rco_parent');
  });

  // 3) Item ↔ Option M:N
  await knex.schema.createTable('ranking_item_options', (t) => {
    t.bigInteger('ranking_item_id').unsigned().notNullable();
    t.bigInteger('option_id').unsigned().notNullable();
    t.string('custom_value', 255).nullable(); // voliteľná hodnota (napr. "12W" pri porte)

    t.primary(['ranking_item_id', 'option_id']);
    t.foreign('ranking_item_id').references('id').inTable('ranking_items').onDelete('CASCADE');
    t.foreign('option_id')
      .references('id')
      .inTable('ranking_criterion_options')
      .onDelete('CASCADE');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ranking_item_options');
  await knex.schema.dropTableIfExists('ranking_criterion_options');

  await knex.raw(`
    ALTER TABLE ranking_criteria
    MODIFY COLUMN field_type ENUM('score_1_10','decimal','integer','price','date','text') NOT NULL
  `);
};
