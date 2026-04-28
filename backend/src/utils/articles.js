/**
 * Article utility funkcie  (Phase 5.1)
 *
 * Reuse `slugifyName` a `ensureUniqueSlug` z taxonomy.js (cez tableName).
 */

'use strict';

const taxonomy = require('./taxonomy');

const TYPES = ['article', 'review'];
const STATUSES = ['draft', 'scheduled', 'published', 'archived', 'trash'];

// Aké stavy môže admin/editor priamo nastaviť (scheduled/archived až v 5.2)
const ALLOWED_STATUS_TRANSITIONS = ['draft', 'published'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyArticle(name) {
  // articles.slug má max 255, ostatné konvencie rovnaké
  return taxonomy.slugifyName(name, { maxLen: 255 });
}

async function ensureUniqueArticleSlug(knex, baseSlug, excludeId = null) {
  // taxonomy.ensureUniqueSlug podporuje akúkoľvek tabuľku
  return taxonomy.ensureUniqueSlug('articles', baseSlug, excludeId);
}

/**
 * Validuje a normalizuje vstup pre meta polia článku.
 * Bloky validuje samostatne `blocks.sanitizeBlocks`.
 */
function validateArticleMeta(input, { isNew = true } = {}) {
  const errors = {};
  const value = {};

  // title
  const title = String(input.title || '').trim();
  if (!title) errors.title = 'Názov je povinný.';
  else if (title.length > 255) errors.title = 'Názov môže mať max 255 znakov.';
  value.title = title;

  // slug — voliteľný (auto-gen z title)
  const slugRaw = String(input.slug || '').trim().toLowerCase();
  if (slugRaw) {
    if (!SLUG_RE.test(slugRaw)) errors.slug = 'Slug môže obsahovať len a-z, 0-9 a pomlčky.';
    else if (slugRaw.length > 255) errors.slug = 'Slug môže mať max 255 znakov.';
  }
  value.slug = slugRaw;

  // type
  const type = String(input.type || 'article').trim();
  if (!TYPES.includes(type)) errors.type = 'Neplatný typ.';
  value.type = type;

  // status — len 'draft' alebo 'published' v 5.1
  const status = String(input.status || 'draft').trim();
  if (!ALLOWED_STATUS_TRANSITIONS.includes(status)) {
    errors.status = 'Neplatný stav.';
  }
  value.status = status;

  // excerpt
  const excerpt = String(input.excerpt || '').trim();
  if (excerpt.length > 5000) errors.excerpt = 'Krátky popis môže mať max 5000 znakov.';
  value.excerpt = excerpt || null;

  // cover_media_id — voliteľné
  if (input.cover_media_id === '' || input.cover_media_id === null || input.cover_media_id === undefined) {
    value.cover_media_id = null;
  } else {
    const cm = Number(input.cover_media_id);
    if (!Number.isInteger(cm) || cm < 1) {
      errors.cover_media_id = 'Neplatné ID obrázka pre cover.';
    } else {
      value.cover_media_id = cm;
    }
  }

  return { value, errors };
}

/**
 * Zo `req.body` vytiahne content_json a parse ho.
 * Vráti pole alebo null ak parse zlyhá.
 */
function parseContentJson(input) {
  const raw = input.content_json;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

/**
 * Z M:N selectu (multiple) vytiahne pole čísel.
 * Multipath: getlist(req.body.category_ids) ⟶ [1, 2, 3]
 */
function parseIdList(raw) {
  if (raw === undefined || raw === null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const v of arr) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

module.exports = {
  TYPES,
  STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  slugifyArticle,
  ensureUniqueArticleSlug,
  validateArticleMeta,
  parseContentJson,
  parseIdList,
};
