/**
 * Admin media library routes  (mounted at /admin/media)
 *
 *   GET  /              — list (grid)
 *   POST /upload        — upload image
 *   POST /:id/delete    — delete (only if not used)
 *
 * Multer parsuje multipart, CSRF validujeme MANUÁLNE po multer-i
 * (globálny csrfProtection skipuje multipart — pozri middleware/csrf.js).
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');

const express = require('express');
const multer = require('multer');

const db = require('../db');
const log = require('../logger');
const media = require('../utils/media');
const config = require('../../../config');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/csrf');

const router = express.Router();

// Auth gate — len admin alebo editor
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

// Multer config
const TEMP_DIR = path.join(config.paths.uploads, 'temp');

// Ensure temp dir exists at boot (best-effort)
fs.mkdir(TEMP_DIR, { recursive: true }).catch((err) =>
  log.warn('failed to create uploads/temp', { err: err.message })
);

const upload = multer({
  dest: TEMP_DIR,
  limits: { fileSize: config.uploads.image.maxSizeBytes },
  fileFilter: (req, file, cb) => {
    if (config.uploads.image.allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Nepodporovaný typ súboru. Povolené: JPEG, PNG, WebP, GIF.'));
    }
  },
});

// ---------------------------------------------------------------------------
// GET /admin/media
// ---------------------------------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const items = await db('media')
      .leftJoin('users', 'media.uploader_id', 'users.id')
      .select(
        'media.*',
        'users.nickname as uploader_nickname'
      )
      .orderBy('media.created_at', 'desc')
      .limit(60);

    // attach usage count for each (one query, then map)
    const ids = items.map((i) => i.id);
    let usageCounts = {};
    if (ids.length > 0) {
      const rows = await db('media_usages')
        .whereIn('media_id', ids)
        .select('media_id')
        .count({ c: '*' })
        .groupBy('media_id');
      usageCounts = Object.fromEntries(rows.map((r) => [r.media_id, Number(r.c)]));
    }
    items.forEach((i) => { i.usage_count = usageCounts[i.id] || 0; });

    const flash = {
      uploaded: req.query.uploaded === '1',
      deleted: req.query.deleted === '1',
      err: typeof req.query.err === 'string' ? req.query.err : null,
    };

    res.render('admin/media/index', {
      title: 'Médiá',
      items,
      flash,
      maxSizeMb: Math.floor(config.uploads.image.maxSizeBytes / (1024 * 1024)),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// POST /admin/media/upload
// Order: multer → CSRF check → handler
// ---------------------------------------------------------------------------

router.post('/upload',
  // 1) Parse multipart (this handles file validation via fileFilter / limits)
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        // multer error — file too big, wrong mime, etc.
        log.warn('media upload multer error', { err: err.message });
        return res.redirect('/admin/media?err=' + encodeURIComponent(err.message));
      }
      next();
    });
  },

  // 2) Manual CSRF validation (now that req.body has _csrf from multipart)
  async (req, res, next) => {
    if (!validateRequest(req)) {
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.redirect('/admin/media?err=' + encodeURIComponent('Neplatný CSRF token.'));
    }
    next();
  },

  // 3) Process & save
  async (req, res, next) => {
    if (!req.file) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Žiadny súbor nebol odoslaný.'));
    }
    try {
      const result = await media.processImageUpload({
        file: req.file,
        uploaderId: req.user.id,
        altText: req.body.alt_text || null,
        caption: req.body.caption || null,
      });
      log.info('media uploaded', { id: result.id, uploaderId: req.user.id });
      res.redirect('/admin/media?uploaded=1');
    } catch (err) {
      // ensure temp file cleaned up
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      log.error('media upload failed', { err: err.message });
      res.redirect('/admin/media?err=' + encodeURIComponent(err.message));
    }
  }
);

// ---------------------------------------------------------------------------
// POST /admin/media/:id/delete
// ---------------------------------------------------------------------------

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Neplatné ID.'));
    }

    // Check if media is used anywhere
    const u = await db('media_usages').where('media_id', id).count({ c: '*' }).first();
    if (Number(u.c) > 0) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Médium sa používa, nemožno zmazať.'));
    }

    // Also check direct references (avatar, cover, og_image)
    const [avatarUsers, coverArticles, ogArticles] = await Promise.all([
      db('users').where('avatar_media_id', id).count({ c: '*' }).first(),
      db('articles').where('cover_media_id', id).count({ c: '*' }).first(),
      db('articles').where('og_image_media_id', id).count({ c: '*' }).first(),
    ]);
    const totalRefs = Number(avatarUsers.c) + Number(coverArticles.c) + Number(ogArticles.c);
    if (totalRefs > 0) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Médium sa používa (avatar / cover), nemožno zmazať.'));
    }

    const m = await db('media').where('id', id).first();
    if (!m) return res.redirect('/admin/media');

    await media.deleteMediaFiles(m);
    await db('media').where('id', id).del();

    log.info('media deleted', { id, userId: req.user.id });
    res.redirect('/admin/media?deleted=1');
  } catch (err) { next(err); }
});

module.exports = router;
