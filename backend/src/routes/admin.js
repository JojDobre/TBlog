/**
 * Admin routes
 *
 * Phase 2.1 — pridaný auth flow:
 *   GET  /admin                  — redirect na /admin/dashboard
 *   GET  /admin/login            — login form
 *   POST /admin/login            — overenie, set session, redirect
 *   POST /admin/logout           — destroy session, redirect na login
 *   GET  /admin/forgot           — password reset (krok 1: nickname)
 *   POST /admin/forgot           — reset (krok 1 alebo 2 podľa session)
 *
 * Po týchto rutoch nasleduje auth gate (requireAuth + requireRole), takže
 * všetko ďalšie (dashboard atď.) vyžaduje prihláseného admina alebo editora.
 */

'use strict';

const express = require('express');
const db = require('../db');
const log = require('../logger');

const auth = require('../utils/auth');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rate-limits');
const config = require('../../../config');

const router = express.Router();

// =============================================================================
// Pomocné funkcie
// =============================================================================

/**
 * Validuje URL pre redirect po prihlásení (ochrana pred open redirect).
 * Akceptuje len lokálne URL začínajúce /admin/.
 */
function safeNextUrl(value, fallback = '/admin/dashboard') {
  if (typeof value !== 'string' || !value) return fallback;
  if (!value.startsWith('/admin/')) return fallback;
  if (value.startsWith('/admin/login') || value.startsWith('/admin/logout')) {
    return fallback;
  }
  return value;
}

// =============================================================================
// LOGIN
// =============================================================================

router.get('/login', (req, res) => {
  // Ak je user už prihlásený a má prístup → rovno do dashboardu
  if (req.user && (req.user.role === 'admin' || req.user.role === 'editor')) {
    return res.redirect(safeNextUrl(req.query.next));
  }

  res.render('admin/auth/login', {
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
      const error =
        result.reason === 'banned'
          ? 'Tento účet je zablokovaný.'
          : 'Nesprávny nickname alebo heslo.';
      return res.status(401).render('admin/auth/login', {
        title: 'Prihlásenie',
        error,
        info: null,
        nickname: typeof nickname === 'string' ? nickname.slice(0, 64) : '',
        nextUrl: typeof nextUrl === 'string' ? nextUrl : '',
      });
    }

    // Len admin alebo editor sa môže prihlásiť do /admin/*
    if (result.user.role !== 'admin' && result.user.role !== 'editor') {
      return res.status(403).render('admin/auth/login', {
        title: 'Prihlásenie',
        error: 'Tento účet nemá prístup do administrácie.',
        info: null,
        nickname: '',
        nextUrl: '',
      });
    }

    // Anti session-fixation — po prihlásení vygeneruj nové sid
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        log.error('session regenerate failed', { err: regenErr.message });
        return next(regenErr);
      }

      req.session.userId = result.user.id;

      // Update last_login_at — best-effort, neblokuje
      db('users')
        .where('id', result.user.id)
        .update({ last_login_at: db.fn.now() })
        .catch((err) =>
          log.warn('last_login_at update failed', { err: err.message })
        );

      log.info('user logged in', {
        userId: result.user.id,
        nickname: result.user.nickname,
        role: result.user.role,
      });

      // Save session before redirect (regenerate je async)
      req.session.save((saveErr) => {
        if (saveErr) {
          log.error('session save failed', { err: saveErr.message });
          return next(saveErr);
        }
        res.redirect(safeNextUrl(nextUrl));
      });
    });
  } catch (err) {
    next(err);
  }
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
    res.redirect('/admin/login');
  });
});

// =============================================================================
// FORGOT PASSWORD (cez bezpečnostnú otázku)
// =============================================================================

const RESET_MAX_ATTEMPTS = 3;

router.get('/forgot', (req, res) => {
  // čistý začiatok — zruš predchádzajúci stav
  if (req.session) delete req.session.passwordReset;

  res.render('admin/auth/forgot', {
    title: 'Zabudnuté heslo',
    step: 'identify',
    error: null,
    info: null,
    nickname: '',
    question: null,
    minPasswordLength: auth.MIN_PASSWORD_LENGTH,
  });
});

