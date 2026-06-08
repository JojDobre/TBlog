exports.up = async function (knex) {
  await knex.schema.alterTable('ranking_criteria', (t) => {
    t.dropColumn('color_from_total');
    t.bigInteger('color_ref_criterion_id').unsigned().nullable()
      .comment('ID iného kritéria, ktorého hodnota sa použije ako 100% základ pre farebné kódovanie');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('ranking_criteria', (t) => {
    t.dropColumn('color_ref_criterion_id');
    t.decimal('color_from_total', 12, 3).nullable();
  });
};
