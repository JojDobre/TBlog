/**
 * 002 — Sessions
 *
 * Tabuľku spravuje connect-session-knex. Používa default formát:
 *   sid VARCHAR PK | sess JSON | expired DATETIME
 *
 * user_id, ip a user_agent idú do JSON `sess` blobu (stačí na všetko,
 * čo dnes potrebujeme; ak neskôr budeme chcieť explicitné stĺpce pre
 * "logout from all devices", spravíme samostatnú migráciu).
 */

exports.up = async function (knex) {
  await knex.schema.createTable('sessions', (t) => {
    t.string('sid', 255).primary();
    t.json('sess').notNullable();
    t.datetime('expired').notNullable();

    t.index('expired', 'idx_sessions_expired');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('sessions');
};
