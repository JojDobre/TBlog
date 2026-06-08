exports.up = async function (knex) {
  await knex.schema.alterTable('ranking_criteria', (t) => {
    t.decimal('color_max', 12, 3).nullable().comment('Max hodnota pre 100% (zelená)');
    t.decimal('color_from_total', 12, 3).nullable().comment('Celková hodnota z ktorej sa počíta %');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('ranking_criteria', (t) => {
    t.dropColumn('color_max');
    t.dropColumn('color_from_total');
  });
};
