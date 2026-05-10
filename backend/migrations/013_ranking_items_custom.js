/**
 * 012 — Ranking items: custom products (bez článku)
 *
 * Zmeny:
 *   ranking_items.article_id   → nullable (produkt nemusí mať recenziu)
 *   ranking_items.custom_name  → nový stĺpec (názov produktu bez článku)
 *   ranking_items.custom_brand → nový stĺpec (značka)
 *   ranking_items.override_score → ručné celkové skóre (ak NULL → priemer)
 *
 * Unique constraint sa mení: (ranking_id, article_id) → iba ak article_id IS NOT NULL.
 * MariaDB 10.11 rešpektuje unique index s nullable stĺpcami (NULL ≠ NULL).
 */

exports.up = async function (knex) {
  // 1) create standalone indexes so foreign keys don't depend on the composite unique index
  await knex.raw(`
    ALTER TABLE ranking_items
    ADD INDEX idx_ranking_items_ranking_id (ranking_id)
  `).catch(() => {});

  await knex.raw(`
    ALTER TABLE ranking_items
    ADD INDEX idx_ranking_items_article_id (article_id)
  `).catch(() => {});

  // 2) now composite unique can be dropped
  await knex.raw(`
    ALTER TABLE ranking_items
    DROP INDEX uq_ranking_items_ranking_article
  `);

  // 3) make article_id nullable
  await knex.raw(`
    ALTER TABLE ranking_items
    MODIFY article_id BIGINT UNSIGNED NULL
  `);

  // 4) add custom columns
  await knex.schema.alterTable('ranking_items', (t) => {
    t.string('custom_name', 200).nullable();
    t.string('custom_brand', 100).nullable();
    t.decimal('override_score', 4, 2).nullable();
  });

  // 5) add FK to article_id only if it does not exist yet
  await knex.raw(`
    ALTER TABLE ranking_items
    ADD CONSTRAINT ranking_items_article_id_foreign
    FOREIGN KEY (article_id) REFERENCES articles(id)
    ON DELETE CASCADE
  `).catch(() => {});

  // 6) recreate unique index
  await knex.raw(`
    ALTER TABLE ranking_items
    ADD UNIQUE INDEX uq_ranking_items_ranking_article (ranking_id, article_id)
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    ALTER TABLE ranking_items
    DROP FOREIGN KEY ranking_items_article_id_foreign
  `).catch(() => {});

  await knex.raw(`
    ALTER TABLE ranking_items
    DROP INDEX uq_ranking_items_ranking_article
  `).catch(() => {});

  await knex.schema.alterTable('ranking_items', (t) => {
    t.dropColumn('custom_name');
    t.dropColumn('custom_brand');
    t.dropColumn('override_score');
  });

  await knex.raw(`
    ALTER TABLE ranking_items
    MODIFY article_id BIGINT UNSIGNED NOT NULL
  `);

  await knex.raw(`
    ALTER TABLE ranking_items
    ADD UNIQUE INDEX uq_ranking_items_ranking_article (ranking_id, article_id)
  `);

  // optional cleanup of standalone indexes
  await knex.raw(`
    ALTER TABLE ranking_items
    DROP INDEX idx_ranking_items_ranking_id
  `).catch(() => {});

  await knex.raw(`
    ALTER TABLE ranking_items
    DROP INDEX idx_ranking_items_article_id
  `).catch(() => {});
};
