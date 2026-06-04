/**
 * 027_media_medium_path.js — Pridáva medium_path stĺpec pre kvalitnejšie obrázky
 */
exports.up = async function (knex) {
  const has = await knex.schema.hasColumn('media', 'medium_path');
  if (!has) {
    await knex.schema.alterTable('media', (t) => {
      t.string('medium_path', 255).nullable().after('thumbnail_path');
    });
  }
};

exports.down = async function (knex) {
  const has = await knex.schema.hasColumn('media', 'medium_path');
  if (has) {
    await knex.schema.alterTable('media', (t) => {
      t.dropColumn('medium_path');
    });
  }
};
