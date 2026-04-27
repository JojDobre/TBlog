/**
 * Public auth routes
 *
 *   GET/POST /register   — registrácia readera
 *   GET/POST /login      — verejný login (reader, ale aj admin/editor)
 *   POST     /logout
 *   GET/POST /forgot     — reset cez bezpečnostnú otázku
 *
 * Reader = automatická rola pre samoregistráciu.
 * Admin/editor sa cez /login môže tiež prihlásiť, ale dostane redirect
 * do /admin/dashboard.
 */

'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const log = require('../logger');
const auth = require('../utils/auth');
const config = require('../../../config');
const { loginLimiter } = require('../middleware/rate-limits');

const router = express.Router();

const NICKNAME_MIN = 3;
const NICKNAME_MAX = 64;
const NICKNAME_RE = /^[a-zA-Z0-9_-]+$/;

const RESET_MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Akceptuje len lokálne URL nezačínajúce na /admin alebo auth route. */
function safeNextUrl(value, fallback = '/') {
  if (typeof value !== 'string' || !value) return fallback;
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//')) return fallback; // protocol-relative
  if (value.startsWith('/login') || value.startsWith('/register') ||
      value.startsWith('/logout') || value.startsWith('/forgot')) {
    return fallback;
  }
  return value;
}

function validateNickname(s) {
  if (typeof s !== 'string') return 'Nickname je povinný.';
  const t = s.trim();
  if (t.length < NICKNAME_MIN || t.length > NICKNAME_MAX) {
    return `Nickname musí mať ${NICKNAME_MIN}–${NICKNAME_MAX} znakov.`;
  }
  if (!NICKNAME_RE.test(t)) {
    return 'Nickname môže obsahovať len písmená, čísla, _ a -';
  }
  return null;
}

function validateEmail(s) {
  if (typeof s !== 'string' || !s) return 'Email je povinný.';
  if (s.length > 255) return 'Email je príliš dlhý.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'Neplatný email.';
  return null;
}

async function loadActiveQuestions() {
  return db('security_questions')
    .where('is_active', true)
    .orderBy('id')
    .select('id', 'text');
}

// =============================================================================
// REGISTER
// =============================================================================

router.get('/register', async (req, res, next) => {
  if (req.user) return res.redirect('/');
  try {
    const questions = await loadActiveQuestions();
    res.render('auth/register', {
      title: 'Registrácia',
      error: null,
      values: { nickname: '', email: '', custom_question: '' },
      questions,
      minPasswordLength: auth.MIN_PASSWORD_LENGTH,
    });
  } catch (err) { next(err); }
});