router.post('/forgot', loginLimiter, async (req, res, next) => {
  try {
    const reset = req.session.passwordReset;

    // ---------------------------------------------------------- KROK 2: reset
    if (reset && reset.userId) {
      const { answer, password, password2 } = req.body;

      // 2a. validuj heslo
      const pwErr = auth.validatePassword(password);
      if (pwErr) {
        return renderResetStep(res, reset, pwErr);
      }
      if (password !== password2) {
        return renderResetStep(res, reset, 'Heslá sa nezhodujú.');
      }
      if (typeof answer !== 'string' || !answer.trim()) {
        return renderResetStep(res, reset, 'Zadaj odpoveď na otázku.');
      }

      // 2b. over odpoveď
      const okAnswer = await auth.verifySecurityAnswer(reset.userId, answer);
      if (!okAnswer) {
        reset.attemptsRemaining = (reset.attemptsRemaining || 0) - 1;

        if (reset.attemptsRemaining <= 0) {
          delete req.session.passwordReset;
          return res.status(401).render('admin/auth/forgot', {
            title: 'Zabudnuté heslo',
            step: 'identify',
            error: 'Príliš veľa nesprávnych odpovedí. Začni odznova.',
            info: null,
            nickname: '',
            question: null,
            minPasswordLength: auth.MIN_PASSWORD_LENGTH,
          });
        }

        return renderResetStep(
          res,
          reset,
          `Nesprávna odpoveď. Zostávajúce pokusy: ${reset.attemptsRemaining}`
        );
      }

      // 2c. zmena hesla
      await auth.changePassword(reset.userId, password);
      log.info('password reset succeeded', { userId: reset.userId });

      delete req.session.passwordReset;

      return res.render('admin/auth/login', {
        title: 'Prihlásenie',
        info: 'Heslo bolo zmenené. Prihlás sa novým heslom.',
        error: null,
        nickname: '',
        nextUrl: '',
      });
    }

    // ---------------------------------------------- KROK 1: nickname → otázka
    const { nickname } = req.body;
    if (typeof nickname !== 'string' || !nickname.trim()) {
      return res.status(400).render('admin/auth/forgot', {
        title: 'Zabudnuté heslo',
        step: 'identify',
        error: 'Zadaj svoj nickname.',
        info: null,
        nickname: '',
        question: null,
        minPasswordLength: auth.MIN_PASSWORD_LENGTH,
      });
    }

    const user = await db('users').where('nickname', nickname.trim()).first();
    // Nevyzraďujeme či účet existuje — vraciame všeobecnú chybu.
    // Ale zároveň povoľujeme reset len pre admin/editor (readers idú vlastným flow).
    if (
      !user ||
      user.is_banned ||
      (user.role !== 'admin' && user.role !== 'editor')
    ) {
      return res.status(401).render('admin/auth/forgot', {
        title: 'Zabudnuté heslo',
        step: 'identify',
        error: 'Účet sa nedá obnoviť.',
        info: null,
        nickname: '',
        question: null,
        minPasswordLength: auth.MIN_PASSWORD_LENGTH,
      });
    }

    const question = await auth.getSecurityQuestion(user.id);
    if (!question) {
      return res.status(401).render('admin/auth/forgot', {
        title: 'Zabudnuté heslo',
        step: 'identify',
        error: 'Tento účet nemá nastavenú bezpečnostnú otázku.',
        info: null,
        nickname: '',
        question: null,
        minPasswordLength: auth.MIN_PASSWORD_LENGTH,
      });
    }

    req.session.passwordReset = {
      userId: user.id,
      nickname: user.nickname,
      question,
      attemptsRemaining: RESET_MAX_ATTEMPTS,
    };

    res.render('admin/auth/forgot', {
      title: 'Zabudnuté heslo',
      step: 'reset',
      error: null,
      info: null,
      nickname: user.nickname,
      question,
      minPasswordLength: auth.MIN_PASSWORD_LENGTH,
    });
  } catch (err) {
    next(err);
  }
});

function renderResetStep(res, reset, error) {
  return res.status(400).render('admin/auth/forgot', {
    title: 'Zabudnuté heslo',
    step: 'reset',
    error,
    info: null,
    nickname: reset.nickname,
    question: reset.question,
    minPasswordLength: auth.MIN_PASSWORD_LENGTH,
  });
}

// =============================================================================
// AUTH GATE — všetko nižšie vyžaduje prihláseného admina alebo editora
// =============================================================================

router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

// /admin → /admin/dashboard
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard');
});

// =============================================================================
// DASHBOARD
// =============================================================================

router.get('/dashboard', async (req, res, next) => {
  try {
    const [articles, comments, media, visits24h] = await Promise.all([
      db('articles').count({ c: '*' }).first().then((r) => Number(r.c)),
      db('comments').count({ c: '*' }).first().then((r) => Number(r.c)),
      db('media').count({ c: '*' }).first().then((r) => Number(r.c)),
      db('page_visits')
        .where('viewed_at', '>=', db.raw('NOW() - INTERVAL 1 DAY'))
        .count({ c: '*' })
        .first()
        .then((r) => Number(r.c)),
    ]);

    res.render('admin/dashboard/index', {
      title: 'Dashboard',
      stats: { articles, comments, media, visits24h },
    });
  } catch (err) {
    log.error('admin/dashboard query failed', { err: err.message });
    next(err);
  }
});

// =============================================================================
// 404 fallback (admin sub-router)
// =============================================================================

router.use((req, res) => {
  res.status(404).render('admin/errors/404', {
    title: 'Stránka nenájdená',
    url: req.originalUrl,
  });
});

module.exports = router;
