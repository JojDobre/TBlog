/**
 * 010 — Settings & contact messages
 *
 * Tabuľky: settings (key-value globálne nastavenia), contact_messages
 *
 * Pozn.: Stĺpec sa volá `field_group` (nie `group`), pretože `group` je
 * SQL reserved word a robil by problémy v query.
 */

exports.up = async function (knex) {
  // ---------------------------------------------------------------- settings
  await knex.schema.createTable('settings', (t) => {
    t.string('key', 100).primary();
    t.text('value').nullable();
    t.enu('value_type', ['string', 'int', 'bool', 'json'])
      .notNullable()
      .defaultTo('string');
    t.string('label', 160).notNullable();
    t.string('field_group', 60).notNullable().defaultTo('general');
    t.integer('display_order').notNullable().defaultTo(0);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });

  // -------------------------------------------------------- contact_messages
  await knex.schema.createTable('contact_messages', (t) => {
    t.bigIncrements('id');
    t.string('name', 120).notNullable();
    t.string('email', 255).notNullable();
    t.string('subject', 255).nullable();
    t.text('message').notNullable();
    t.specificType('ip_hash', 'CHAR(64)').nullable();
    t.boolean('is_read').notNullable().defaultTo(false);
    t.datetime('read_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.index(['is_read', 'created_at'], 'idx_contact_messages_read_created');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('contact_messages');
  await knex.schema.dropTableIfExists('settings');
};
