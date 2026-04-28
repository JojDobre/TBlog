/**
 * Article utility funkcie  (Phase 5.2)
 *
 * Pridané: scheduled, archived stavy; scheduled_at validácia; is_featured.
 */

'use strict';

const taxonomy = require('./taxonomy');

const TYPES = ['article', 'review'];
const STATUSES = ['draft', 'scheduled', 'published', 'archived', 'trash'];

// Stavy ktoré môže admin nastaviť cez form (trash sa nastavuje cez separátny endpoint)
const ALLOWED_STATUS_TRANSITIONS = ['draft', 'scheduled', 'published', 'archived'];

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyArticle(name) {
  return taxonomy.slugifyName(name, { maxLen: 255 });
}

async function ensureUniqueArticleSlug(knex, baseSlug, excludeId = null) {
  return taxonomy.ensureUniqueSlug('articles', baseSlug, excludeId);
}

/**
 * Parser `<input type="datetime-local">` hodnoty na Date.
 * Vstup je v lokálnom čase prehliadača (bez TZ): 'YYYY-MM-DDTHH:MM'.
 * `new Date(value)` to interpretuje ako lokálny čas a vráti Date v UTC.
 */
function parseLocalDatetime(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * Validuje a normalizuje meta polia článku.
 */
function validateArticleMeta(input, { isNew = true } = {}) {
  const errors = {};
  const value = {};

  // title
  const title = String(input.title || '').trim();
  if (!title) errors.title = 'Názov je povinný.';
  else if (title.length > 255) errors.title = 'Názov môže mať max 255 znakov.';
  value.title = title;

  // slug
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

  // status
  const status = String(input.status || 'draft').trim();
  if (!ALLOWED_STATUS_TRANSITIONS.includes(status)) errors.status = 'Neplatný stav.';
  value.status = status;

  // scheduled_at — povinné iba pri status='scheduled', musí byť v budúcnosti
  const schedRaw = input.scheduled_at;
  if (status === 'scheduled') {
    const d = parseLocalDatetime(schedRaw);
    if (!d) {
      errors.scheduled_at = 'Pri stave „Naplánovaný" musí byť dátum a čas vyplnený.';
    } else if (d.getTime() <= Date.now()) {
      errors.scheduled_at = 'Naplánovaný čas musí byť v budúcnosti.';
    } else {
      value.scheduled_at = d;
    }
  } else {
    // pre iné stavy ignoruj scheduled_at (nastavíme NULL)
    value.scheduled_at = null;
  }

  // is_featured (checkbox: 'on' / undefined)
  value.is_featured = input.is_featured ? 1 : 0;

  // excerpt
  const excerpt = String(input.excerpt || '').trim();
  if (excerpt.length > 5000) errors.excerpt = 'Krátky popis môže mať max 5000 znakov.';
  value.excerpt = excerpt || null;

  // cover_media_id
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

/**
 * Pre <input type="datetime-local"> potrebujeme YYYY-MM-DDTHH:MM string
 * v lokálnom čase. JSov `Date.toISOString()` vracia UTC, takže sami vytvoríme.
 */
function toDatetimeLocalString(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() + '-' +
    pad(d.getMonth() + 1) + '-' +
    pad(d.getDate()) + 'T' +
    pad(d.getHours()) + ':' +
    pad(d.getMinutes())
  );
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
  parseLocalDatetime,
  toDatetimeLocalString,
};
