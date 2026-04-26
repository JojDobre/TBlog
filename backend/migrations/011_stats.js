/**
 * 011 — Stats / page visits
 *
 * Tabuľky:
 *   page_visits        — raw log návštev (retencia 90 dní)
 *   page_visits_daily  — denná agregácia (trvalé)
 *
 * IP nikdy neukladáme — len SHA-256 hash s denne rotovaným saltom.
 * Tracking middleware sa zapína vo Fáze 1.3, takže dáta začnú pribúdať
 * od prvého spustenia servera.
 */

exports.up = async function (knex) {
  // -------------------------------------------------------------- page_visits
  await knex.schema.createTable('page_visits', (t) => {
    t.bigIncrements('id');
    t.string('path', 500).notNullable();
    t.bigInteger('article_id').unsigned().nullable();
    t.bigInteger('page_id').unsigned().nullable();
    t.bigInteger('user_id').unsigned().nullable();
    t.specificType('ip_hash', 'CHAR(64)').notNullable();
    t.string('referer', 500).nullable();
    t.string('user_agent_short', 120).nullable();
    t.datetime('viewed_at').notNullable().defaultTo(knex.fn.now());

    t.foreign('article_id').references('id').inTable('articles').onDelete('SET NULL');
    t.foreign('page_id').references('id').inTable('pages').onDelete('SET NULL');
    t.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');

    t.index('viewed_at', 'idx_page_visits_viewed');
    t.index(['article_id', 'viewed_at'], 'idx_page_visits_article_viewed');
    t.index(['page_id', 'viewed_at'], 'idx_page_visits_page_viewed');
  });

  // ------------------------------------------------------- page_visits_daily
  await knex.schema.createTable('page_visits_daily', (t) => {
    t.bigIncrements('id');
    t.date('date').notNullable();
    t.string('path', 191).notNullable(); // 191 = bezpečné pre utf8mb4 unique index
    t.bigInteger('article_id').unsigned().nullable();
    t.bigInteger('page_id').unsigned().nullable();
    t.integer('views').unsigned().notNullable();
    t.integer('unique_visitors').unsigned().notNullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('article_id').references('id').inTable('articles').onDelete('SET NULL');
    t.foreign('page_id').references('id').inTable('pages').onDelete('SET NULL');

    t.unique(['date', 'path'], { indexName: 'uq_page_visits_daily_date_path' });
    t.index(['article_id', 'date'], 'idx_page_visits_daily_article_date');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('page_visits_daily');
  await knex.schema.dropTableIfExists('page_visits');
};
