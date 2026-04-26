/**
 * Seed: banner_positions
 *
 * Definované pozície pre bannery a slidery na webe.
 * Idempotentný.
 */

exports.seed = async function (knex) {
  const existing = await knex('banner_positions').count({ count: '*' }).first();
  if (Number(existing.count) > 0) {
    console.log('  banner_positions: už naseedované, preskakujem.');
    return;
  }

  await knex('banner_positions').insert([
    {
      key: 'home_top',
      label: 'Home — vrch (pod headerom)',
      description: 'Hlavný banner/slider na úvodnej stránke.',
      recommended_size: '1200x300',
    },
    {
      key: 'home_sidebar',
      label: 'Home — bočný panel',
      description: 'Postranný banner na úvodnej stránke.',
      recommended_size: '300x250',
    },
    {
      key: 'home_in_feed',
      label: 'Home — medzi článkami',
      description: 'Banner medzi výpisom článkov na úvodnej stránke.',
      recommended_size: '728x90',
    },
    {
      key: 'article_top',
      label: 'Článok — vrch',
      description: 'Banner nad obsahom článku.',
      recommended_size: '728x90',
    },
    {
      key: 'article_sidebar',
      label: 'Článok — bočný panel',
      description: 'Postranný banner v článku.',
      recommended_size: '300x600',
    },
    {
      key: 'article_bottom',
      label: 'Článok — pod obsahom',
      description: 'Banner pod obsahom článku, pred komentármi.',
      recommended_size: '728x90',
    },
    {
      key: 'category_top',
      label: 'Kategória — vrch',
      description: 'Banner na začiatku stránky kategórie.',
      recommended_size: '728x90',
    },
    {
      key: 'ranking_top',
      label: 'Rebríček — vrch',
      description: 'Banner na stránke rebríčka.',
      recommended_size: '728x90',
    },
    {
      key: 'page_top',
      label: 'Statická stránka — vrch',
      description: 'Banner na statických stránkach (kontakt, o nás...).',
      recommended_size: '728x90',
    },
  ]);

  console.log('  banner_positions: 9 pozícií pridaných.');
};
