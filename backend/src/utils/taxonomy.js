/**
 * Taxonómia — utility funkcie
 *
 * Phase 4.1
 *
 * Spoločná logika pre rubriky, kategórie, tagy:
 *   - slug generation (zo slugify package)
 *   - ensure unique slug (s pridaním -2, -3, …)
 *   - validácia inputov pre rubriky a tagy
 *   - paleta farieb pre tagy
 */

'use strict';

const slugify = require('slugify');

const db = require('../db');

// ---------------------------------------------------------------------------
// Konštanty
// ---------------------------------------------------------------------------

/**
 * Paleta pekných farieb pre tagy. Použije sa keď admin nezadá farbu —
 * pri vytvorení dostane tag náhodnú farbu z tejto palety.
 *
 * Farby vybrané tak, aby boli rozlíšiteľné a kontrastné na bielom aj
 * tmavom pozadí.
 */
const TAG_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // purple
];

/** Hex regex (#RRGGBB, lowercase alebo uppercase) */
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Slug regex (a-z, 0-9, hyphen) */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

/**
 * Vytvor slug z reťazca.
 * `slugify` vie diakritiku (Žilina → zilina), strip špeciálnych znakov, atď.
 */
function slugifyName(name, { maxLen = 120 } = {}) {
  if (!name || typeof name !== 'string') return '';
  const slug = slugify(name, {
    lower: true,
    strict: true, // odstráni všetko okrem [a-z0-9-]
    locale: 'sk',
    trim: true,
    replacement: '-',
  });
  return slug.slice(0, maxLen).replace(/^-+|-+$/g, '');
}

/**
 * Zaistí unikátny slug v danej tabuľke.
 *
 *   ensureUniqueSlug('rubrics', 'recenzie')
 *     → 'recenzie' ak voľný, inak 'recenzie-2', 'recenzie-3', …
 *
 *   excludeId: pri editácii — ignorovať vlastný riadok
 */
async function ensureUniqueSlug(tableName, baseSlug, excludeId = null) {
  if (!baseSlug) {
    throw new Error('ensureUniqueSlug: prázdny baseSlug');
  }

  // skús base slug
  let candidate = baseSlug;
  let suffix = 1;

  // safety break — max 1000 pokusov, potom error
  while (suffix < 1000) {
    const q = db(tableName).where('slug', candidate);
    if (excludeId !== null) {
      q.whereNot('id', excludeId);
    }
    const existing = await q.first();
    if (!existing) {
      return candidate;
    }
    suffix += 1;
    candidate = baseSlug + '-' + suffix;
    // ak by base bol blízko 120 chars, môže overflowovať
    if (candidate.length > 120) {
      candidate = baseSlug.slice(0, 120 - String(suffix).length - 1) + '-' + suffix;
    }
  }

  throw new Error('ensureUniqueSlug: nepodarilo sa nájsť voľný slug');
}

// ---------------------------------------------------------------------------
// Validácia — rubrika
// ---------------------------------------------------------------------------

/**
 * Validuje a normalizuje vstup pre rubriku.
 * Vráti { value, errors } — value sú očistené dáta, errors je objekt
 * { fieldName: 'message' } (prázdny ak OK).
 *
 * Stĺpce: name (1-80), slug (auto, 1-120), description (text), display_order (int)
 */
function validateRubric(input) {
  const errors = {};
  const value = {};

  // name
  const name = String(input.name || '').trim();
  if (!name) {
    errors.name = 'Názov je povinný.';
  } else if (name.length > 80) {
    errors.name = 'Názov môže mať max 80 znakov.';
  }
  value.name = name;

  // slug — voliteľný; ak prázdny, vygeneruje sa neskôr zo name
  const slugRaw = String(input.slug || '').trim().toLowerCase();
  if (slugRaw) {
    if (!SLUG_RE.test(slugRaw)) {
      errors.slug = 'Slug môže obsahovať len malé písmená a-z, číslice a pomlčky.';
    } else if (slugRaw.length > 120) {
      errors.slug = 'Slug môže mať max 120 znakov.';
    }
  }
  value.slug = slugRaw; // môže byť '' — caller doplní

  // description
  const description = String(input.description || '').trim();
  value.description = description || null;

  // display_order
  const displayOrderRaw = input.display_order;
  if (displayOrderRaw === undefined || displayOrderRaw === null || displayOrderRaw === '') {
    value.display_order = 0;
  } else {
    const n = Number(displayOrderRaw);
    if (!Number.isInteger(n) || n < 0 || n > 99999) {
      errors.display_order = 'Poradie musí byť celé číslo 0–99999.';
    } else {
      value.display_order = n;
    }
  }

  return { value, errors };
}

// ---------------------------------------------------------------------------
// Validácia — tag
// ---------------------------------------------------------------------------

/**
 * Validuje a normalizuje vstup pre tag.
 *
 * Stĺpce: name (1-64), slug (auto, 1-120), color (#RRGGBB alebo NULL),
 *         description (text)
 */
function validateTag(input) {
  const errors = {};
  const value = {};

  // name
  const name = String(input.name || '').trim();
  if (!name) {
    errors.name = 'Názov je povinný.';
  } else if (name.length > 64) {
    errors.name = 'Názov môže mať max 64 znakov.';
  }
  value.name = name;

  // slug
  const slugRaw = String(input.slug || '').trim().toLowerCase();
  if (slugRaw) {
    if (!SLUG_RE.test(slugRaw)) {
      errors.slug = 'Slug môže obsahovať len malé písmená a-z, číslice a pomlčky.';
    } else if (slugRaw.length > 120) {
      errors.slug = 'Slug môže mať max 120 znakov.';
    }
  }
  value.slug = slugRaw;

  // color — ak prázdny string, ostane null (caller môže doplniť random)
  const colorRaw = String(input.color || '').trim();
  if (colorRaw) {
    if (!HEX_COLOR_RE.test(colorRaw)) {
      errors.color = 'Farba musí byť v tvare #RRGGBB (napr. #3b82f6).';
    } else {
      // normalizuj na lowercase
      value.color = colorRaw.toLowerCase();
    }
  } else {
    value.color = null;
  }

  // description
  const description = String(input.description || '').trim();
  value.description = description || null;

  return { value, errors };
}

// ---------------------------------------------------------------------------
// Farby — random z palety
// ---------------------------------------------------------------------------

function randomTagColor() {
  const i = Math.floor(Math.random() * TAG_COLOR_PALETTE.length);
  return TAG_COLOR_PALETTE[i];
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  TAG_COLOR_PALETTE,
  slugifyName,
  ensureUniqueSlug,
  validateRubric,
  validateTag,
  randomTagColor,
};
