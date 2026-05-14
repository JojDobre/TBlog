/**
 * Pages utility  (Phase 2 — static pages)
 *
 * Validácia, slug, šablóny, sanitizácia page-specific blokov.
 */

'use strict';

const taxonomy = require('./taxonomy');

const TEMPLATES = ['default', 'about', 'contact', 'legal'];
const STATUSES = ['draft', 'published'];
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

function slugifyPage(name) {
  return taxonomy.slugifyName(name, { maxLen: 120 });
}

async function ensureUniquePageSlug(knex, baseSlug, excludeId = null) {
  return taxonomy.ensureUniqueSlug('pages', baseSlug, excludeId);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePageMeta(input, { isNew = true } = {}) {
  const errors = {};
  const value = {};

  const title = String(input.title || '').trim();
  if (!title) errors.title = 'Názov je povinný.';
  else if (title.length > 255) errors.title = 'Názov môže mať max 255 znakov.';
  value.title = title;

  const slugRaw = String(input.slug || '')
    .trim()
    .toLowerCase();
  if (slugRaw) {
    if (!SLUG_RE.test(slugRaw)) errors.slug = 'Slug môže obsahovať len a-z, 0-9 a pomlčky.';
    else if (slugRaw.length > 120) errors.slug = 'Slug môže mať max 120 znakov.';
  }
  value.slug = slugRaw;

  const template = String(input.template || 'default').trim();
  if (!TEMPLATES.includes(template)) errors.template = 'Neplatná šablóna.';
  value.template = template;

  const status = String(input.status || 'draft').trim();
  if (!STATUSES.includes(status)) errors.status = 'Neplatný stav.';
  value.status = status;

  value.show_in_footer = input.show_in_footer ? 1 : 0;
  value.show_in_header = input.show_in_header ? 1 : 0;

  const order = parseInt(input.display_order, 10);
  value.display_order = Number.isFinite(order) ? order : 0;

  // SEO
  const seoTitle = String(input.seo_title || '').trim();
  if (seoTitle.length > 255) errors.seo_title = 'SEO title max 255 znakov.';
  value.seo_title = seoTitle || null;

  const seoDesc = String(input.seo_description || '').trim();
  if (seoDesc.length > 320) errors.seo_description = 'SEO description max 320 znakov.';
  value.seo_description = seoDesc || null;

  return { value, errors };
}

// ---------------------------------------------------------------------------
// Content JSON parse
// ---------------------------------------------------------------------------

function parseContentJson(body) {
  const raw = body.content_json;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page-specific block types + sanitization
// ---------------------------------------------------------------------------

const PAGE_BLOCK_TYPES = [
  // standard (shared with articles)
  'paragraph',
  'heading',
  'image',
  'divider',
  // page-specific
  'sp_values',
  'sp_team',
  'sp_contact_cta',
  'sp_contact_form',
  'sp_channels',
  'sp_office',
  'sp_key_value',
  'sp_rights',
  'sp_cookies',
  'sp_summary',
  'sp_legal_meta',
];

function sanitizePageBlocks(raw) {
  const errors = [];
  if (!Array.isArray(raw)) return { blocks: [], errors: ['content_not_array'] };

  const blocks = [];
  raw.forEach((b, i) => {
    if (!b || typeof b !== 'object' || !PAGE_BLOCK_TYPES.includes(b.type)) {
      errors.push(`block[${i}]_invalid_type`);
      return;
    }
    const clean = sanitizeSinglePageBlock(b);
    if (clean) blocks.push(clean);
  });

  return { blocks, errors };
}

function sanitizeSinglePageBlock(b) {
  switch (b.type) {
    // ---- standard blocks ----
    case 'paragraph': {
      const text = String(b.text || '').slice(0, 20000);
      if (!text.trim()) return null;
      return { type: 'paragraph', text };
    }
    case 'heading': {
      const level = [2, 3].includes(Number(b.level)) ? Number(b.level) : 2;
      const text = String(b.text || '').slice(0, 255);
      if (!text.trim()) return null;
      return { type: 'heading', level, text };
    }
    case 'image': {
      const mediaId = Number(b.media_id);
      if (!Number.isInteger(mediaId) || mediaId < 1) return null;
      return {
        type: 'image',
        media_id: mediaId,
        alt: String(b.alt || '').slice(0, 255) || null,
        caption: String(b.caption || '').slice(0, 500) || null,
      };
    }
    case 'divider':
      return { type: 'divider' };

    // ---- page-specific blocks ----
    case 'sp_values': {
      const items = Array.isArray(b.items)
        ? b.items.slice(0, 20).map((it) => ({
            icon: String(it.icon || 'flame').slice(0, 40),
            title: String(it.title || '').slice(0, 160),
            desc: String(it.desc || '').slice(0, 500),
          }))
        : [];
      return { type: 'sp_values', items };
    }
    case 'sp_team': {
      const members = Array.isArray(b.members)
        ? b.members.slice(0, 30).map((m) => ({
            name: String(m.name || '').slice(0, 120),
            role: String(m.role || '').slice(0, 160),
            bio: String(m.bio || '').slice(0, 500),
          }))
        : [];
      return { type: 'sp_team', members };
    }
    case 'sp_contact_cta':
      return {
        type: 'sp_contact_cta',
        title: String(b.title || '').slice(0, 200),
        text: String(b.text || '').slice(0, 500),
        email: String(b.email || '').slice(0, 255),
        show_pgp: !!b.show_pgp,
      };
    case 'sp_contact_form':
      return { type: 'sp_contact_form' };
    case 'sp_channels': {
      const channels = Array.isArray(b.channels)
        ? b.channels.slice(0, 20).map((c) => ({
            icon: String(c.icon || 'send').slice(0, 40),
            label: String(c.label || '').slice(0, 80),
            value: String(c.value || '').slice(0, 255),
            note: String(c.note || '').slice(0, 160),
          }))
        : [];
      return { type: 'sp_channels', channels };
    }
    case 'sp_office':
      return {
        type: 'sp_office',
        address: String(b.address || '').slice(0, 255),
        description: String(b.description || '').slice(0, 1000),
        stats: Array.isArray(b.stats)
          ? b.stats.slice(0, 6).map((s) => ({
              value: String(s.value || '').slice(0, 40),
              label: String(s.label || '').slice(0, 80),
            }))
          : [],
        map_url: String(b.map_url || '').slice(0, 500),
      };
    case 'sp_key_value': {
      const items = Array.isArray(b.items)
        ? b.items.slice(0, 30).map((it) => ({
            key: String(it.key || '').slice(0, 200),
            value: String(it.value || '').slice(0, 1000),
          }))
        : [];
      return { type: 'sp_key_value', items };
    }
    case 'sp_rights': {
      const items = Array.isArray(b.items)
        ? b.items.slice(0, 20).map((it) => ({
            icon: String(it.icon || 'info').slice(0, 40),
            title: String(it.title || '').slice(0, 160),
            desc: String(it.desc || '').slice(0, 500),
          }))
        : [];
      return { type: 'sp_rights', items };
    }
    case 'sp_cookies': {
      const rows = Array.isArray(b.rows)
        ? b.rows.slice(0, 30).map((r) => ({
            name: String(r.name || '').slice(0, 80),
            purpose: String(r.purpose || '').slice(0, 255),
            ttl: String(r.ttl || '').slice(0, 60),
            cookie_type: String(r.cookie_type || 'Nutný').slice(0, 40),
          }))
        : [];
      return { type: 'sp_cookies', rows };
    }
    case 'sp_summary':
      return {
        type: 'sp_summary',
        tldr: String(b.tldr || '').slice(0, 500),
        body: String(b.body || '').slice(0, 5000),
      };
    case 'sp_legal_meta': {
      const items = Array.isArray(b.items)
        ? b.items.slice(0, 10).map((it) => ({
            label: String(it.label || '').slice(0, 80),
            value: String(it.value || '').slice(0, 255),
          }))
        : [];
      return { type: 'sp_legal_meta', items };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Template defaults — predvyplnené bloky pri vytvorení stránky so šablónou
// ---------------------------------------------------------------------------

function getTemplateDefaults(template) {
  switch (template) {
    case 'about':
      return [
        { type: 'paragraph', text: '' },
        {
          type: 'sp_values',
          items: [
            { icon: 'flame', title: 'Transparentnosť', desc: '' },
            { icon: 'scale', title: 'Férové porovnania', desc: '' },
            { icon: 'users', title: 'Komunita', desc: '' },
            { icon: 'rocket', title: 'Dlhodobosť', desc: '' },
          ],
        },
        {
          type: 'sp_team',
          members: [{ name: '', role: '', bio: '' }],
        },
        { type: 'paragraph', text: '' },
        { type: 'sp_contact_cta', title: '', text: '', email: '', show_pgp: false },
      ];

    case 'contact':
      return [
        { type: 'sp_contact_form' },
        {
          type: 'sp_channels',
          channels: [{ icon: 'send', label: 'Redakcia', value: '', note: '' }],
        },
        {
          type: 'sp_office',
          address: '',
          description: '',
          stats: [],
          map_url: '',
        },
      ];

    case 'legal':
      return [
        {
          type: 'sp_legal_meta',
          items: [
            { label: 'Prevádzkovateľ', value: '' },
            { label: 'IČO', value: '' },
          ],
        },
        {
          type: 'sp_summary',
          tldr: '',
          body: '',
        },
        { type: 'paragraph', text: '' },
      ];

    default:
      return [];
  }
}

module.exports = {
  TEMPLATES,
  STATUSES,
  PAGE_BLOCK_TYPES,
  slugifyPage,
  ensureUniquePageSlug,
  validatePageMeta,
  parseContentJson,
  sanitizePageBlocks,
  getTemplateDefaults,
};
