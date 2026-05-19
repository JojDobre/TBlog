/**
 * 020 — Nové homepage banner pozície (jedna pre každú sekciu)
 */

exports.up = async function (knex) {
  const positions = [
    { key: 'home_after_hero',         label: 'Home — po hero slideri',       description: 'Banner medzi sliderom a novinkami.',           recommended_size: '1200x200' },
    { key: 'home_after_news',         label: 'Home — po novinkách',          description: 'Banner medzi novinkami a trendmi.',             recommended_size: '1200x200' },
    { key: 'home_after_trending',     label: 'Home — po trendoch',           description: 'Banner medzi trendmi a recenziami.',            recommended_size: '1200x200' },
    { key: 'home_after_reviews',      label: 'Home — po recenziách',         description: 'Banner medzi recenziami a editor\'s pick.',     recommended_size: '1200x200' },
    { key: 'home_after_editors_pick', label: 'Home — po editor\'s pick',     description: 'Banner medzi editor\'s pick a textovým feedom.', recommended_size: '1200x200' },
    { key: 'home_after_textfeed',     label: 'Home — po textovom feede',     description: 'Banner medzi textovým feedom a mini správami.', recommended_size: '1200x200' },
    { key: 'home_after_compact',      label: 'Home — po mini správach',      description: 'Banner medzi mini správami a newsletterom.',    recommended_size: '1200x200' },
  ];

  for (const pos of positions) {
    const exists = await knex('banner_positions').where('key', pos.key).first();
    if (!exists) await knex('banner_positions').insert(pos);
  }
};

exports.down = async function (knex) {
  await knex('banner_positions').whereIn('key', [
    'home_after_hero', 'home_after_news', 'home_after_trending',
    'home_after_reviews', 'home_after_editors_pick', 'home_after_textfeed',
    'home_after_compact',
  ]).del();
};
