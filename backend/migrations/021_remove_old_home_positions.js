exports.up = async function (knex) {
  const oldKeys = ['home_top', 'home_sidebar', 'home_in_feed'];

  const oldPositions = await knex('banner_positions').whereIn('key', oldKeys).select('id');
  const oldIds = oldPositions.map((p) => p.id);

  if (oldIds.length > 0) {
    await knex('sliders').whereIn('position_id', oldIds).del();
    await knex('banner_placements').whereIn('position_id', oldIds).del();
    await knex('banner_positions').whereIn('id', oldIds).del();
  }
};

exports.down = async function (knex) {
  await knex('banner_positions').insert([
    { key: 'home_top', label: 'Home — vrch (pod headerom)', recommended_size: '1200x300' },
    { key: 'home_sidebar', label: 'Home — bočný panel', recommended_size: '300x250' },
    { key: 'home_in_feed', label: 'Home — medzi článkami', recommended_size: '728x90' },
  ]);
};
