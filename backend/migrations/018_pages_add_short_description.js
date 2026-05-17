exports.up = async function (knex) {
  await knex.schema.alterTable('pages', (t) => {
    t.string('short_description', 500).nullable().after('title');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('pages', (t) => {
    t.dropColumn('short_description');
  });
};
