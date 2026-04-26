/**
 * Session middleware
 *
 * Sessions sú uložené v MariaDB (tabuľka `sessions`, vytvorená v migrácii
 * 002). connect-session-knex sa stará o čistenie expirovaných sessionov
 * (interval = 1 hodina), takže nepotrebujeme samostatný cron.
 *
 * Cookie:
 *   httpOnly: true       (JS sa k cookie nedostane)
 *   sameSite: 'lax'      (CSRF baseline)
 *   secure: prod         (HTTPS only v produkcii)
 *   maxAge: 14 dní
 */

'use strict';

const session = require('express-session');
const { ConnectSessionKnexStore } = require('connect-session-knex');

const db = require('../db');
const config = require('../../../config');

module.exports = function buildSession() {
  const store = new ConnectSessionKnexStore({
    knex: db,
    tableName: 'sessions',
    sidFieldName: 'sid',
    createTable: false, // tabuľka existuje cez migráciu 002
    cleanupInterval: 60 * 60 * 1000, // 1h
  });

  return session({
    store,
    name: config.session.name,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false, // anonymný používateľ nedostane session zatiaľ
    rolling: true, // každým requestom predĺži platnosť
    cookie: {
      httpOnly: config.session.httpOnly,
      secure: config.session.secure,
      sameSite: config.session.sameSite,
      maxAge: config.session.cookieMaxAgeMs,
    },
  });
};
