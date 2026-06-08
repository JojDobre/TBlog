exports.up = async function (knex) {
  await knex.schema.alterTable('rankings', (t) => {
    t.text('methodology').nullable().comment('Metodika testovania / hodnotenia');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('rankings', (t) => {
    t.dropColumn('methodology');
  });
};
