/**
 * Auth utilities — pure funkcie pre overenie hesla, zmenu hesla, atď.
 *
 * Používa bcryptjs (cost 12). Bezpečnostné odpovede sú normalizované
 * (lowercase + trim) pred hashovaním aj pri overovaní.
 */

'use strict';

const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../../../config');

// Pre-vyrobený dummy hash, používa sa pri neexistujúcom usernamoch aby
// timing odpovede pre validný/nevalidný nickname bol porovnateľný.
// (basic timing-attack mitigation)
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.security.bcryptCost);

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

/**
 * Overí nickname + heslo.
 *
 * Návratová hodnota:
 *   { ok: true,  user }                      — úspech
 *   { ok: false, reason: 'invalid' }         — zlý nickname alebo heslo
 *   { ok: false, reason: 'banned',  user }   — heslo OK, ale účet je banovaný
 */
async function verifyCredentials(nickname, password) {
  if (typeof nickname !== 'string' || typeof password !== 'string') {
    // ešte aj tak voláme bcrypt, aby čas bol konštantný
    await bcrypt.compare('x', DUMMY_HASH);
    return { ok: false, reason: 'invalid' };
  }

  const trimmed = nickname.trim();
  if (!trimmed || !password) {
    await bcrypt.compare('x', DUMMY_HASH);
    return { ok: false, reason: 'invalid' };
  }

  const user = await db('users').where('nickname', trimmed).first();

  if (!user) {
    // konzistentné timing — vždy spustíme bcrypt
    await bcrypt.compare(password, DUMMY_HASH);
    return { ok: false, reason: 'invalid' };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { ok: false, reason: 'invalid' };
  }

  if (user.is_banned) {
    return { ok: false, reason: 'banned', user };
  }

  return { ok: true, user };
}

// ---------------------------------------------------------------------------
// Security answer (password reset flow)
// ---------------------------------------------------------------------------

/**
 * Vráti bezpečnostnú otázku usera (text). null ak nemá žiadnu.
 */
async function getSecurityQuestion(userId) {
  const sa = await db('user_security_answers')
    .leftJoin('security_questions', 'user_security_answers.question_id', 'security_questions.id')
    .select(
      'user_security_answers.id',
      'user_security_answers.custom_question',
      'security_questions.text as predefined_text'
    )
    .where('user_security_answers.user_id', userId)
    .first();

  if (!sa) return null;
  return sa.custom_question || sa.predefined_text || null;
}

/**
 * Overí odpoveď na bezpečnostnú otázku.
 * Odpoveď sa pred porovnaním normalizuje (lowercase + trim) — rovnako ako
 * pri ukladaní v setup-admin.js.
 */
async function verifySecurityAnswer(userId, answer) {
  if (typeof answer !== 'string' || !answer.trim()) return false;

  const sa = await db('user_security_answers').where('user_id', userId).first();
  if (!sa) return false;

  return bcrypt.compare(answer.toLowerCase().trim(), sa.answer_hash);
}

// ---------------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------------

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 200;

/**
 * Validuje formát hesla.
 * Vráti null ak je OK, inak text chyby.
 */
function validatePassword(password) {
  if (typeof password !== 'string') return 'Heslo je povinné.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Heslo musí mať aspoň ${MIN_PASSWORD_LENGTH} znakov.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Heslo je príliš dlhé (max ${MAX_PASSWORD_LENGTH} znakov).`;
  }
  return null;
}

/**
 * Zahashuje a uloží nové heslo pre usera.
 */
async function changePassword(userId, newPassword) {
  const hash = await bcrypt.hash(newPassword, config.security.bcryptCost);
  await db('users').where('id', userId).update({
    password_hash: hash,
    updated_at: db.fn.now(),
  });
}

// ---------------------------------------------------------------------------
// Login attempts logging
// ---------------------------------------------------------------------------

/**
 * Zapíše pokus o prihlásenie do login_attempts (best-effort, nikdy nezhoria).
 */
async function recordLoginAttempt({ identifier, success }) {
  try {
    await db('login_attempts').insert({
      identifier: (identifier || '').slice(0, 255),
      ip: null, // VARBINARY(16) — IP do binárnej formy doplníme v Phase 16
      success: !!success,
    });
  } catch (_) {
    // tichá chyba — nemá zmysel rušiť login kvôli auditu
  }
}

module.exports = {
  verifyCredentials,
  getSecurityQuestion,
  verifySecurityAnswer,
  validatePassword,
  changePassword,
  recordLoginAttempt,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
};
