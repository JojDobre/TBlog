/**
 * 023 — newsletter_subscribers
 */

exports.up = async function (knex) {
  await knex.schema.createTable('newsletter_subscribers', (t) => {
    t.bigIncrements('id');
    t.string('email', 255).notNullable();
    t.string('unsubscribe_token', 64).notNullable();
    t.boolean('is_active').defaultTo(true);
    t.string('source', 100).nullable(); // 'homepage', 'banner', 'footer'
    t.timestamp('subscribed_at').defaultTo(knex.fn.now());
    t.timestamp('unsubscribed_at').nullable();

    t.unique('email');
    t.index('unsubscribe_token');
    t.index('is_active');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('newsletter_subscribers');
};
