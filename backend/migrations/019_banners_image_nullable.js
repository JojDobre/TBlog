/**
 * 019 — banners: image_media_id → nullable
 *
 * Template a custom bannery nepotrebujú povinný obrázok.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('banners', (t) => {
    t.dropForeign('image_media_id');
  });
  await knex.schema.alterTable('banners', (t) => {
    t.bigInteger('image_media_id').unsigned().nullable().alter();
    t.foreign('image_media_id').references('id').inTable('media').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('banners', (t) => {
    t.dropForeign('image_media_id');
  });
  await knex.schema.alterTable('banners', (t) => {
    t.bigInteger('image_media_id').unsigned().notNullable().alter();
    t.foreign('image_media_id').references('id').inTable('media').onDelete('RESTRICT');
  });
};