router.post('/register', loginLimiter, async (req, res, next) => {
  try {
    const questions = await loadActiveQuestions();
    const {
      nickname = '', email = '', password = '', password2 = '',
      question_id = '', custom_question = '', answer = '', gdpr = '',
    } = req.body;

    const values = {
      nickname: String(nickname).slice(0, NICKNAME_MAX),
      email: String(email).slice(0, 255),
      custom_question: String(custom_question).slice(0, 255),
    };

    const renderError = (error) =>
      res.status(400).render('auth/register', {
        title: 'Registrácia', error, values, questions,
        minPasswordLength: auth.MIN_PASSWORD_LENGTH,
      });

    // 1. Validácia
    let err = validateNickname(nickname);
    if (err) return renderError(err);

    err = validateEmail(email);
    if (err) return renderError(err);

    err = auth.validatePassword(password);
    if (err) return renderError(err);

    if (password !== password2) {
      return renderError('Heslá sa nezhodujú.');
    }

    if (gdpr !== 'on' && gdpr !== 'true') {
      return renderError('Musíš súhlasiť so spracovaním osobných údajov.');
    }

    // bezp. otázka — buď z predefined, alebo custom
    const qid = question_id ? parseInt(question_id, 10) : null;
    const customQ = custom_question.trim();
    if (!qid && !customQ) {
      return renderError('Vyber bezpečnostnú otázku alebo zadaj vlastnú.');
    }
    if (qid && !questions.find((q) => q.id === qid)) {
      return renderError('Vybraná otázka neexistuje.');
    }
    if (!qid && (customQ.length < 5 || customQ.length > 255)) {
      return renderError('Vlastná otázka musí mať 5–255 znakov.');
    }

    if (typeof answer !== 'string' || answer.trim().length < 3) {
      return renderError('Odpoveď musí mať aspoň 3 znaky.');
    }

    // 2. Unikátnosť
    const trimmedNick = nickname.trim();
    const trimmedEmail = email.trim();
    const [nickTaken, emailTaken] = await Promise.all([
      db('users').where('nickname', trimmedNick).first(),
      db('users').where('email', trimmedEmail).first(),
    ]);
    if (nickTaken) return renderError('Tento nickname je už obsadený.');
    if (emailTaken) return renderError('Tento email je už registrovaný.');

    // 3. Hash
    const passwordHash = await bcrypt.hash(password, config.security.bcryptCost);
    const answerHash = await bcrypt.hash(
      answer.toLowerCase().trim(), config.security.bcryptCost
    );

    // 4. Insert + auto-login v transakcii
    let newUserId;
    await db.transaction(async (trx) => {
      const ins = await trx('users').insert({
        role: 'reader',
        nickname: trimmedNick,
        email: trimmedEmail,
        password_hash: passwordHash,
        gdpr_accepted_at: trx.fn.now(),
      });
      newUserId = Array.isArray(ins) ? ins[0] : ins;

      await trx('user_security_answers').insert({
        user_id: newUserId,
        question_id: qid || null,
        custom_question: qid ? null : customQ,
        answer_hash: answerHash,
      });
    });

    log.info('user registered', { userId: newUserId, nickname: trimmedNick });

    // 5. Auto-login (regenerate session)
    req.session.regenerate((rErr) => {
      if (rErr) return next(rErr);
      req.session.userId = newUserId;
      req.session.save((sErr) => {
        if (sErr) return next(sErr);
        res.redirect('/');
      });
    });
  } catch (e) { next(e); }
});

// =============================================================================
// LOGIN
// =============================================================================

router.get('/login', (req, res) => {
  if (req.user) {
    if (req.user.role === 'admin' || req.user.role === 'editor') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect(safeNextUrl(req.query.next));
  }
  res.render('auth/login', {
    title: 'Prihlásenie',
    error: null,
    info: null,
    nickname: '',
    nextUrl: typeof req.query.next === 'string' ? req.query.next : '',
  });
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const { nickname, password } = req.body;
  const nextUrl = req.body.next;

  try {
    const result = await auth.verifyCredentials(nickname, password);
    await auth.recordLoginAttempt({ identifier: nickname, success: result.ok });

    if (!result.ok) {
      const error = result.reason === 'banned'
        ? 'Tento účet je zablokovaný.'
        : 'Nesprávny nickname alebo heslo.';
      return res.status(401).render('auth/login', {
        title: 'Prihlásenie', error, info: null,
        nickname: typeof nickname === 'string' ? nickname.slice(0, NICKNAME_MAX) : '',
        nextUrl: typeof nextUrl === 'string' ? nextUrl : '',
      });
    }

    req.session.regenerate((rErr) => {
      if (rErr) return next(rErr);
      req.session.userId = result.user.id;

      db('users').where('id', result.user.id)
        .update({ last_login_at: db.fn.now() })
        .catch((e) => log.warn('last_login_at update failed', { err: e.message }));

      log.info('user logged in', {
        userId: result.user.id, nickname: result.user.nickname, role: result.user.role,
      });

      req.session.save((sErr) => {
        if (sErr) return next(sErr);
        // admin/editor → admin dashboard, reader → next alebo /
        if (result.user.role === 'admin' || result.user.role === 'editor') {
          return res.redirect('/admin/dashboard');
        }
        res.redirect(safeNextUrl(nextUrl));
      });
    });
  } catch (e) { next(e); }
});

