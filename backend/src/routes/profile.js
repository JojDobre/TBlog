/**
 * Profile routes
 *   GET  /profil           — vlastný profil (edit form, 3 sekcie)
 *   POST /profil           — uloženie profile údajov + social links
 *   POST /profil/password  — zmena hesla
 *   POST /profil/security  — zmena bezpečnostnej otázky
 *   GET  /u/:nickname      — verejný profil
 *
 * Avatar zatiaľ placeholder (iniciály) — implementuje sa v Phase 3
 * keď bude media library hotová.
 */

'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');

const db = require('../db');
const log = require('../logger');
const auth = require('../utils/auth');
const config = require('../../../config');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const PLATFORMS = [
  'instagram', 'youtube', 'facebook', 'website', 'steam',
  'twitter', 'tiktok', 'discord', 'github',
];
const PLATFORM_LABELS = {
  instagram: 'Instagram', youtube: 'YouTube', facebook: 'Facebook',
  website: 'Webstránka', steam: 'Steam', twitter: 'Twitter / X',
  tiktok: 'TikTok', discord: 'Discord', github: 'GitHub',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isHttpUrl(s) {
  if (typeof s !== 'string') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

async function loadEditCtx(userId) {
  const [user, links, secQ, questions] = await Promise.all([
    db('users').where('id', userId).first(),
    db('user_social_links').where('user_id', userId),
    auth.getSecurityQuestion(userId),
    db('security_questions').where('is_active', true).orderBy('id'),
  ]);
  const linkMap = Object.fromEntries(
    PLATFORMS.map((p) => [p, (links.find((l) => l.platform === p) || {}).url || ''])
  );
  return { user, linkMap, securityQuestion: secQ, questions };
}

function renderEdit(res, ctx, opts = {}) {
  const status = opts.status || 200;
  return res.status(status).render('profile/edit', {
    title: 'Môj profil',
    profile: opts.profile || ctx.user,
    links: opts.links || ctx.linkMap,
    securityQuestion: ctx.securityQuestion,
    questions: ctx.questions,
    platforms: PLATFORMS,
    platformLabels: PLATFORM_LABELS,
    minPasswordLength: auth.MIN_PASSWORD_LENGTH,
    success: opts.success || null,
    error: opts.error || null,
    section: opts.section || 'profile',
  });
}

// ---------------------------------------------------------------------------
// GET /profil
// ---------------------------------------------------------------------------

router.get('/profil', requireAuth({ redirectTo: '/login' }), async (req, res, next) => {
  try {
    const ctx = await loadEditCtx(req.user.id);
    const success =
      req.query.saved ? 'Profil bol uložený.' :
      req.query.password ? 'Heslo bolo zmenené.' :
      req.query.security ? 'Bezpečnostná otázka bola zmenená.' : null;
    renderEdit(res, ctx, { success, section: req.query.section || 'profile' });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /profil — uloženie údajov + social links
// ---------------------------------------------------------------------------

router.post('/profil', requireAuth({ redirectTo: '/login' }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      bio = '', location = '', birth_date = '',
      custom_field_label = '', custom_field_value = '',
    } = req.body;

    const errors = [];

    const bioStr = String(bio);
    if (bioStr.length > 1000) errors.push('Bio je príliš dlhé (max 1000 znakov).');

    const locStr = String(location);
    if (locStr.length > 120) errors.push('Lokalita je príliš dlhá.');

    let bDate = null;
    const bdStr = String(birth_date).trim();
    if (bdStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bdStr)) {
        errors.push('Dátum narodenia musí byť vo formáte YYYY-MM-DD.');
      } else {
        const d = new Date(bdStr + 'T00:00:00Z');
        if (isNaN(d.getTime())) errors.push('Neplatný dátum narodenia.');
        else if (d > new Date()) errors.push('Dátum narodenia nemôže byť v budúcnosti.');
        else bDate = bdStr;
      }
    }

    const cfLabel = String(custom_field_label).trim().slice(0, 64);
    const cfValue = String(custom_field_value).trim().slice(0, 255);
    if ((cfLabel && !cfValue) || (!cfLabel && cfValue)) {
      errors.push('Vlastné pole vyžaduje názov aj hodnotu, alebo nechaj obe prázdne.');
    }

    // social links
    const inputLinks = {};
    const newLinks = {};
    for (const p of PLATFORMS) {
      const raw = String(req.body['link_' + p] || '').trim();
      inputLinks[p] = raw;
      if (!raw) { newLinks[p] = null; continue; }
      if (raw.length > 500) errors.push(`URL pre ${PLATFORM_LABELS[p]} je príliš dlhá.`);
      else if (!isHttpUrl(raw)) errors.push(`URL pre ${PLATFORM_LABELS[p]} musí začínať http:// alebo https://`);
      else newLinks[p] = raw;
    }

    if (errors.length) {
      const ctx = await loadEditCtx(userId);
      return renderEdit(res, ctx, {
        status: 400,
        error: errors.join(' '),
        section: 'profile',
        profile: { ...ctx.user, bio: bioStr, location: locStr, custom_field_label: cfLabel, custom_field_value: cfValue, birth_date: bDate || ctx.user.birth_date },
        links: inputLinks,
      });
    }

    await db.transaction(async (trx) => {
      await trx('users').where('id', userId).update({
        bio: bioStr.slice(0, 1000) || null,
        location: locStr.slice(0, 120) || null,
        birth_date: bDate,
        custom_field_label: cfLabel || null,
        custom_field_value: cfValue || null,
      });
      for (const p of PLATFORMS) {
        const url = newLinks[p];
        if (url) {
          const ex = await trx('user_social_links').where({ user_id: userId, platform: p }).first();
          if (ex) await trx('user_social_links').where('id', ex.id).update({ url });
          else await trx('user_social_links').insert({ user_id: userId, platform: p, url });
        } else {
          await trx('user_social_links').where({ user_id: userId, platform: p }).del();
        }
      }
    });

    log.info('profile updated', { userId });
    res.redirect('/profil?saved=1');
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /profil/password
// ---------------------------------------------------------------------------

router.post('/profil/password', requireAuth({ redirectTo: '/login' }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, new_password, new_password2 } = req.body;

    const u = await db('users').where('id', userId).first();
    const okCurrent = typeof current_password === 'string'
      && (await bcrypt.compare(current_password, u.password_hash));

    let error = null;
    if (!okCurrent) error = 'Aktuálne heslo nie je správne.';
    else {
      const pe = auth.validatePassword(new_password);
      if (pe) error = pe;
      else if (new_password !== new_password2) error = 'Nové heslá sa nezhodujú.';
    }

    if (error) {
      const ctx = await loadEditCtx(userId);
      return renderEdit(res, ctx, { status: 400, error, section: 'password' });
    }

    await auth.changePassword(userId, new_password);
    log.info('user changed own password', { userId });
    res.redirect('/profil?password=1&section=password');
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /profil/security
// ---------------------------------------------------------------------------

router.post('/profil/security', requireAuth({ redirectTo: '/login' }), async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { current_password, question_id = '', custom_question = '', answer } = req.body;

    const u = await db('users').where('id', userId).first();
    const okCurrent = typeof current_password === 'string'
      && (await bcrypt.compare(current_password, u.password_hash));

    let error = null;
    let qid = null;
    let customQ = null;

    if (!okCurrent) error = 'Aktuálne heslo nie je správne.';
    else {
      const questions = await db('security_questions').where('is_active', true).orderBy('id');
      const qidParsed = question_id ? parseInt(question_id, 10) : null;
      const cq = String(custom_question).trim();

      if (qidParsed) {
        if (!questions.find((q) => q.id === qidParsed)) error = 'Vybraná otázka neexistuje.';
        else qid = qidParsed;
      } else if (cq) {
        if (cq.length < 5 || cq.length > 255) error = 'Vlastná otázka musí mať 5–255 znakov.';
        else customQ = cq;
      } else {
        error = 'Vyber otázku zo zoznamu alebo zadaj vlastnú.';
      }

      if (!error) {
        if (typeof answer !== 'string' || answer.trim().length < 3) {
          error = 'Odpoveď musí mať aspoň 3 znaky.';
        }
      }
    }

    if (error) {
      const ctx = await loadEditCtx(userId);
      return renderEdit(res, ctx, { status: 400, error, section: 'security' });
    }

    const answerHash = await bcrypt.hash(
      answer.toLowerCase().trim(), config.security.bcryptCost
    );

    await db.transaction(async (trx) => {
      await trx('user_security_answers').where('user_id', userId).del();
      await trx('user_security_answers').insert({
        user_id: userId,
        question_id: qid,
        custom_question: customQ,
        answer_hash: answerHash,
      });
    });

    log.info('user changed security question', { userId });
    res.redirect('/profil?security=1&section=security');
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /u/:nickname — verejný profil
// ---------------------------------------------------------------------------

router.get('/u/:nickname', async (req, res, next) => {
  try {
    const nick = String(req.params.nickname || '').trim();
    if (!nick) {
      return res.status(404).render('errors/404', {
        title: 'Stránka nenájdená',
        url: req.originalUrl,
      });
    }

    const u = await db('users').where('nickname', nick).first();
    if (!u || u.is_banned) {
      return res.status(404).render('errors/404', {
        title: 'Stránka nenájdená',
        url: req.originalUrl,
      });
    }

    const links = await db('user_social_links').where('user_id', u.id).orderBy('platform');

    res.render('profile/show', {
      title: u.nickname,
      profile: u,
      links,
      platformLabels: PLATFORM_LABELS,
    });
  } catch (err) { next(err); }
});

module.exports = router;
