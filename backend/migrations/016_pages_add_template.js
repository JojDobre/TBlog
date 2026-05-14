/**
 * 015 — Pages: add template column
 *
 * Pridáva stĺpec `template` do tabuľky `pages`.
 * Šablóna určuje predvolené sekcie pri vytváraní stránky
 * a frontend rendering šablónu.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('pages', (t) => {
    t.enu('template', ['default', 'about', 'contact', 'legal'])
      .notNullable()
      .defaultTo('default')
      .after('title');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('pages', (t) => {
    t.dropColumn('template');
  });
};
