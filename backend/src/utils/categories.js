/**
 * Categories — utility funkcie  (Phase 4.2)
 *
 * Hierarchické kategórie s materializovaným `path`.
 * Bez limitu hĺbky, ale `path` má max 500 znakov v DB.
 *
 * Funkcie:
 *   buildPath(parentPath, slug)     → string
 *   listAllSorted(knex)             → [{...row, depth}], sorted by path
 *   listAllowedParents(knex, id)    → [{...row, depth, label}] bez self+descendants
 *   recomputeDescendantPaths(knex, oldPath, newPath) → updates rows
 *   wouldCreateCycle(knex, id, newParentId) → bool
 *   validateCategory(input)         → { value, errors }
 */

'use strict';

const slugify = require('slugify');

// ---------------------------------------------------------------------------
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATH_MAX = 500;

function slugifyName(name, maxLen = 120) {
  if (!name || typeof name !== 'string') return '';
  return slugify(name, { lower: true, strict: true, locale: 'sk', trim: true, replacement: '-' })
    .slice(0, maxLen)
    .replace(/^-+|-+$/g, '');
}

function buildPath(parentPath, slug) {
  return parentPath ? parentPath + '/' + slug : slug;
}

function depthOf(path) {
  if (!path) return 0;
  return (path.match(/\//g) || []).length;
}

// ---------------------------------------------------------------------------
async function listAllSorted(knex) {
  const rows = await knex('categories')
    .select('*')
    .orderBy('path', 'asc');
  return rows.map((r) => ({ ...r, depth: depthOf(r.path) }));
}

/**
 * Pre parent select: vráti všetky kategórie OKREM:
 *   - kategórie s id=excludeId
 *   - jej descendantov (zabráni cyklom)
 *
 * Každý riadok dostane `label` s odsadením podľa depth (em-dashy).
 */
async function listAllowedParents(knex, excludeId = null) {
  const all = await listAllSorted(knex);

  let excludeSelf = null;
  let excludePathPrefix = null;
  if (excludeId !== null) {
    excludeSelf = all.find((r) => r.id === Number(excludeId));
    if (excludeSelf) {
      excludePathPrefix = excludeSelf.path + '/';
    }
  }

  return all
    .filter((r) => {
      if (excludeSelf && r.id === excludeSelf.id) return false;
      if (excludePathPrefix && r.path.startsWith(excludePathPrefix)) return false;
      return true;
    })
    .map((r) => ({
      ...r,
      label: '— '.repeat(r.depth) + r.name,
    }));
}

// ---------------------------------------------------------------------------
/**
 * Po zmene self.path z oldPath → newPath prepočítaj všetky descendants
 * tak, aby ich path-y mali nový prefix.
 *
 *   oldPath = 'telefony/android'
 *   newPath = 'mobily/android'
 *   → 'telefony/android/samsung' → 'mobily/android/samsung'
 *
 * V transakcii (caller poskytne `trx`).
 */
async function recomputeDescendantPaths(trx, oldPath, newPath) {
  if (oldPath === newPath) return 0;

  const oldPrefix = oldPath + '/';
  const newPrefix = newPath + '/';

  // Vypočítané v aplikácii — nedáme to ako jeden raw UPDATE s SUBSTRING,
  // lebo MariaDB by stále musela validovať PATH_MAX. Bezpečnejšie:
  // načítať dotknuté, prerátať, batch update.
  const descendants = await trx('categories')
    .where('path', 'like', oldPrefix + '%')
    .select('id', 'path');

  let updated = 0;
  for (const d of descendants) {
    const newP = newPrefix + d.path.slice(oldPrefix.length);
    if (newP.length > PATH_MAX) {
      throw new Error(`Path "${newP}" by prekročil ${PATH_MAX} znakov.`);
    }
    await trx('categories').where('id', d.id).update({ path: newP });
    updated += 1;
  }
  return updated;
}

/**
 * Kontrola cyklov: novyParentId nesmie byť self ani descendant.
 *
 * Vráti `true` ak by zmena vytvorila cyklus.
 */
async function wouldCreateCycle(knex, selfId, newParentId) {
  if (newParentId === null || newParentId === undefined || newParentId === '') return false;
  selfId = Number(selfId);
  newParentId = Number(newParentId);
  if (selfId === newParentId) return true;

  const self = await knex('categories').where('id', selfId).first();
  if (!self) return false;
  const newParent = await knex('categories').where('id', newParentId).first();
  if (!newParent) return false;

  // Ak path nového parenta začína našou path + '/', tak by sa stal naším potomkom
  return newParent.path === self.path || newParent.path.startsWith(self.path + '/');
}

// ---------------------------------------------------------------------------
function validateCategory(input) {
  const errors = {};
  const value = {};

  const name = String(input.name || '').trim();
  if (!name) errors.name = 'Názov je povinný.';
  else if (name.length > 80) errors.name = 'Názov môže mať max 80 znakov.';
  value.name = name;

  const slugRaw = String(input.slug || '').trim().toLowerCase();
  if (slugRaw) {
    if (!SLUG_RE.test(slugRaw)) errors.slug = 'Slug môže obsahovať len a-z, 0-9 a pomlčky.';
    else if (slugRaw.length > 120) errors.slug = 'Slug môže mať max 120 znakov.';
  }
  value.slug = slugRaw;

  // parent_id — '' / '0' / null = root (NULL v DB)
  const pidRaw = input.parent_id;
  if (pidRaw === undefined || pidRaw === null || pidRaw === '' || pidRaw === '0') {
    value.parent_id = null;
  } else {
    const pid = Number(pidRaw);
    if (!Number.isInteger(pid) || pid < 1) {
      errors.parent_id = 'Neplatná nadradená kategória.';
    } else {
      value.parent_id = pid;
    }
  }

  const description = String(input.description || '').trim();
  value.description = description || null;

  const doRaw = input.display_order;
  if (doRaw === undefined || doRaw === null || doRaw === '') {
    value.display_order = 0;
  } else {
    const n = Number(doRaw);
    if (!Number.isInteger(n) || n < 0 || n > 99999) {
      errors.display_order = 'Poradie musí byť 0–99999.';
    } else {
      value.display_order = n;
    }
  }

  return { value, errors };
}

// ---------------------------------------------------------------------------
async function ensureUniqueCategorySlug(knex, baseSlug, excludeId = null) {
  if (!baseSlug) throw new Error('ensureUniqueCategorySlug: prázdny baseSlug');
  let candidate = baseSlug;
  let suffix = 1;
  while (suffix < 1000) {
    const q = knex('categories').where('slug', candidate);
    if (excludeId !== null) q.whereNot('id', excludeId);
    const existing = await q.first();
    if (!existing) return candidate;
    suffix += 1;
    candidate = baseSlug + '-' + suffix;
    if (candidate.length > 120) {
      candidate = baseSlug.slice(0, 120 - String(suffix).length - 1) + '-' + suffix;
    }
  }
  throw new Error('ensureUniqueCategorySlug: nedaril sa nájsť voľný slug');
}

module.exports = {
  slugifyName,
  buildPath,
  depthOf,
  listAllSorted,
  listAllowedParents,
  recomputeDescendantPaths,
  wouldCreateCycle,
  validateCategory,
  ensureUniqueCategorySlug,
};
