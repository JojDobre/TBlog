/**
 * Profile routes — Phase 2.3 + 3.2 (avatar)
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');

const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const db = require('../db');
const log = require('../logger');
const auth = require('../utils/auth');
const media = require('../utils/media');
const config = require('../../../config');
const { requireAuth } = require('../middleware/auth');
const { validateRequest } = require('../middleware/csrf');

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

const TEMP_DIR = path.join(config.paths.uploads, 'temp');
fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});

const avatarUpload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: config.uploads.image.maxSizeBytes },
  fileFilter: (req, file, cb) => {
    if (config.uploads.image.allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Nepodporovaný typ súboru.'));
  },
});

function isHttpUrl(s) {
  if (typeof s !== 'string') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

async function loadEditCtx(userId) {
  const [user, links, secQ, questions, avatar] = await Promise.all([
    db('users').where('id', userId).first(),
    db('user_social_links').where('user_id', userId),
    auth.getSecurityQuestion(userId),
    db('security_questions').where('is_active', true).orderBy('id'),
    db('users').where('users.id', userId)
      .leftJoin('media', 'users.avatar_media_id', 'media.id')
      .select('media.thumbnail_path as avatar_thumb', 'media.id as avatar_id').first(),
  ]);
  const linkMap = Object.fromEntries(
    PLATFORMS.map((p) => [p, (links.find((l) => l.platform === p) || {}).url || ''])
  );
  return {
    user, linkMap, securityQuestion: secQ, questions,
    avatarThumb: avatar?.avatar_thumb || null,
    avatarId: avatar?.avatar_id || null,
  };
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
    avatarThumb: ctx.avatarThumb,
    avatarId: ctx.avatarId,
  });
}

// GET /profil
router.get('/profil', requireAuth({ redirectTo: '/login' }), async (req, res, next) => {
  try {
    const ctx = await loadEditCtx(req.user.id);
    const success =
      req.query.saved ? 'Profil bol uložený.' :
      req.query.password ? 'Heslo bolo zmenené.' :
      req.query.security ? 'Bezpečnostná otázka bola zmenená.' :
      req.query.avatar ? 'Avatar bol zmenený.' :
      req.query.avatar_removed ? 'Avatar bol odstránený.' : null;
    renderEdit(res, ctx, { success, section: req.query.section || 'profile' });
  } catch (err) { next(err); }
});

// POST /profil — text fields + social
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
      if (!/^\d{4}-\d{2}-\d{2}$/.test(bdStr)) errors.push('Dátum narodenia musí byť YYYY-MM-DD.');
      else {
        const d = new Date(bdStr + 'T00:00:00Z');
        if (isNaN(d.getTime())) errors.push('Neplatný dátum.');
        else if (d > new Date()) errors.push('Dátum nemôže byť v budúcnosti.');
        else bDate = bdStr;
      }
    }

    const cfLabel = String(custom_field_label).trim().slice(0, 64);
    const cfValue = String(custom_field_value).trim().slice(0, 255);
    if ((cfLabel && !cfValue) || (!cfLabel && cfValue)) {
      errors.push('Vlastné pole vyžaduje názov aj hodnotu.');
    }

    const inputLinks = {};
    const newLinks = {};
    for (const p of PLATFORMS) {
      const raw = String(req.body['link_' + p] || '').trim();
      inputLinks[p] = raw;
      if (!raw) { newLinks[p] = null; continue; }
      if (raw.length > 500) errors.push(`URL pre ${PLATFORM_LABELS[p]} je príliš dlhá.`);
      else if (!isHttpUrl(raw)) errors.push(`URL pre ${PLATFORM_LABELS[p]} musí začínať http(s)://`);
      else newLinks[p] = raw;
    }

    if (errors.length) {
      const ctx = await loadEditCtx(userId);
      return renderEdit(res, ctx, {
        status: 400, error: errors.join(' '), section: 'profile',
        profile: { ...ctx.user, bio: bioStr, location: locStr,
          custom_field_label: cfLabel, custom_field_value: cfValue,
          birth_date: bDate || ctx.user.birth_date },
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

    res.redirect('/profil?saved=1');
  } catch (err) { next(err); }
});

// POST /profil/password
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
    res.redirect('/profil?password=1&section=password');
  } catch (err) { next(err); }
});

// POST /profil/security
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

      if (!error && (typeof answer !== 'string' || answer.trim().length < 3)) {
        error = 'Odpoveď musí mať aspoň 3 znaky.';
      }
    }

    if (error) {
      const ctx = await loadEditCtx(userId);
      return renderEdit(res, ctx, { status: 400, error, section: 'security' });
    }

    const answerHash = await bcrypt.hash(answer.toLowerCase().trim(), config.security.bcryptCost);

    await db.transaction(async (trx) => {
      await trx('user_security_answers').where('user_id', userId).del();
      await trx('user_security_answers').insert({
        user_id: userId, question_id: qid, custom_question: customQ, answer_hash: answerHash,
      });
    });

    res.redirect('/profil?security=1&section=security');
  } catch (err) { next(err); }
});

// POST /profil/avatar — upload + set as avatar
router.post('/profil/avatar',
  requireAuth({ redirectTo: '/login' }),
  (req, res, next) => {
    avatarUpload.single('avatar')(req, res, (err) => {
      if (err) return res.redirect('/profil?section=profile');
      next();
    });
  },
  async (req, res, next) => {
    if (!validateRequest(req)) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.redirect('/profil?section=profile');
    }
    if (!req.file) return res.redirect('/profil?section=profile');
    try {
      const result = await media.processImageUpload({
        file: req.file,
        uploaderId: req.user.id,
        altText: 'Avatar — ' + req.user.nickname,
        caption: null,
      });
      // staré avatar uvoľníme — len mediu necháme, môže byť reuse-nuté
      await db('users').where('id', req.user.id).update({ avatar_media_id: result.id });
      log.info('avatar uploaded', { userId: req.user.id, mediaId: result.id });
      res.redirect('/profil?avatar=1&section=profile');
    } catch (err) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      next(err);
    }
  }
);

// POST /profil/avatar/remove
router.post('/profil/avatar/remove', requireAuth({ redirectTo: '/login' }), async (req, res, next) => {
  try {
    await db('users').where('id', req.user.id).update({ avatar_media_id: null });
    log.info('avatar removed', { userId: req.user.id });
    res.redirect('/profil?avatar_removed=1&section=profile');
  } catch (err) { next(err); }
});

// GET /u/:nickname — public profile
router.get('/u/:nickname', async (req, res, next) => {
  try {
    const nick = String(req.params.nickname || '').trim();
    if (!nick) return res.status(404).render('errors/404', { title: 'Stránka nenájdená', url: req.originalUrl });

    const u = await db('users')
      .leftJoin('media', 'users.avatar_media_id', 'media.id')
      .select('users.*', 'media.thumbnail_path as avatar_thumb')
      .where('users.nickname', nick).first();

    if (!u || u.is_banned) {
      return res.status(404).render('errors/404', { title: 'Stránka nenájdená', url: req.originalUrl });
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
