/**
 * 012 — Media usages
 *
 * Tabuľka: media_usages
 *
 * Index, kde sa každé médium používa (článok, stránka, avatar, banner, slide).
 * Udržiava aplikácia automaticky — pri save článku sa zoznam použitých médií
 * synchronizuje s týmto tabuľkou.
 *
 * Mazanie média je blokované, kým existujú riadky tu (resp. admin musí
 * potvrdiť „force delete").
 *
 * Ide ako posledná, lebo odkazuje na všetky ostatné tabuľky.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('media_usages', (t) => {
    t.bigIncrements('id');
    t.bigInteger('media_id').unsigned().notNullable();
    t.enu('usage_type', [
      'article_cover',
      'article_block',
      'page_block',
      'user_avatar',
      'banner',
      'slider',
      'og_image',
    ]).notNullable();
    t.bigInteger('article_id').unsigned().nullable();
    t.bigInteger('page_id').unsigned().nullable();
    t.bigInteger('user_id').unsigned().nullable();
    t.bigInteger('banner_id').unsigned().nullable();
    t.bigInteger('slide_id').unsigned().nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('media_id').references('id').inTable('media').onDelete('CASCADE');
    t.foreign('article_id').references('id').inTable('articles').onDelete('CASCADE');
    t.foreign('page_id').references('id').inTable('pages').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('banner_id').references('id').inTable('banners').onDelete('CASCADE');
    t.foreign('slide_id').references('id').inTable('slider_slides').onDelete('CASCADE');

    t.index('media_id', 'idx_media_usages_media');
    t.index('article_id', 'idx_media_usages_article');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('media_usages');
};
