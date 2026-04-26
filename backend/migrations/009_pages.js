/**
 * 009 — Static pages (Kontakt, O nás, GDPR, ...)
 *
 * Tabuľky: pages
 *
 * Používa rovnaký formát blokového obsahu ako articles.content.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('pages', (t) => {
    t.bigIncrements('id');
    t.string('slug', 120).notNullable();
    t.string('title', 255).notNullable();
    t.json('content').notNullable();
    t.enu('status', ['draft', 'published']).notNullable().defaultTo('draft');
    t.string('seo_title', 255).nullable();
    t.string('seo_description', 320).nullable();
    t.boolean('show_in_footer').notNullable().defaultTo(false);
    t.boolean('show_in_header').notNullable().defaultTo(false);
    t.integer('display_order').notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.unique('slug', { indexName: 'uq_pages_slug' });
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pages');
};
