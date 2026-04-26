/**
 * knex configuration
 *
 * Načítava connection údaje z config.js (a teda z .env), aby existoval
 * len JEDEN zdroj pravdy. knex CLI (npm run migrate, seed) tento súbor
 * očakáva v rooti projektu.
 */

const config = require('./config');

const baseConnection = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  charset: config.db.charset,
  timezone: config.db.timezone,
};

const baseKnex = {
  client: config.db.client,
  migrations: {
    directory: config.paths.migrations,
    tableName: 'knex_migrations',
    extension: 'js',
  },
  seeds: {
    directory: config.paths.seeds,
    extension: 'js',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

module.exports = {
  development: {
    ...baseKnex,
    connection: baseConnection,
    debug: false, // zapni na true ak chceš vidieť všetky SQL queries
  },

  production: {
    ...baseKnex,
    connection: {
      ...baseConnection,
      ssl: config.db.ssl ? { rejectUnauthorized: false } : undefined,
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  // Test prostredie — používa sa neskôr, keď pridáme automatizované testy
  test: {
    ...baseKnex,
    connection: {
      ...baseConnection,
      database: config.db.database + '_test',
    },
    pool: {
      min: 1,
      max: 5,
    },
  },
};
