/**
 * Dogeneruje medium varianty (max 1200px WebP q85 — rovnako ako upload pipeline)
 * pre existujúce médiá, ktoré medium_path ešte nemajú.
 *
 * Spustenie:  node backend/scripts/generate-medium-variants.js
 * Idempotentné — preskakuje záznamy s vyplneným medium_path.
 */

'use strict';

const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');

const config = require(path.resolve(__dirname, '..', '..', 'config'));
const knexfile = require(path.resolve(__dirname, '..', '..', 'knexfile'));
const knex = require('knex')(knexfile[config.app.env] || knexfile.development);

const MEDIUM_DIR = path.join(config.paths.uploads, 'medium');
const MEDIUM_WIDTH = 1200;

async function run() {
  await fs.mkdir(MEDIUM_DIR, { recursive: true });

  const rows = await knex('media')
    .where('type', 'image')
    .whereNull('medium_path')
    .whereNotNull('original_path')
    .select('id', 'original_path', 'mime');

  console.log(`Na spracovanie: ${rows.length}`);
  let ok = 0;
  let svg = 0;
  let failed = 0;

  for (const row of rows) {
    // SVG — medium netreba, použije sa originál (rovnako ako pri novom uploade)
    if (row.mime === 'image/svg+xml') {
      await knex('media').where('id', row.id).update({ medium_path: row.original_path });
      svg++;
      continue;
    }

    const srcAbs = path.join(config.paths.uploads, row.original_path);
    const baseName = path.basename(row.original_path, path.extname(row.original_path));
    const mediumRel = 'medium/' + baseName + '.webp';
    const mediumAbs = path.join(MEDIUM_DIR, baseName + '.webp');

    try {
      await sharp(srcAbs)
        .rotate()
        .resize(MEDIUM_WIDTH, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(mediumAbs);

      await knex('media').where('id', row.id).update({ medium_path: mediumRel });
      ok++;
      if (ok % 25 === 0) console.log(`  …${ok} hotových`);
    } catch (err) {
      failed++;
      console.error(`  CHYBA id=${row.id} (${row.original_path}): ${err.message}`);
    }
  }

  console.log(`Hotovo. OK: ${ok}, SVG (originál): ${svg}, chyby: ${failed}`);
  await knex.destroy();
}

run().catch(async (err) => {
  console.error(err);
  await knex.destroy().catch(() => {});
  process.exit(1);
});
