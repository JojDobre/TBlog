/**
 * Article blocks  (Phase 5.1)
 *
 * Block content je `articles.content` — pole JSON objektov.
 * Každý blok má `type` a typovo špecifické polia.
 *
 * Phase 5.1 podporované typy:
 *   - paragraph:  { type: 'paragraph', text: string }
 *   - heading:    { type: 'heading', level: 2|3, text: string }
 *   - image:      { type: 'image', media_id: number, caption?: string, alt?: string }
 *   - divider:    { type: 'divider' }
 *
 * Phase 5.2 pridá: video, youtube, gallery, quote, list, embed.
 *
 * Funkcie:
 *   sanitizeBlocks(rawArray)        → { blocks, errors[] }
 *   extractSearchText(blocks)       → string (plain text pre fulltext)
 *   extractFirstImageId(blocks)     → number|null  (pre auto-cover ak nie je)
 */

'use strict';

const BLOCK_TYPES = ['paragraph', 'heading', 'image', 'divider'];

const HEADING_LEVELS = [2, 3];

// Striedme limity (môžeme zvýšiť ak treba)
const MAX_PARAGRAPH_LEN = 20000;
const MAX_HEADING_LEN = 255;
const MAX_CAPTION_LEN = 500;
const MAX_ALT_LEN = 255;

/**
 * Vyčisti pole blokov podľa typu, prefiltruj invalid.
 * Vráti len blocky s validnou štruktúrou; chyby sú pre logging,
 * nie hard fail — admin nech nestratí prácu kvôli jednému zlému bloku.
 */
function sanitizeBlocks(raw) {
  const errors = [];
  if (!Array.isArray(raw)) {
    return { blocks: [], errors: ['content_not_array'] };
  }

  const blocks = [];
  raw.forEach((b, i) => {
    if (!b || typeof b !== 'object' || !BLOCK_TYPES.includes(b.type)) {
      errors.push(`block[${i}]_invalid_type`);
      return;
    }
    switch (b.type) {
      case 'paragraph': {
        const text = String(b.text || '').slice(0, MAX_PARAGRAPH_LEN);
        if (!text.trim()) return; // prázdny paragraf zahodíme
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
      default:
        errors.push(`block[${i}]_unknown`);
    }
  });

  return { blocks, errors };
}

/**
 * Extrahuje plain text zo všetkých textových blokov pre fulltext search
 * indexovanie (`articles.search_text`).
 */
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
    }
  }
  return parts.join('\n').slice(0, 5_000_000); // MEDIUMTEXT limit guard
}

/**
 * Vráti prvé media_id z image blokov (na auto-cover ak admin nezvolí).
 */
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
};
