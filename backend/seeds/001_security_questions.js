/**
 * Seed: security_questions
 *
 * Idempotentný — ak je tabuľka neprázdna, neurobí nič.
 */

exports.seed = async function (knex) {
  const existing = await knex('security_questions').count({ count: '*' }).first();
  if (Number(existing.count) > 0) {
    console.log('  security_questions: už naseedované, preskakujem.');
    return;
  }

  await knex('security_questions').insert([
    { text: 'Aké je meno tvojho prvého domáceho miláčika?', is_active: true },
    { text: 'V akom meste si sa narodil/a?', is_active: true },
    { text: 'Ako sa volala tvoja prvá učiteľka/učiteľ?', is_active: true },
    { text: 'Aké je tvoje obľúbené jedlo?', is_active: true },
    { text: 'Aký bol tvoj prvý mobilný telefón?', is_active: true },
  ]);

  console.log('  security_questions: 5 otázok pridaných.');
};
