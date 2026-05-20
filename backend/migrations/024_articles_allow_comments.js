exports.up = async function (knex) {
  await knex.schema.alterTable('articles', (t) => {
    t.boolean('allow_comments').defaultTo(true).after('is_featured');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('articles', (t) => {
    t.dropColumn('allow_comments');
  });
};