// =============================================================================
// LOGOUT
// =============================================================================

router.post('/logout', (req, res) => {
  const userId = req.user?.id;
  req.session.destroy((err) => {
    if (err) log.error('logout: session destroy failed', { err: err.message });
    res.clearCookie(config.session.name);
    if (userId) log.info('user logged out', { userId });
    res.redirect('/');
  });
});

// =============================================================================
// FORGOT (reader-only — admin/editor používajú /admin/forgot)
// =============================================================================

function renderForgotIdentify(res, status = 200, error = null) {
  return res.status(status).render('auth/forgot', {
    title: 'Zabudnuté heslo',
    step: 'identify', error, info: null,
    nickname: '', question: null,
    minPasswordLength: auth.MIN_PASSWORD_LENGTH,
  });
}

function renderForgotReset(res, reset, error = null, status = 200) {
  return res.status(status).render('auth/forgot', {
    title: 'Zabudnuté heslo',
    step: 'reset', error, info: null,
    nickname: reset.nickname, question: reset.question,
    minPasswordLength: auth.MIN_PASSWORD_LENGTH,
  });
}

router.get('/forgot', (req, res) => {
  if (req.session) delete req.session.passwordReset;
  renderForgotIdentify(res);
});

router.post('/forgot', loginLimiter, async (req, res, next) => {
  try {
    const reset = req.session.passwordReset;

    // KROK 2 — reset
    if (reset && reset.userId) {
      const { answer, password, password2 } = req.body;

      const pwErr = auth.validatePassword(password);
      if (pwErr) return renderForgotReset(res, reset, pwErr, 400);
      if (password !== password2) return renderForgotReset(res, reset, 'Heslá sa nezhodujú.', 400);
      if (typeof answer !== 'string' || !answer.trim()) {
        return renderForgotReset(res, reset, 'Zadaj odpoveď na otázku.', 400);
      }

      const okAnswer = await auth.verifySecurityAnswer(reset.userId, answer);
      if (!okAnswer) {
        reset.attemptsRemaining = (reset.attemptsRemaining || 0) - 1;
        if (reset.attemptsRemaining <= 0) {
          delete req.session.passwordReset;
          return renderForgotIdentify(res, 401,
            'Príliš veľa nesprávnych odpovedí. Začni odznova.');
        }
        return renderForgotReset(res, reset,
          `Nesprávna odpoveď. Zostávajúce pokusy: ${reset.attemptsRemaining}`, 400);
      }

      await auth.changePassword(reset.userId, password);
      log.info('password reset succeeded', { userId: reset.userId });
      delete req.session.passwordReset;

      return res.render('auth/login', {
        title: 'Prihlásenie',
        info: 'Heslo bolo zmenené. Prihlás sa novým heslom.',
        error: null, nickname: '', nextUrl: '',
      });
    }

    // KROK 1 — nickname → otázka
    const { nickname } = req.body;
    if (typeof nickname !== 'string' || !nickname.trim()) {
      return renderForgotIdentify(res, 400, 'Zadaj svoj nickname.');
    }

    const user = await db('users').where('nickname', nickname.trim()).first();
    // reader-only flow; admin/editor majú vlastný na /admin/forgot
    if (!user || user.is_banned || user.role !== 'reader') {
      return renderForgotIdentify(res, 401, 'Účet sa nedá obnoviť.');
    }

    const question = await auth.getSecurityQuestion(user.id);
    if (!question) {
      return renderForgotIdentify(res, 401,
        'Tento účet nemá nastavenú bezpečnostnú otázku.');
    }

    req.session.passwordReset = {
      userId: user.id, nickname: user.nickname,
      question, attemptsRemaining: RESET_MAX_ATTEMPTS,
    };

    res.render('auth/forgot', {
      title: 'Zabudnuté heslo', step: 'reset',
      error: null, info: null,
      nickname: user.nickname, question,
      minPasswordLength: auth.MIN_PASSWORD_LENGTH,
    });
  } catch (e) { next(e); }
});

module.exports = router;
