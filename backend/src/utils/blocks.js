/**
 * Article blocks  (Phase 5.6 — final)
 *
 * Všetky podporované typy:
 *   - paragraph    { type, text }
 *   - heading      { type, level: 2|3, text }
 *   - image        { type, media_id, caption?, alt? }
 *   - divider      { type }
 *   - youtube      { type, video_id, caption? }
 *   - quote        { type, text, author? }
 *   - gallery      { type, items: [{ media_id, caption? }, ...] }    NOVÉ 5.6
 *   - list         { type, ordered: bool, items: [string, ...] }     NOVÉ 5.6
 */

'use strict';

const BLOCK_TYPES = ['paragraph', 'heading', 'image', 'divider', 'youtube', 'quote', 'gallery', 'list'];
const HEADING_LEVELS = [2, 3];

const MAX_PARAGRAPH_LEN = 20000;
const MAX_HEADING_LEN = 255;
const MAX_CAPTION_LEN = 500;
const MAX_ALT_LEN = 255;
const MAX_QUOTE_LEN = 5000;
const MAX_QUOTE_AUTHOR_LEN = 160;
const MAX_LIST_ITEMS = 100;
const MAX_LIST_ITEM_LEN = 1000;
const MAX_GALLERY_ITEMS = 30;

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

function extractYoutubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;
  if (YOUTUBE_ID_RE.test(s)) return s;
  let m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  m = s.match(/youtube\.com\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  return null;
}

function sanitizeBlocks(raw) {
  const errors = [];
  if (!Array.isArray(raw)) return { blocks: [], errors: ['content_not_array'] };

  const blocks = [];
  raw.forEach((b, i) => {
    if (!b || typeof b !== 'object' || !BLOCK_TYPES.includes(b.type)) {
      errors.push(`block[${i}]_invalid_type`);
      return;
    }
    switch (b.type) {
      case 'paragraph': {
        const text = String(b.text || '').slice(0, MAX_PARAGRAPH_LEN);
        if (!text.trim()) return;
        blocks.push({ type: 'paragraph', text });
        break;
      }
      case 'heading': {
        const level = HEADING_LEVELS.includes(Number(b.level)) ? Number(b.level) : 2;
        const text = String(b.text || '').slice(0, MAX_HEADING_LEN).trim();
        if (!text) return;
        blocks.push({ type: 'heading', level, text });
        break;
      }
      case 'image': {
        const mediaId = Number(b.media_id);
        if (!Number.isInteger(mediaId) || mediaId < 1) {
          errors.push(`block[${i}]_image_invalid_media_id`);
          return;
        }
        const block = { type: 'image', media_id: mediaId };
        if (b.caption) block.caption = String(b.caption).slice(0, MAX_CAPTION_LEN).trim();
        if (b.alt) block.alt = String(b.alt).slice(0, MAX_ALT_LEN).trim();
        blocks.push(block);
        break;
      }
      case 'divider': {
        blocks.push({ type: 'divider' });
        break;
      }
      case 'youtube': {
        const candidate = b.video_id || b.url || '';
        const videoId = extractYoutubeId(candidate);
        if (!videoId) { errors.push(`block[${i}]_youtube_invalid`); return; }
        const block = { type: 'youtube', video_id: videoId };
        if (b.caption) block.caption = String(b.caption).slice(0, MAX_CAPTION_LEN).trim();
        blocks.push(block);
        break;
      }
      case 'quote': {
        const text = String(b.text || '').slice(0, MAX_QUOTE_LEN).trim();
        if (!text) return;
        const block = { type: 'quote', text };
        if (b.author) block.author = String(b.author).slice(0, MAX_QUOTE_AUTHOR_LEN).trim();
        blocks.push(block);
        break;
      }
      case 'gallery': {
        if (!Array.isArray(b.items)) { errors.push(`block[${i}]_gallery_no_items`); return; }
        const items = [];
        for (const item of b.items.slice(0, MAX_GALLERY_ITEMS)) {
          if (!item || typeof item !== 'object') continue;
          const mediaId = Number(item.media_id);
          if (!Number.isInteger(mediaId) || mediaId < 1) continue;
          const out = { media_id: mediaId };
          if (item.caption) out.caption = String(item.caption).slice(0, MAX_CAPTION_LEN).trim();
          items.push(out);
        }
        if (items.length === 0) return; // prázdna galéria — vyhodíme
        blocks.push({ type: 'gallery', items });
        break;
      }
      case 'list': {
        if (!Array.isArray(b.items)) { errors.push(`block[${i}]_list_no_items`); return; }
        const ordered = !!b.ordered;
        const items = [];
        for (const item of b.items.slice(0, MAX_LIST_ITEMS)) {
          const text = String(item || '').slice(0, MAX_LIST_ITEM_LEN).trim();
          if (text) items.push(text);
        }
        if (items.length === 0) return;
        blocks.push({ type: 'list', ordered, items });
        break;
      }
      default:
        errors.push(`block[${i}]_unknown`);
    }
  });

  return { blocks, errors };
}

function extractSearchText(blocks) {
  if (!Array.isArray(blocks)) return '';
  const parts = [];
  for (const b of blocks) {
    if (!b || !b.type) continue;
    if (b.type === 'paragraph' && b.text) parts.push(b.text);
    else if (b.type === 'heading' && b.text) parts.push(b.text);
    else if (b.type === 'image') {
      if (b.caption) parts.push(b.caption);
      if (b.alt) parts.push(b.alt);
    } else if (b.type === 'youtube') {
      if (b.caption) parts.push(b.caption);
    } else if (b.type === 'quote') {
      if (b.text) parts.push(b.text);
      if (b.author) parts.push(b.author);
    } else if (b.type === 'gallery' && Array.isArray(b.items)) {
      for (const it of b.items) {
        if (it && it.caption) parts.push(it.caption);
      }
    } else if (b.type === 'list' && Array.isArray(b.items)) {
      for (const it of b.items) parts.push(String(it || ''));
    }
  }
  return parts.join('\n').slice(0, 5_000_000);
}

function extractFirstImageId(blocks) {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (b && b.type === 'image' && Number.isInteger(b.media_id)) return b.media_id;
    if (b && b.type === 'gallery' && Array.isArray(b.items) && b.items[0]) {
      const m = Number(b.items[0].media_id);
      if (Number.isInteger(m)) return m;
    }
  }
  return null;
}

module.exports = {
  BLOCK_TYPES, HEADING_LEVELS,
  sanitizeBlocks, extractSearchText, extractFirstImageId, extractYoutubeId,
};
