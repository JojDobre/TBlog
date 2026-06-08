exports.up = async function (knex) {
  await knex.schema.alterTable('ranking_items', (t) => {
    t.bigInteger('cover_media_id').unsigned().nullable().after('custom_brand');
    t.foreign('cover_media_id').references('id').inTable('media').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('ranking_items', (t) => {
    t.dropForeign('cover_media_id');
    t.dropColumn('cover_media_id');
  });
};
