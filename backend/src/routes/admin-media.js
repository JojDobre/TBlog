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

router.use(requireAuth());
router.use(requireRole('admin', 'editor'));

const TEMP_DIR = path.join(config.paths.uploads, 'temp');
fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});

const PER_PAGE = 24;
const MAX_FILES_PER_UPLOAD = 20;

const upload = multer({
  dest: TEMP_DIR,
  limits: {
    fileSize: config.uploads.image.maxSizeBytes,
    files: MAX_FILES_PER_UPLOAD,
  },
  fileFilter: (req, file, cb) => {
    if (config.uploads.image.allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Nepodporovaný typ: ' + file.originalname));
  },
});

function multerErrorMessage(err) {
  if (!err) return null;
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return `Naraz môžeš nahrať maximálne ${MAX_FILES_PER_UPLOAD} súborov.`;
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    const mb = Math.floor(config.uploads.image.maxSizeBytes / (1024 * 1024));
    return `Súbor je príliš veľký (max ${mb} MB).`;
  }
  return err.message || 'Nahrávanie zlyhalo.';
}

// GET /
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 100);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    let baseQuery = db('media');
    if (q) {
      baseQuery = baseQuery.whereRaw(
        'MATCH(original_filename, alt_text, caption) AGAINST(? IN BOOLEAN MODE)',
        [q + '*']
      );
    }

    const [{ total }, items] = await Promise.all([
      baseQuery.clone().count({ total: '*' }).first(),
      baseQuery.clone()
        .leftJoin('users', 'media.uploader_id', 'users.id')
        .select('media.*', 'users.nickname as uploader_nickname')
        .orderBy('media.created_at', 'desc')
        .limit(PER_PAGE).offset(offset),
    ]);

    const totalCount = Number(total) || 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));

    const ids = items.map((i) => i.id);
    let usageCounts = {};
    if (ids.length > 0) {
      const rows = await db('media_usages')
        .whereIn('media_id', ids).select('media_id').count({ c: '*' }).groupBy('media_id');
      usageCounts = Object.fromEntries(rows.map((r) => [r.media_id, Number(r.c)]));
    }
    items.forEach((i) => { i.usage_count = usageCounts[i.id] || 0; });

    res.render('admin/media/index', {
      title: 'Médiá',
      items, q, page, totalPages, totalCount,
      flash: {
        uploadedCount: parseInt(req.query.uploaded, 10) || 0,
        deleted: req.query.deleted === '1',
        saved: req.query.saved === '1',
        err: typeof req.query.err === 'string' ? req.query.err : null,
      },
      maxSizeMb: Math.floor(config.uploads.image.maxSizeBytes / (1024 * 1024)),
      maxFiles: MAX_FILES_PER_UPLOAD,
    });
  } catch (err) { next(err); }
});

// POST /upload — multi-file s lepšou error handling
router.post('/upload',
  (req, res, next) => {
    upload.array('files', MAX_FILES_PER_UPLOAD)(req, res, (err) => {
      if (err) {
        log.warn('media upload multer error', { code: err.code, msg: err.message });
        return res.redirect('/admin/media?err=' + encodeURIComponent(multerErrorMessage(err)));
      }
      next();
    });
  },
  async (req, res, next) => {
    if (!validateRequest(req)) {
      if (req.files) for (const f of req.files) await fs.unlink(f.path).catch(() => {});
      return res.redirect('/admin/media?err=' + encodeURIComponent('Neplatný CSRF token.'));
    }
    next();
  },
  async (req, res) => {
    const files = req.files || [];
    if (files.length === 0) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Žiadny súbor nebol odoslaný.'));
    }

    let okCount = 0;
    const errors = [];

    for (const file of files) {
      try {
        await media.processImageUpload({
          file,
          uploaderId: req.user.id,
          altText: req.body.alt_text || null,
          caption: req.body.caption || null,
        });
        okCount++;
      } catch (err) {
        await fs.unlink(file.path).catch(() => {});
        errors.push(`${file.originalname}: ${err.message}`);
        log.warn('media upload failed', { file: file.originalname, err: err.message });
      }
    }

    log.info('media batch uploaded', { count: okCount, total: files.length, userId: req.user.id });

    const params = new URLSearchParams();
    if (okCount > 0) params.set('uploaded', String(okCount));
    if (errors.length > 0) params.set('err', errors.slice(0, 3).join('; '));

    res.redirect('/admin/media?' + params.toString());
  }
);

// GET /:id/edit
router.get('/:id/edit', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.redirect('/admin/media');

    const item = await db('media')
      .leftJoin('users', 'media.uploader_id', 'users.id')
      .select('media.*', 'users.nickname as uploader_nickname')
      .where('media.id', id).first();

    if (!item) return res.redirect('/admin/media');
    res.render('admin/media/edit', { title: 'Úprava média', item, error: null });
  } catch (err) { next(err); }
});

router.post('/:id/edit', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.redirect('/admin/media');

    const { alt_text = '', caption = '' } = req.body;
    await db('media').where('id', id).update({
      alt_text: String(alt_text).trim().slice(0, 255) || null,
      caption: String(caption).trim().slice(0, 1000) || null,
    });
    res.redirect('/admin/media?saved=1');
  } catch (err) { next(err); }
});

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.redirect('/admin/media');

    const u = await db('media_usages').where('media_id', id).count({ c: '*' }).first();
    if (Number(u.c) > 0) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Médium sa používa.'));
    }

    const [au, ca, og] = await Promise.all([
      db('users').where('avatar_media_id', id).count({ c: '*' }).first(),
      db('articles').where('cover_media_id', id).count({ c: '*' }).first(),
      db('articles').where('og_image_media_id', id).count({ c: '*' }).first(),
    ]);
    if (Number(au.c) + Number(ca.c) + Number(og.c) > 0) {
      return res.redirect('/admin/media?err=' + encodeURIComponent('Médium sa používa.'));
    }

    const m = await db('media').where('id', id).first();
    if (!m) return res.redirect('/admin/media');

    await media.deleteMediaFiles(m);
    await db('media').where('id', id).del();
    res.redirect('/admin/media?deleted=1');
  } catch (err) { next(err); }
});

module.exports = router;
