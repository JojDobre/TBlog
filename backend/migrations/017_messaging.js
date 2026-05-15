/**
 * 017 — Messaging system
 *
 * Tabuľky: conversations, conversation_participants, messages
 * ALTER:   notifications.type — pridáva 'new_message'
 *
 * Typy konverzácií:
 *   direct    — 1:1 medzi dvoma registrovanými používateľmi
 *   broadcast — systémová správa od admina každému userovi (1 konverzácia per user)
 *   contact   — prepojenie kontaktného formulára na registrovaného usera
 */

exports.up = async function (knex) {
  // --------------------------------------------------------------- conversations
  await knex.schema.createTable('conversations', (t) => {
    t.bigIncrements('id');
    t.enu('type', ['direct', 'broadcast', 'contact'])
      .notNullable()
      .defaultTo('direct');
    t.datetime('last_message_at').nullable();
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    t.datetime('updated_at')
      .notNullable()
      .defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

    t.index('type', 'idx_conversations_type');
    t.index('last_message_at', 'idx_conversations_last_msg');
  });

  // ------------------------------------------------------- conversation_participants
  await knex.schema.createTable('conversation_participants', (t) => {
    t.bigInteger('conversation_id').unsigned().notNullable();
    t.bigInteger('user_id').unsigned().notNullable();
    t.datetime('last_read_at').nullable();
    t.boolean('is_muted').notNullable().defaultTo(false);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    t.primary(['conversation_id', 'user_id']);
    t.foreign('conversation_id').references('id').inTable('conversations').onDelete('CASCADE');
    t.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

    t.index('user_id', 'idx_conv_participants_user');
  });

  // --------------------------------------------------------------- messages
  await knex.schema.createTable('messages', (t) => {
    t.bigIncrements('id');
    t.bigInteger('conversation_id').unsigned().notNullable();
    t.bigInteger('sender_id').unsigned().nullable(); // NULL = systémová správa
    t.text('content').notNullable();
    t.bigInteger('image_media_id').unsigned().nullable();
    t.boolean('is_system').notNullable().defaultTo(false);
    t.datetime('created_at').notNullable().defaultTo(knex.fn.now());

    t.foreign('conversation_id').references('id').inTable('conversations').onDelete('CASCADE');
    t.foreign('sender_id').references('id').inTable('users').onDelete('SET NULL');
    t.foreign('image_media_id').references('id').inTable('media').onDelete('SET NULL');

    t.index(['conversation_id', 'created_at'], 'idx_messages_conv_created');
    t.index('sender_id', 'idx_messages_sender');
  });

  // --------------------------------------------------------------- ALTER notifications
  // MariaDB: zmena ENUM vyžaduje ALTER COLUMN s novým zoznamom hodnôt
  await knex.raw(`
    ALTER TABLE notifications
    MODIFY COLUMN type ENUM('comment_reply', 'comment_like', 'new_message')
    NOT NULL
  `);
};

exports.down = async function (knex) {
  // Najprv zmazať notifikácie typu new_message, inak ALTER ENUM zlyhá
  await knex('notifications').where('type', 'new_message').delete();

  await knex.raw(`
    ALTER TABLE notifications
    MODIFY COLUMN type ENUM('comment_reply', 'comment_like')
    NOT NULL
  `);

  await knex.schema.dropTableIfExists('messages');
  await knex.schema.dropTableIfExists('conversation_participants');
  await knex.schema.dropTableIfExists('conversations');
};
