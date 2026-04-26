/**
 * Seed: settings
 *
 * Globálne nastavenia webu, ktoré bude admin meniť cez UI.
 * Hodnoty sa ukladajú ako TEXT a parsujú podľa value_type pri čítaní.
 *
 * Idempotentný.
 */

exports.seed = async function (knex) {
  const existing = await knex('settings').count({ count: '*' }).first();
  if (Number(existing.count) > 0) {
    console.log('  settings: už naseedované, preskakujem.');
    return;
  }

  await knex('settings').insert([
    {
      key: 'site_title',
      value: 'Bytezone',
      value_type: 'string',
      label: 'Názov webu',
      field_group: 'general',
      display_order: 10,
    },
    {
      key: 'site_description',
      value: 'Tech blog so zameraním na recenzie technológií.',
      value_type: 'string',
      label: 'Popis webu (meta description)',
      field_group: 'general',
      display_order: 20,
    },
    {
      key: 'site_logo_media_id',
      value: null,
      value_type: 'int',
      label: 'Logo (ID média)',
      field_group: 'general',
      display_order: 30,
    },
    {
      key: 'site_favicon_media_id',
      value: null,
      value_type: 'int',
      label: 'Favicon (ID média)',
      field_group: 'general',
      display_order: 40,
    },
    {
      key: 'articles_per_page',
      value: '12',
      value_type: 'int',
      label: 'Článkov na stránku (listing)',
      field_group: 'pagination',
      display_order: 10,
    },
    {
      key: 'comments_per_page',
      value: '20',
      value_type: 'int',
      label: 'Komentárov na stránku',
      field_group: 'pagination',
      display_order: 20,
    },
    {
      key: 'auto_related_count',
      value: '4',
      value_type: 'int',
      label: 'Počet automatických súvisiacich článkov',
      field_group: 'articles',
      display_order: 10,
    },
    {
      key: 'og_default_image_media_id',
      value: null,
      value_type: 'int',
      label: 'Predvolený OG obrázok pre zdieľanie',
      field_group: 'seo',
      display_order: 10,
    },
    {
      key: 'analytics_html',
      value: '',
      value_type: 'string',
      label: 'Google Analytics / iný tracking HTML',
      field_group: 'seo',
      display_order: 20,
    },
    {
      key: 'theme_default',
      value: 'auto',
      value_type: 'string',
      label: 'Predvolená téma (light / dark / auto)',
      field_group: 'appearance',
      display_order: 10,
    },
  ]);

  console.log('  settings: 10 nastavení pridaných.');
};
