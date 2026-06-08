/**
 * Media utilities — image processing.
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
const MEDIUM_DIR = path.join(config.paths.uploads, 'medium');

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
};

async function processImageUpload({ file, uploaderId, altText, caption }) {
  if (!file || !file.path) throw new Error('No file provided');

  const ext = EXT_BY_MIME[file.mimetype] || '.bin';
  const uuid = uuidv4();
  const originalName = uuid + ext;
  const isSvg = file.mimetype === 'image/svg+xml';

  await fs.mkdir(ORIGINALS_DIR, { recursive: true });
  await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
  await fs.mkdir(MEDIUM_DIR, { recursive: true });

  const originalAbs = path.join(ORIGINALS_DIR, originalName);
  const originalRelative = 'originals/' + originalName;

  // 1) Metadata (skip for SVG — Sharp can't read SVG metadata reliably)
  let metadata = {};
  if (!isSvg) {
    try {
      metadata = await sharp(file.path).metadata();
    } catch (err) {
      await fs.unlink(file.path).catch(() => {});
      throw new Error('Súbor nie je platný obrázok.');
    }
  }

  // 2) Move original
  try {
    await fs.rename(file.path, originalAbs);
  } catch (err) {
    await fs.copyFile(file.path, originalAbs);
    await fs.unlink(file.path).catch(() => {});
  }

  // 3) SVG — no thumbnail/medium needed, use original for all
  if (isSvg) {
    const inserted = await db('media').insert({
      type: 'image',
      original_path: originalRelative,
      thumbnail_path: originalRelative,
      medium_path: originalRelative,
      mime: file.mimetype,
      size_bytes: file.size,
      width: null,
      height: null,
      original_filename: (file.originalname || '').slice(0, 255),
      alt_text: altText ? String(altText).slice(0, 255) : null,
      caption: caption ? String(caption).slice(0, 1000) : null,
      uploader_id: uploaderId,
    });
    const id = Array.isArray(inserted) ? inserted[0] : inserted;
    return { id, originalPath: originalRelative, thumbnailPath: originalRelative };
  }

  // 4) Generate thumbnail (400px JPEG)
  const thumbnailName = uuid + '.jpg';
  const thumbnailAbs = path.join(THUMBNAILS_DIR, thumbnailName);
  try {
    await sharp(originalAbs)
      .rotate()
      .resize(config.uploads.image.thumbnailWidth, null, { withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .toFile(thumbnailAbs);
  } catch (err) {
    log.error('thumbnail generation failed', { err: err.message });
    await fs.unlink(originalAbs).catch(() => {});
    throw new Error('Nepodarilo sa vytvoriť náhľad obrázka.');
  }

  // 5) Generate medium (1200px WebP)
  const mediumName = uuid + '.webp';
  const mediumAbs = path.join(MEDIUM_DIR, mediumName);
  let mediumPath = null;
  try {
    await sharp(originalAbs)
      .rotate()
      .resize(1200, null, { withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(mediumAbs);
    mediumPath = 'medium/' + mediumName;
  } catch (err) {
    log.warn('medium generation failed (non-fatal)', { err: err.message });
  }

  // 6) DB insert
  const inserted = await db('media').insert({
    type: 'image',
    original_path: originalRelative,
    thumbnail_path: 'thumbnails/' + thumbnailName,
    medium_path: mediumPath,
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
    originalPath: originalRelative,
    thumbnailPath: 'thumbnails/' + thumbnailName,
  };
}

async function deleteMediaFiles(media) {
  const root = config.paths.uploads;
  if (media.original_path) {
    await fs.unlink(path.join(root, media.original_path)).catch(() => {});
  }
  if (media.thumbnail_path && media.thumbnail_path !== media.original_path) {
    await fs.unlink(path.join(root, media.thumbnail_path)).catch(() => {});
  }
  if (media.medium_path && media.medium_path !== media.original_path) {
    await fs.unlink(path.join(root, media.medium_path)).catch(() => {});
  }
}

module.exports = { processImageUpload, deleteMediaFiles };
