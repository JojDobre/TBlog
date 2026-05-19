/**
 * 022 — banner_events: tracking zobrazení a kliknutí
 */

exports.up = async function (knex) {
  await knex.schema.createTable('banner_events', (t) => {
    t.bigIncrements('id');
    t.bigInteger('banner_id').unsigned().notNullable();
    t.enum('event_type', ['view', 'click']).notNullable();
    t.string('page_url', 500).nullable();
    t.string('position_key', 100).nullable();
    t.string('ip_hash', 64).nullable();
    t.string('user_agent', 500).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.foreign('banner_id').references('id').inTable('banners').onDelete('CASCADE');
    t.index(['banner_id', 'event_type']);
    t.index(['banner_id', 'created_at']);
    t.index('created_at');
  });

  // Denná agregácia pre rýchle štatistiky
  await knex.schema.createTable('banner_stats_daily', (t) => {
    t.bigIncrements('id');
    t.bigInteger('banner_id').unsigned().notNullable();
    t.date('day').notNullable();
    t.integer('views').unsigned().defaultTo(0);
    t.integer('clicks').unsigned().defaultTo(0);
    t.integer('unique_views').unsigned().defaultTo(0);
    t.integer('unique_clicks').unsigned().defaultTo(0);

    t.foreign('banner_id').references('id').inTable('banners').onDelete('CASCADE');
    t.unique(['banner_id', 'day']);
    t.index('day');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('banner_stats_daily');
  await knex.schema.dropTableIfExists('banner_events');
};
