/**
 * 008 — Banners & sliders
 *
 * Tabuľky: banner_positions, banners, banner_placements, sliders, slider_slides
 *
 * Banner = jeden obrázok + odkaz.
 * Slider = viac slidov, každý s textom, tlačidlom, odkazom.
 * Obidve používajú rovnaké pozície (banner_positions).
 */

exports.up = async function (knex) {
  // --------------------------------------------------------- banner_positions
  await knex.schema.createTable('banner_positions', (t) => {
    t.bigIncrements('id');
    t.string('key', 64).notNullable();
    t.string('label', 120).notNullable();
    t.text('description').nullable();
    t.string('recommended_size', 40).nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.unique('key', { indexName: 'uq_banner_positions_key' });
  });

  // ----------------------------------------------------------------- banners
  await knex.schema.createTable('banners', (t) => {
    t.bigIncrements('id');
    t.string('name', 160).notNullable();
    t.bigInteger('image_media_id').unsigned().notNullable();
    t.string('link_url', 500).nullable();
    t.string('alt_text', 255).nullable();
    t.datetime('starts_at').nullable();
    t.datetime('ends_at').nullable();
    t.enu('status', ['active', 'paused']).notNullable().defaultTo('active');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('image_media_id').references('id').inTable('media').onDelete('RESTRICT');
  });

  // -------------------------------------------------------- banner_placements
  await knex.schema.createTable('banner_placements', (t) => {
    t.bigIncrements('id');
    t.bigInteger('banner_id').unsigned().notNullable();
    t.bigInteger('position_id').unsigned().notNullable();
    t.enu('target_type', ['global', 'article', 'category', 'rubric', 'page'])
      .notNullable()
      .defaultTo('global');
    t.bigInteger('target_id').unsigned().nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('banner_id').references('id').inTable('banners').onDelete('CASCADE');
    t.foreign('position_id')
      .references('id')
      .inTable('banner_positions')
      .onDelete('CASCADE');

    t.index(
      ['position_id', 'target_type', 'target_id'],
      'idx_banner_placements_position_target'
    );
    t.index('banner_id', 'idx_banner_placements_banner');
  });

  // ----------------------------------------------------------------- sliders
  await knex.schema.createTable('sliders', (t) => {
    t.bigIncrements('id');
    t.string('name', 160).notNullable();
    t.bigInteger('position_id').unsigned().notNullable();
    t.integer('autoplay_seconds').notNullable().defaultTo(5);
    t.datetime('starts_at').nullable();
    t.datetime('ends_at').nullable();
    t.enu('status', ['active', 'paused']).notNullable().defaultTo('active');
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('position_id')
      .references('id')
      .inTable('banner_positions')
      .onDelete('RESTRICT');
  });

  // ----------------------------------------------------------- slider_slides
  await knex.schema.createTable('slider_slides', (t) => {
    t.bigIncrements('id');
    t.bigInteger('slider_id').unsigned().notNullable();
    t.bigInteger('image_media_id').unsigned().notNullable();
    t.string('title', 255).nullable();
    t.text('text').nullable();
    t.string('button_label', 80).nullable();
    t.string('button_url', 500).nullable();
    t.integer('display_order').notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('slider_id').references('id').inTable('sliders').onDelete('CASCADE');
    t.foreign('image_media_id').references('id').inTable('media').onDelete('RESTRICT');

    t.index(['slider_id', 'display_order'], 'idx_slider_slides_slider_order');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('slider_slides');
  await knex.schema.dropTableIfExists('sliders');
  await knex.schema.dropTableIfExists('banner_placements');
  await knex.schema.dropTableIfExists('banners');
  await knex.schema.dropTableIfExists('banner_positions');
};
