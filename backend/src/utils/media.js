/**
 * Media utilities — image processing.
 *
 * processImageUpload(file, opts):
 *   - move uploaded file to uploads/originals/<uuid>.<ext> (no recompression)
 *   - generate JPEG thumbnail to uploads/thumbnails/<uuid>.jpg via Sharp
 *   - insert row into `media` table
 *   - returns { id, thumbnailPath, originalPath }
 */

'use strict';

const path = require('path');
const fs = require('fs/promises');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

const db = require('../db');
const log = require('../logger');
const config = require('../../../config');

const ORIGINALS_DIR = path.join(config.paths.uploads, 'originals');
const THUMBNAILS_DIR = path.join(config.paths.uploads, 'thumbnails');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

async function processImageUpload({ file, uploaderId, altText, caption }) {
  if (!file || !file.path) throw new Error('No file provided');

  const ext = EXT_BY_MIME[file.mimetype] || '.bin';
  const uuid = uuidv4();
  const originalName = uuid + ext;
  const thumbnailName = uuid + '.jpg';

  await fs.mkdir(ORIGINALS_DIR, { recursive: true });
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });

  const originalAbs = path.join(ORIGINALS_DIR, originalName);
  const thumbnailAbs = path.join(THUMBNAILS_DIR, thumbnailName);

  // 1) Read metadata FIRST (before moving — Sharp accepts any path)
  let metadata;
  try {
    metadata = await sharp(file.path).metadata();
  } catch (err) {
    // not a valid image — clean up temp file
    await fs.unlink(file.path).catch(() => {});
    throw new Error('Súbor nie je platný obrázok.');
  }

  // 2) Move (rename) original
  // fs.rename can fail across volumes — copy + unlink as fallback.
  try {
    await fs.rename(file.path, originalAbs);
  } catch (err) {
    await fs.copyFile(file.path, originalAbs);
    await fs.unlink(file.path).catch(() => {});
  }

  // 3) Generate thumbnail
  try {
    await sharp(originalAbs)
      .rotate() // auto-orient based on EXIF
      .resize(config.uploads.image.thumbnailWidth, null, { withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(thumbnailAbs);
  } catch (err) {
    log.error('thumbnail generation failed', { err: err.message });
    // thumbnail failure shouldn't kill the upload — but we want a thumbnail.
    // Clean up original and re-throw.
    await fs.unlink(originalAbs).catch(() => {});
    throw new Error('Nepodarilo sa vytvoriť náhľad obrázka.');
  }

  // 4) DB insert
  const inserted = await db('media').insert({
    type: 'image',
    original_path: 'originals/' + originalName,
    thumbnail_path: 'thumbnails/' + thumbnailName,
    mime: file.mimetype,
    size_bytes: file.size,
    width: metadata.width || null,
    height: metadata.height || null,
    original_filename: (file.originalname || '').slice(0, 255),
    alt_text: altText ? String(altText).slice(0, 255) : null,
    caption: caption ? String(caption).slice(0, 1000) : null,
    uploader_id: uploaderId,
  });

  const id = Array.isArray(inserted) ? inserted[0] : inserted;

  return {
    id,
    originalPath: 'originals/' + originalName,
    thumbnailPath: 'thumbnails/' + thumbnailName,
  };
}

/**
 * Delete media files from disk (best-effort — chyby neházeme).
 */
async function deleteMediaFiles(media) {
  const root = config.paths.uploads;
  if (media.original_path) {
    await fs.unlink(path.join(root, media.original_path)).catch(() => {});
  }
  if (media.thumbnail_path) {
    await fs.unlink(path.join(root, media.thumbnail_path)).catch(() => {});
  }
}

module.exports = { processImageUpload, deleteMediaFiles };
