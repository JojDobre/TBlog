/**
 * 015 — Rozšírenie tabuľky banners o 3 typy
 *
 * Nové stĺpce:
 *   type          — 'image' (default), 'template', 'custom'
 *   template_key  — identifikátor šablóny (pre typ template)
 *   template_data — JSON dáta šablóny (titulok, text, CTA, farba...)
 *   custom_code   — vlastné HTML/CSS/JS (pre typ custom)
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('banners', (t) => {
    t.enu('type', ['image', 'template', 'custom']).notNullable().defaultTo('image').after('name');

    t.string('template_key', 80).nullable().after('type');
    t.json('template_data').nullable().after('template_key');
    t.text('custom_code').nullable().after('template_data');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('banners', (t) => {
    t.dropColumn('custom_code');
    t.dropColumn('template_data');
    t.dropColumn('template_key');
    t.dropColumn('type');
  });
};
