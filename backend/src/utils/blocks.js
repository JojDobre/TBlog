/**
 * Article blocks  (Phase 5.4)
 *
 * Pridané typy:
 *   - youtube:  { type: 'youtube', video_id: string, caption?: string }
 *   - quote:    { type: 'quote', text: string, author?: string }
 *
 * Phase 5.5+ pridá: video (vlastný), gallery, list, embed.
 */

'use strict';

const BLOCK_TYPES = ['paragraph', 'heading', 'image', 'divider', 'youtube', 'quote'];
const HEADING_LEVELS = [2, 3];

const MAX_PARAGRAPH_LEN = 20000;
const MAX_HEADING_LEN = 255;
const MAX_CAPTION_LEN = 500;
const MAX_ALT_LEN = 255;
const MAX_QUOTE_LEN = 5000;
const MAX_QUOTE_AUTHOR_LEN = 160;

// YouTube video ID: 11 znakov, [a-zA-Z0-9_-]
const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extrahuje YouTube video ID z rôznych formátov URL alebo holého ID.
 * Podporuje:
 *   - https://www.youtube.com/watch?v=VIDEO_ID
 *   - https://youtu.be/VIDEO_ID
 *   - https://www.youtube.com/embed/VIDEO_ID
 *   - https://www.youtube.com/shorts/VIDEO_ID
 *   - holé VIDEO_ID (11 znakov)
 *
 * Vráti video_id alebo null ak nie je validný.
 */
function extractYoutubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim();
  if (!s) return null;

  // Holé ID
  if (YOUTUBE_ID_RE.test(s)) return s;

  // URL formáty — vytiahni ID
  // youtu.be/ID
  let m = s.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];

  // youtube.com/watch?v=ID
  m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];

  // youtube.com/embed/ID, /shorts/ID, /v/ID
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
        // Akceptujeme video_id ALEBO url (frontend posiela video_id po normalizácii,
        // ale tolerantne berieme aj URL pre prípad).
        const candidate = b.video_id || b.url || '';
        const videoId = extractYoutubeId(candidate);
        if (!videoId) {
          errors.push(`block[${i}]_youtube_invalid`);
          return;
        }
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
    }
  }
  return parts.join('\n').slice(0, 5_000_000);
}

function extractFirstImageId(blocks) {
  if (!Array.isArray(blocks)) return null;
  for (const b of blocks) {
    if (b && b.type === 'image' && Number.isInteger(b.media_id)) return b.media_id;
  }
  return null;
}

module.exports = {
  BLOCK_TYPES,
  HEADING_LEVELS,
  sanitizeBlocks,
  extractSearchText,
  extractFirstImageId,
  extractYoutubeId,
};
