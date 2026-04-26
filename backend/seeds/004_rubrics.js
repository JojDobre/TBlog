/**
 * Seed: rubrics
 *
 * Veľké sekcie webu. Admin ich môže neskôr upravovať alebo pridávať.
 * Idempotentný.
 */

exports.seed = async function (knex) {
  const existing = await knex('rubrics').count({ count: '*' }).first();
  if (Number(existing.count) > 0) {
    console.log('  rubrics: už naseedované, preskakujem.');
    return;
  }

  await knex('rubrics').insert([
    {
      name: 'Recenzie',
      slug: 'recenzie',
      description: 'Recenzie produktov a služieb.',
      display_order: 10,
    },
    {
      name: 'Návody',
      slug: 'navody',
      description: 'Praktické návody a tutoriály.',
      display_order: 20,
    },
    {
      name: 'Aktuality',
      slug: 'aktuality',
      description: 'Najnovšie technologické správy.',
      display_order: 30,
    },
    {
      name: 'Rebríčky',
      slug: 'rebricky',
      description: 'Porovnávacie rebríčky produktov.',
      display_order: 40,
    },
  ]);

  console.log('  rubrics: 4 rubriky pridané.');
};
