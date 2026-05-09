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

const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'image',
  'divider',
  'youtube',
  'quote',
  'gallery',
  'list',
  'section',
  'pros_cons',
  'specs',
  'rating',
  'rating_breakdown',
  'color_variants',
  'review_banner',
];
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
        const text = String(b.text || '')
          .slice(0, MAX_HEADING_LEN)
          .trim();
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
        const text = String(b.text || '')
          .slice(0, MAX_QUOTE_LEN)
          .trim();
        if (!text) return;
        const block = { type: 'quote', text };
        if (b.author) block.author = String(b.author).slice(0, MAX_QUOTE_AUTHOR_LEN).trim();
        blocks.push(block);
        break;
      }
      case 'gallery': {
        if (!Array.isArray(b.items)) {
          errors.push(`block[${i}]_gallery_no_items`);
          return;
        }
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
        if (!Array.isArray(b.items)) {
          errors.push(`block[${i}]_list_no_items`);
          return;
        }
        const ordered = !!b.ordered;
        const items = [];
        for (const item of b.items.slice(0, MAX_LIST_ITEMS)) {
          const text = String(item || '')
            .slice(0, MAX_LIST_ITEM_LEN)
            .trim();
          if (text) items.push(text);
        }
        if (items.length === 0) return;
        blocks.push({ type: 'list', ordered, items });
        break;
      }
      case 'section': {
        const out = { type: 'section' };
        out.width = ['full', 'half'].includes(b.width) ? b.width : 'full';
        out.layout = ['default', 'split', 'split-reverse', 'grid'].includes(b.layout)
          ? b.layout
          : 'default';
        out.grid_title_side = ['left', 'right'].includes(b.grid_title_side)
          ? b.grid_title_side
          : 'right';
        out.title_style = ['default', 'centered', 'xl', 'gradient', 'accent'].includes(
          b.title_style
        )
          ? b.title_style
          : 'default';
        out.media_style = ['normal', 'tilt'].includes(b.media_style) ? b.media_style : 'normal';
        out.show_divider = !!b.show_divider;
        out.number = String(b.number || '')
          .slice(0, 10)
          .trim();
        out.eyebrow = String(b.eyebrow || '')
          .slice(0, 120)
          .trim();
        out.title = String(b.title || '')
          .slice(0, 255)
          .trim();
        out.text = String(b.text || '').slice(0, MAX_PARAGRAPH_LEN);
        out.caption = String(b.caption || '')
          .slice(0, MAX_CAPTION_LEN)
          .trim();
        out.video_url = String(b.video_url || '')
          .slice(0, 500)
          .trim();
        const mid = Number(b.media_id);
        out.media_id = Number.isInteger(mid) && mid > 0 ? mid : null;
        blocks.push(out);
        break;
      }
      case 'pros_cons': {
        const pros = Array.isArray(b.pros)
          ? b.pros
              .map((s) =>
                String(s || '')
                  .slice(0, 500)
                  .trim()
              )
              .filter(Boolean)
          : [];
        const cons = Array.isArray(b.cons)
          ? b.cons
              .map((s) =>
                String(s || '')
                  .slice(0, 500)
                  .trim()
              )
              .filter(Boolean)
          : [];
        if (pros.length === 0 && cons.length === 0) return;
        blocks.push({
          type: 'pros_cons',
          pros,
          cons,
          width: ['full', 'half'].includes(b.width) ? b.width : 'full',
        });
        break;
      }
      case 'specs': {
        if (!Array.isArray(b.rows)) return;
        const rows = b.rows
          .slice(0, 100)
          .map((r) => ({
            key: String(r.key || '')
              .slice(0, 200)
              .trim(),
            value: String(r.value || '')
              .slice(0, 500)
              .trim(),
          }))
          .filter((r) => r.key || r.value);
        if (rows.length === 0) return;
        const width = ['full', 'half'].includes(b.width) ? b.width : 'full';
        blocks.push({ type: 'specs', rows, width });
        break;
      }
      case 'rating': {
        const out = { type: 'rating' };
        out.total_score = Math.min(10, Math.max(0, Number(b.total_score) || 0));
        out.badge = String(b.badge || '')
          .slice(0, 100)
          .trim();
        out.verdict_title = String(b.verdict_title || '')
          .slice(0, 200)
          .trim();
        out.verdict_text = String(b.verdict_text || '')
          .slice(0, 2000)
          .trim();
        blocks.push(out);
        break;
      }
      case 'rating_breakdown': {
        const out = { type: 'rating_breakdown' };
        out.width = ['full', 'half'].includes(b.width) ? b.width : 'full';
        out.criteria = Array.isArray(b.criteria)
          ? b.criteria
              .slice(0, 20)
              .map((c) => ({
                name: String(c.name || '')
                  .slice(0, 200)
                  .trim(),
                score: Math.min(10, Math.max(0, Number(c.score) || 0)),
              }))
              .filter((c) => c.name)
          : [];
        if (out.criteria.length === 0) return;
        blocks.push(out);
        break;
      }
      case 'color_variants': {
        if (!Array.isArray(b.variants)) return;
        const variants = b.variants
          .slice(0, 20)
          .map((v) => {
            const mid = Number(v.media_id);
            return {
              name: String(v.name || '')
                .slice(0, 100)
                .trim(),
              hex: /^#[0-9a-fA-F]{6}$/.test(v.hex) ? v.hex : '#000000',
              code: String(v.code || '')
                .slice(0, 50)
                .trim(),
              note: String(v.note || '')
                .slice(0, 100)
                .trim(),
              media_id: Number.isInteger(mid) && mid > 0 ? mid : null,
            };
          })
          .filter((v) => v.name);
        if (variants.length === 0) return;
        blocks.push({
          type: 'color_variants',
          variants,
          width: ['full', 'half'].includes(b.width) ? b.width : 'full',
        });
        break;
      }
      case 'review_banner': {
        out.width = ['full', 'half'].includes(b.width) ? b.width : 'full';
        const out = { type: 'review_banner' };
        out.title = String(b.title || '')
          .slice(0, 200)
          .trim();
        out.subtitle = String(b.subtitle || '')
          .slice(0, 200)
          .trim();
        const bgId = Number(b.background_media_id);
        out.background_media_id = Number.isInteger(bgId) && bgId > 0 ? bgId : null;
        out.slider_media_ids = Array.isArray(b.slider_media_ids)
          ? b.slider_media_ids
              .slice(0, 10)
              .map((n) => {
                const v = Number(n);
                return Number.isInteger(v) && v > 0 ? v : null;
              })
              .filter(Boolean)
          : [];
        out.buttons = Array.isArray(b.buttons)
          ? b.buttons
              .slice(0, 5)
              .map((btn) => ({
                label: String(btn.label || '')
                  .slice(0, 100)
                  .trim(),
                anchor: String(btn.anchor || '')
                  .slice(0, 200)
                  .trim(),
                style: ['primary', 'secondary', 'ghost'].includes(btn.style)
                  ? btn.style
                  : 'primary',
              }))
              .filter((btn) => btn.label)
          : [];
        blocks.push(out);
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
    } else if (b.type === 'section') {
      if (b.eyebrow) parts.push(b.eyebrow);
      if (b.title) parts.push(b.title);
      if (b.text) parts.push(b.text);
    } else if (b.type === 'pros_cons') {
      if (Array.isArray(b.pros)) parts.push(...b.pros);
      if (Array.isArray(b.cons)) parts.push(...b.cons);
    } else if (b.type === 'specs' && Array.isArray(b.rows)) {
      for (const r of b.rows) {
        parts.push(r.key || '');
        parts.push(r.value || '');
      }
    } else if (b.type === 'rating') {
      if (b.verdict_title) parts.push(b.verdict_title);
      if (b.verdict_text) parts.push(b.verdict_text);
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
  BLOCK_TYPES,
  HEADING_LEVELS,
  sanitizeBlocks,
  extractSearchText,
  extractFirstImageId,
  extractYoutubeId,
};
