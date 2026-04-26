/**
 * 004 — Media library
 *
 * Tabuľky: media
 * Pridáva: avatar_media_id do users (cyklická závislosť users ↔ media)
 *
 * FULLTEXT index sa robí raw SQL — knex nemá natívnu podporu.
 */

exports.up = async function (knex) {
  // -------------------------------------------------------------------- media
  await knex.schema.createTable('media', (t) => {
    t.bigIncrements('id');
    t.enu('type', ['image', 'video', 'youtube']).notNullable();
    t.string('original_path', 500).nullable();
    t.string('thumbnail_path', 500).nullable();
    t.string('youtube_url', 500).nullable();
    t.string('youtube_video_id', 20).nullable();
    t.string('mime', 120).nullable();
    t.bigInteger('size_bytes').unsigned().nullable();
    t.integer('width').nullable();
    t.integer('height').nullable();
    t.integer('duration_seconds').nullable();
    t.string('original_filename', 255).notNullable();
    t.string('alt_text', 255).nullable();
    t.text('caption').nullable();
    t.bigInteger('uploader_id').unsigned().nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('uploader_id').references('id').inTable('users').onDelete('SET NULL');
    t.index('uploader_id', 'idx_media_uploader');
    t.index(['type', 'created_at'], 'idx_media_type_created');
  });

  // FULLTEXT index — raw SQL
  await knex.raw(`
    CREATE FULLTEXT INDEX ft_media_filename_alt
    ON media (original_filename, alt_text, caption)
  `);

  // ---------------------------------- ALTER users — pridať avatar_media_id
  await knex.schema.alterTable('users', (t) => {
    t.bigInteger('avatar_media_id').unsigned().nullable().after('password_hash');
    t.foreign('avatar_media_id').references('id').inTable('media').onDelete('SET NULL');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (t) => {
    t.dropForeign('avatar_media_id');
    t.dropColumn('avatar_media_id');
  });
  await knex.schema.dropTableIfExists('media');
};
