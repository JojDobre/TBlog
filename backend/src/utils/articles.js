/**
 * Article utility funkcie  (Phase 5.6 — final)
 *
 * Pridané: default_related_strategy validácia.
 */

'use strict';

const taxonomy = require('./taxonomy');

const TYPES = ['article', 'review'];
const STATUSES = ['draft', 'scheduled', 'published', 'archived', 'trash'];
const ALLOWED_STATUS_TRANSITIONS = ['draft', 'scheduled', 'published', 'archived'];
const RELATED_STRATEGIES = ['manual', 'auto', 'both'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function slugifyArticle(name) { return taxonomy.slugifyName(name, { maxLen: 255 }); }
async function ensureUniqueArticleSlug(knex, baseSlug, excludeId = null) {
  return taxonomy.ensureUniqueSlug('articles', baseSlug, excludeId);
}

function parseLocalDatetime(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d : null;
}

function validateArticleMeta(input, { isNew = true } = {}) {
  const errors = {};
  const value = {};

  const title = String(input.title || '').trim();
  if (!title) errors.title = 'Názov je povinný.';
  else if (title.length > 255) errors.title = 'Názov môže mať max 255 znakov.';
  value.title = title;

  const slugRaw = String(input.slug || '').trim().toLowerCase();
  if (slugRaw) {
    if (!SLUG_RE.test(slugRaw)) errors.slug = 'Slug môže obsahovať len a-z, 0-9 a pomlčky.';
    else if (slugRaw.length > 255) errors.slug = 'Slug môže mať max 255 znakov.';
  }
  value.slug = slugRaw;

  const type = String(input.type || 'article').trim();
  if (!TYPES.includes(type)) errors.type = 'Neplatný typ.';
  value.type = type;

  const status = String(input.status || 'draft').trim();
  if (!ALLOWED_STATUS_TRANSITIONS.includes(status)) errors.status = 'Neplatný stav.';
  value.status = status;

  if (status === 'scheduled') {
    const d = parseLocalDatetime(input.scheduled_at);
    if (!d) errors.scheduled_at = 'Pri stave „Naplánovaný" musí byť dátum a čas vyplnený.';
    else if (d.getTime() <= Date.now()) errors.scheduled_at = 'Naplánovaný čas musí byť v budúcnosti.';
    else value.scheduled_at = d;
  } else {
    value.scheduled_at = null;
  }

  value.is_featured = input.is_featured ? 1 : 0;

  const excerpt = String(input.excerpt || '').trim();
  if (excerpt.length > 5000) errors.excerpt = 'Krátky popis môže mať max 5000 znakov.';
  value.excerpt = excerpt || null;

  if (input.cover_media_id === '' || input.cover_media_id === null || input.cover_media_id === undefined) {
    value.cover_media_id = null;
  } else {
    const cm = Number(input.cover_media_id);
    if (!Number.isInteger(cm) || cm < 1) errors.cover_media_id = 'Neplatné ID obrázka pre cover.';
    else value.cover_media_id = cm;
  }

  // SEO
  const seoTitle = String(input.seo_title || '').trim();
  if (seoTitle.length > 255) errors.seo_title = 'SEO title max 255 znakov.';
  value.seo_title = seoTitle || null;

  const seoDesc = String(input.seo_description || '').trim();
  if (seoDesc.length > 320) errors.seo_description = 'SEO description max 320 znakov.';
  value.seo_description = seoDesc || null;

  if (input.og_image_media_id === '' || input.og_image_media_id === null || input.og_image_media_id === undefined) {
    value.og_image_media_id = null;
  } else {
    const og = Number(input.og_image_media_id);
    if (!Number.isInteger(og) || og < 1) errors.og_image_media_id = 'Neplatné ID OG obrázka.';
    else value.og_image_media_id = og;
  }

  // Phase 5.6 — default_related_strategy
  const strategy = String(input.default_related_strategy || 'both').trim();
  if (!RELATED_STRATEGIES.includes(strategy)) {
    errors.default_related_strategy = 'Neplatná stratégia súvisiacich článkov.';
  }
  value.default_related_strategy = strategy;

  return { value, errors };
}

function parseContentJson(input) {
  const raw = input.content_json;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return null; }
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
 * Parse related articles z form-u: pole id-iek v poradí.
 * Form posiela `related_ids` ako pole: ['5', '12', '3', ...].
 *
 * Vráti pole čísel v poradí (display_order = index).
 */
function parseRelatedIds(raw, ownArticleId) {
  if (raw === undefined || raw === null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const v of arr) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0 && n !== ownArticleId && !out.includes(n)) {
      out.push(n);
    }
    if (out.length >= 20) break; // hard cap
  }
  return out;
}

function toDatetimeLocalString(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
    + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

module.exports = {
  TYPES, STATUSES, ALLOWED_STATUS_TRANSITIONS, RELATED_STRATEGIES,
  slugifyArticle, ensureUniqueArticleSlug,
  validateArticleMeta, parseContentJson, parseIdList, parseRelatedIds,
  parseLocalDatetime, toDatetimeLocalString,
};
