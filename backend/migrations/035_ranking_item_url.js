exports.up = async function (knex) {
  await knex.schema.alterTable('ranking_items', (t) => {
    t.string('custom_url', 500).nullable().after('cover_media_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('ranking_items', (t) => {
    t.dropColumn('custom_url');
  });
};
