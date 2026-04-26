/**
 * 001 — Users and auth
 *
 * Tabuľky: users, security_questions, user_security_answers,
 *          user_social_links, user_bans, login_attempts
 *
 * Pozn.: avatar_media_id sa do users pridáva až v migrácii 004 (media),
 *        kvôli cudziemu kľúču.
 */

exports.up = async function (knex) {
  // -------------------------------------------------------------------- users
  await knex.schema.createTable('users', (t) => {
    t.bigIncrements('id');
    t.enu('role', ['admin', 'editor', 'reader']).notNullable().defaultTo('reader');
    t.string('nickname', 64).notNullable();
    t.string('email', 255).nullable();
    t.string('password_hash', 255).notNullable();
    // avatar_media_id pridáva migrácia 004
    t.text('bio').nullable();
    t.string('location', 120).nullable();
    t.date('birth_date').nullable();
    t.string('custom_field_label', 64).nullable();
    t.string('custom_field_value', 255).nullable();
    t.datetime('gdpr_accepted_at').nullable();
    t.boolean('is_banned').notNullable().defaultTo(false);
    t.datetime('last_login_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.unique('nickname', { indexName: 'uq_users_nickname' });
    t.unique('email', { indexName: 'uq_users_email' });
    t.index('role', 'idx_users_role');
    t.index('is_banned', 'idx_users_is_banned');
  });

  // ---------------------------------------------------- security_questions
  await knex.schema.createTable('security_questions', (t) => {
    t.bigIncrements('id');
    t.string('text', 255).notNullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });

  // ------------------------------------------------ user_security_answers
  await knex.schema.createTable('user_security_answers', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.bigInteger('question_id').unsigned().nullable();
    t.string('custom_question', 255).nullable();
    t.string('answer_hash', 255).notNullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('question_id').references('id').inTable('security_questions').onDelete('RESTRICT');
    t.index('user_id', 'idx_user_security_answers_user');
  });

  // -------------------------------------------------------- user_social_links
  await knex.schema.createTable('user_social_links', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.enu('platform', [
      'instagram',
      'youtube',
      'facebook',
      'website',
      'steam',
      'twitter',
      'tiktok',
      'discord',
      'github',
    ]).notNullable();
    t.string('url', 500).notNullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.index('user_id', 'idx_user_social_links_user');
    t.unique(['user_id', 'platform'], { indexName: 'uq_user_social_links_user_platform' });
  });

  // ---------------------------------------------------------------- user_bans
  await knex.schema.createTable('user_bans', (t) => {
    t.bigIncrements('id');
    t.bigInteger('user_id').unsigned().notNullable();
    t.bigInteger('banned_by').unsigned().nullable();
    t.text('reason').nullable();
    t.datetime('unbanned_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    t.foreign('banned_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // ----------------------------------------------------------- login_attempts
  await knex.schema.createTable('login_attempts', (t) => {
    t.bigIncrements('id');
    t.string('identifier', 255).notNullable();
    t.specificType('ip', 'VARBINARY(16)').nullable();
    t.boolean('success').notNullable();
    t.datetime('attempted_at').notNullable().defaultTo(knex.fn.now());

    t.index(['identifier', 'attempted_at'], 'idx_login_attempts_identifier_time');
    t.index(['ip', 'attempted_at'], 'idx_login_attempts_ip_time');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('login_attempts');
  await knex.schema.dropTableIfExists('user_bans');
  await knex.schema.dropTableIfExists('user_social_links');
  await knex.schema.dropTableIfExists('user_security_answers');
  await knex.schema.dropTableIfExists('security_questions');
  await knex.schema.dropTableIfExists('users');
};
