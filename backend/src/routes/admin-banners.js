/**
 * Admin banners routes  (mounted at /admin/banners)
 *
 * GET  /              — zoznam
 * GET  /create        — formulár
 * POST /create        — uloženie
 * GET  /:id/edit      — editácia
 * POST /:id/edit      — update
 * POST /:id/delete    — zmazanie
 * POST /:id/toggle    — active/paused toggle
 */

'use strict';

const express = require('express');

const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { generateToken } = require('../middleware/csrf');
const bannerStatsUtil = require('../utils/banner-stats');

const router = express.Router();
router.use(requireAuth());
router.use(requireRole('admin'));

const PER_PAGE = 20;

// ---------------------------------------------------------------------------
// Šablóny — definícia polí pre template bannery
// ---------------------------------------------------------------------------

const TEMPLATES = {
  'promo-brand': {
    label: 'Produkt / Značka',
    description: 'Sponzorovaný produkt s obrázkom a CTA',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow (napr. "Partner · Apple")', type: 'text' },
      { key: 'title', label: 'Titulok', type: 'text', required: true },
      { key: 'description', label: 'Popis', type: 'textarea' },
      { key: 'sponsor_text', label: 'Sponzor text (malý)', type: 'text' },
      { key: 'cta_label', label: 'CTA button text', type: 'text' },
      { key: 'cta_url', label: 'CTA odkaz', type: 'url' },
      { key: 'product_media_id', label: 'Obrázok produktu', type: 'media' },
      {
        key: 'bg_color',
        label: 'Farba pozadia (CSS)',
        type: 'text',
        placeholder: 'oklch(0.22 0.03 260)',
      },
    ],
  },
  'promo-app': {
    label: 'Aplikácia / Download',
    description: 'Promo na stiahnutie appky so štatistikami',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
      { key: 'title', label: 'Titulok', type: 'text', required: true },
      { key: 'description', label: 'Popis', type: 'textarea' },
      { key: 'cta1_label', label: 'CTA 1 text', type: 'text' },
      { key: 'cta1_url', label: 'CTA 1 odkaz', type: 'url' },
      { key: 'cta2_label', label: 'CTA 2 text', type: 'text' },
      { key: 'cta2_url', label: 'CTA 2 odkaz', type: 'url' },
      { key: 'stat1_num', label: 'Štatistika 1 — číslo', type: 'text' },
      { key: 'stat1_label', label: 'Štatistika 1 — popis', type: 'text' },
      { key: 'stat2_num', label: 'Štatistika 2 — číslo', type: 'text' },
      { key: 'stat2_label', label: 'Štatistika 2 — popis', type: 'text' },
      { key: 'stat3_num', label: 'Štatistika 3 — číslo', type: 'text' },
      { key: 'stat3_label', label: 'Štatistika 3 — popis', type: 'text' },
    ],
  },
  'promo-cross': {
    label: 'Externý odkaz / Podcast',
    description: 'Promo s viacerými CTA buttonmi',
    fields: [
      { key: 'badge_text', label: 'Badge text (napr. "Externý odkaz")', type: 'text' },
      { key: 'meta_text', label: 'Meta text (napr. URL)', type: 'text' },
      { key: 'title', label: 'Titulok', type: 'text', required: true },
      { key: 'description', label: 'Popis', type: 'textarea' },
      { key: 'cta1_label', label: 'CTA 1 text', type: 'text' },
      { key: 'cta1_url', label: 'CTA 1 odkaz', type: 'url' },
      { key: 'cta2_label', label: 'CTA 2 text', type: 'text' },
      { key: 'cta2_url', label: 'CTA 2 odkaz', type: 'url' },
      { key: 'cta3_label', label: 'CTA 3 text', type: 'text' },
      { key: 'cta3_url', label: 'CTA 3 odkaz', type: 'url' },
      {
        key: 'bg_color',
        label: 'Farba pozadia (CSS)',
        type: 'text',
        placeholder: 'oklch(0.22 0.03 260)',
      },
    ],
  },
  newsletter: {
    label: 'Newsletter',
    description: 'Newsletter prihlásenie s emailovým formulárom',
    fields: [
      { key: 'eyebrow', label: 'Eyebrow (napr. "Newsletter · Každý piatok")', type: 'text' },
      { key: 'title', label: 'Titulok', type: 'text', required: true },
      { key: 'description', label: 'Popis', type: 'textarea' },
      {
        key: 'placeholder',
        label: 'Email placeholder',
        type: 'text',
        placeholder: 'tvoj@email.sk',
      },
      { key: 'cta_label', label: 'CTA button text', type: 'text' },
      { key: 'note', label: 'Poznámka pod formulárom', type: 'text' },
    ],
  },
};

// --- New banner templates ---
TEMPLATES['pro-membership'] = {
  label: 'Členstvo Pro',
  description: 'Výzva na predplatenie Pro členstva',
  fields: [
    { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
    { key: 'cta_label', label: 'CTA text', type: 'text' },
    { key: 'cta_url', label: 'CTA odkaz', type: 'url' },
    { key: 'bg_color', label: 'Farba pozadia', type: 'text', placeholder: 'oklch(0.22 0.03 260)' },
  ],
};
TEMPLATES['affiliate-product'] = {
  label: 'Affiliate produkt',
  description: 'Reklama na affiliate produkt',
  fields: [
    { key: 'title', label: 'Názov produktu', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
    { key: 'price', label: 'Cena', type: 'text' },
    { key: 'cta_label', label: 'CTA text', type: 'text' },
    { key: 'cta_url', label: 'Affiliate odkaz', type: 'url' },
    { key: 'product_media_id', label: 'Obrázok produktu', type: 'media' },
    { key: 'badge', label: 'Badge (napr. "Reklama")', type: 'text' },
  ],
};
TEMPLATES['inline-ad'] = {
  label: 'Inline reklama',
  description: 'Jednoduchá textová/obrázkova reklama',
  fields: [
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
    { key: 'cta_label', label: 'CTA text', type: 'text' },
    { key: 'cta_url', label: 'Odkaz', type: 'url' },
    { key: 'badge', label: 'Badge (napr. "Sponzorované")', type: 'text' },
  ],
};
TEMPLATES['related-article'] = {
  label: 'Súvisiaci článok',
  description: 'Odkaz na súvisiaci článok',
  fields: [
    { key: 'eyebrow', label: 'Eyebrow (napr. "Čítajte tiež")', type: 'text' },
    { key: 'title', label: 'Titulok článku', type: 'text', required: true },
    { key: 'description', label: 'Krátky popis', type: 'textarea' },
    { key: 'url', label: 'Odkaz na článok', type: 'url' },
  ],
};
TEMPLATES['alert-notice'] = {
  label: 'Upozornenie / Alert',
  description: 'Informačný banner s upozornením',
  fields: [
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Text upozornenia', type: 'textarea' },
    {
      key: 'style',
      label: 'Štýl (info / warning / error / success)',
      type: 'text',
      placeholder: 'info',
    },
    { key: 'cta_label', label: 'CTA text (voliteľné)', type: 'text' },
    { key: 'cta_url', label: 'CTA odkaz', type: 'url' },
  ],
};
TEMPLATES['video-embed'] = {
  label: 'Video / YouTube embed',
  description: 'Embednuté YouTube video',
  fields: [
    { key: 'title', label: 'Titulok', type: 'text' },
    { key: 'video_id', label: 'YouTube Video ID', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
  ],
};
TEMPLATES['countdown'] = {
  label: 'Countdown timer',
  description: 'Odpočet do udalosti / akcie',
  fields: [
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
    {
      key: 'target_date',
      label: 'Cieľový dátum (ISO)',
      type: 'text',
      placeholder: '2026-12-31T23:59:59',
    },
    { key: 'cta_label', label: 'CTA text', type: 'text' },
    { key: 'cta_url', label: 'CTA odkaz', type: 'url' },
  ],
};
TEMPLATES['pull-quote'] = {
  label: 'Citát / Pull quote',
  description: 'Výrazný citát v článku',
  fields: [
    { key: 'text', label: 'Text citátu', type: 'textarea', required: true },
    { key: 'author', label: 'Autor', type: 'text' },
  ],
};
TEMPLATES['discord'] = {
  label: 'Discord komunita',
  description: 'Výzva na pripojenie do Discord servera',
  fields: [
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
    { key: 'cta_label', label: 'CTA text', type: 'text', placeholder: 'Pridaj sa' },
    { key: 'cta_url', label: 'Discord odkaz', type: 'url' },
    { key: 'members_count', label: 'Počet členov', type: 'text' },
  ],
};
TEMPLATES['deal-promo'] = {
  label: 'Akcia / Zľava',
  description: 'Reklama na zľavu alebo akciu',
  fields: [
    { key: 'badge', label: 'Badge (napr. "-30%")', type: 'text' },
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
    { key: 'original_price', label: 'Pôvodná cena', type: 'text' },
    { key: 'sale_price', label: 'Akciová cena', type: 'text' },
    { key: 'cta_label', label: 'CTA text', type: 'text' },
    { key: 'cta_url', label: 'Odkaz', type: 'url' },
  ],
};
TEMPLATES['testimonials'] = {
  label: 'Testimonials',
  description: 'Riadok recenzií / testimonials',
  fields: [
    { key: 'title', label: 'Titulok sekcie', type: 'text' },
    { key: 't1_text', label: 'Testimonial 1 text', type: 'textarea' },
    { key: 't1_author', label: 'Testimonial 1 autor', type: 'text' },
    { key: 't2_text', label: 'Testimonial 2 text', type: 'textarea' },
    { key: 't2_author', label: 'Testimonial 2 autor', type: 'text' },
    { key: 't3_text', label: 'Testimonial 3 text', type: 'textarea' },
    { key: 't3_author', label: 'Testimonial 3 autor', type: 'text' },
  ],
};
TEMPLATES['social-share'] = {
  label: 'Social share',
  description: 'Výzva na zdieľanie na sociálnych sieťach',
  fields: [
    { key: 'title', label: 'Titulok', type: 'text', required: true },
    { key: 'description', label: 'Popis', type: 'textarea' },
  ],
};

// Export pre použitie v iných moduloch (frontend rendering)
router.TEMPLATES = TEMPLATES;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function buildFlash(req) {
  return {
    success: req.query.success ? String(req.query.success) : null,
    err: req.query.err ? String(req.query.err) : null,
  };
}

async function loadPositions() {
  return db('banner_positions').orderBy('id');
}

/**
 * Parsuje template_data z request body.
 * Očakáva polia vo formáte td_<key> (napr. td_title, td_eyebrow).
 */
function parseTemplateData(body, templateKey) {
  const tpl = TEMPLATES[templateKey];
  if (!tpl) return {};
  const data = {};
  for (const field of tpl.fields) {
    const raw = body['td_' + field.key];
    data[field.key] = typeof raw === 'string' ? raw.trim() : '';
  }
  return data;
}

/**
 * Validuje a vracia banner dáta z request body.
 */
function parseBannerInput(body) {
  const errors = {};
  const name = String(body.name || '')
    .trim()
    .slice(0, 160);
  if (!name) errors.name = 'Názov je povinný.';

  const type = ['image', 'template', 'custom'].includes(body.type) ? body.type : 'image';
  const status = body.status === 'paused' ? 'paused' : 'active';

  const starts_at = body.starts_at || null;
  const ends_at = body.ends_at || null;

  // Type-specific
  let image_media_id = null;
  let link_url = null;
  let alt_text = null;
  let template_key = null;
  let template_data = null;
  let custom_code = null;

  if (type === 'image') {
    image_media_id = parseId(body.image_media_id);
    if (!image_media_id) errors.image_media_id = 'Obrázok je povinný.';
    link_url =
      String(body.link_url || '')
        .trim()
        .slice(0, 500) || null;
    alt_text =
      String(body.alt_text || '')
        .trim()
        .slice(0, 255) || null;
  } else if (type === 'template') {
    template_key = body.template_key;
    if (!TEMPLATES[template_key]) {
      errors.template_key = 'Neplatná šablóna.';
    } else {
      template_data = parseTemplateData(body, template_key);
      // Validuj required polia šablóny
      const tpl = TEMPLATES[template_key];
      for (const field of tpl.fields) {
        if (field.required && !template_data[field.key]) {
          errors['td_' + field.key] = `${field.label} je povinné pole.`;
        }
      }
    }
  } else if (type === 'custom') {
    custom_code = String(body.custom_code || '').trim();
    if (!custom_code) errors.custom_code = 'HTML kód je povinný.';
  }

  // Placements
  let positionIds = body.position_ids || [];
  if (typeof positionIds === 'string') positionIds = [positionIds];
  positionIds = positionIds.map(Number).filter((n) => Number.isInteger(n) && n > 0);

  return {
    data: {
      name,
      type,
      status,
      starts_at,
      ends_at,
      image_media_id,
      link_url,
      alt_text,
      template_key,
      template_data: template_data ? JSON.stringify(template_data) : null,
      custom_code,
    },
    positionIds,
    errors: Object.keys(errors).length > 0 ? errors : null,
  };
}

// ---------------------------------------------------------------------------
// LIST
// ---------------------------------------------------------------------------

const TABS = [
  { key: 'all', label: 'Všetky' },
  { key: 'active', label: 'Aktívne' },
  { key: 'paused', label: 'Pozastavené' },
];

router.get('/', async (req, res, next) => {
  try {
    const activeTab = TABS.find((t) => t.key === req.query.tab)?.key || 'all';
    const q = String(req.query.q || '')
      .trim()
      .slice(0, 200);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const offset = (page - 1) * PER_PAGE;

    const buildWhere = (qb) => {
      if (activeTab === 'active') qb.where('banners.status', 'active');
      if (activeTab === 'paused') qb.where('banners.status', 'paused');
      if (q) qb.where('banners.name', 'like', `%${q}%`);
      return qb;
    };

    const countRow = await buildWhere(db('banners')).count({ c: '*' }).first();
    const total = Number(countRow.c);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    const rows = await buildWhere(
      db('banners').leftJoin('media', 'banners.image_media_id', 'media.id')
    )
      .select('banners.*', 'media.thumbnail_path')
      .orderBy('banners.created_at', 'desc')
      .limit(PER_PAGE)
      .offset(offset);

    // Enrichment — pozície pre každý banner
    const bannerIds = rows.map((r) => r.id);
    let placementsMap = new Map();
    if (bannerIds.length > 0) {
      const placements = await db('banner_placements')
        .join('banner_positions', 'banner_placements.position_id', 'banner_positions.id')
        .whereIn('banner_placements.banner_id', bannerIds)
        .select('banner_placements.banner_id', 'banner_positions.label');
      for (const p of placements) {
        if (!placementsMap.has(p.banner_id)) placementsMap.set(p.banner_id, []);
        placementsMap.get(p.banner_id).push(p.label);
      }
    }
    rows.forEach((r) => {
      r.positions = placementsMap.get(r.id) || [];
    });

    // Stats
    const statsMap = await bannerStatsUtil.getListStats(bannerIds);
    rows.forEach((r) => {
      const s = statsMap.get(r.id) || { views: 0, clicks: 0, ctr: 0 };
      r.stats = s;
    });

    // Tab counts
    const counts = {};
    counts.all = await db('banners')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    counts.active = await db('banners')
      .where('status', 'active')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));
    counts.paused = await db('banners')
      .where('status', 'paused')
      .count({ c: '*' })
      .first()
      .then((r) => Number(r.c));

    res.render('admin/banners/index', {
      title: 'Bannery',
      currentPath: '/admin/banners',
      pageTitle: 'Bannery',
      banners: rows,
      tabs: TABS,
      activeTab,
      counts,
      query: { q, page, tab: activeTab },
      pagination: { total, totalPages, page, perPage: PER_PAGE },
      flash: buildFlash(req),
      csrfToken: generateToken(req, res),
      TEMPLATES,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

router.get('/create', async (req, res, next) => {
  try {
    const positions = await loadPositions();
    res.render('admin/banners/edit', {
      title: 'Nový banner',
      currentPath: '/admin/banners',
      pageTitle: 'Nový banner',
      banner: { type: 'image', status: 'active', template_data: '{}' },
      positions,
      selectedPositions: [],
      errors: {},
      isNew: true,
      csrfToken: generateToken(req, res),
      TEMPLATES,
      flash: buildFlash(req),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/create', async (req, res, next) => {
  try {
    const { data, positionIds, errors } = parseBannerInput(req.body);
    const positions = await loadPositions();

    if (errors) {
      return res.status(400).render('admin/banners/edit', {
        title: 'Nový banner',
        currentPath: '/admin/banners',
        pageTitle: 'Nový banner',
        banner: { ...data, template_data: data.template_data || '{}' },
        positions,
        selectedPositions: positionIds,
        errors,
        isNew: true,
        csrfToken: generateToken(req, res),
        TEMPLATES,
        flash: { success: null, err: null },
      });
    }

    const [id] = await db('banners').insert(data);

    // Placements
    if (positionIds.length > 0) {
      const placements = positionIds.map((pid) => ({
        banner_id: id,
        position_id: pid,
        target_type: 'global',
      }));
      await db('banner_placements').insert(placements);
    }

    log.info('banner created', { id, name: data.name, type: data.type, adminId: req.user.id });
    res.redirect('/admin/banners?success=Banner bol vytvorený');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// EDIT
// ---------------------------------------------------------------------------

router.get('/:id/edit', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/banners');

    const banner = await db('banners').where('id', id).first();
    if (!banner) return res.redirect('/admin/banners?err=Banner nenájdený');

    const positions = await loadPositions();
    const placements = await db('banner_placements').where('banner_id', id).select('position_id');
    const selectedPositions = placements.map((p) => p.position_id);

    res.render('admin/banners/edit', {
      title: 'Upraviť banner',
      currentPath: '/admin/banners',
      pageTitle: 'Upraviť banner',
      banner,
      positions,
      selectedPositions,
      errors: {},
      isNew: false,
      csrfToken: generateToken(req, res),
      TEMPLATES,
      flash: buildFlash(req),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/edit', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/banners');

    const existing = await db('banners').where('id', id).first();
    if (!existing) return res.redirect('/admin/banners?err=Banner nenájdený');

    const { data, positionIds, errors } = parseBannerInput(req.body);
    const positions = await loadPositions();

    if (errors) {
      return res.status(400).render('admin/banners/edit', {
        title: 'Upraviť banner',
        currentPath: '/admin/banners',
        pageTitle: 'Upraviť banner',
        banner: { id, ...data, template_data: data.template_data || '{}' },
        positions,
        selectedPositions: positionIds,
        errors,
        isNew: false,
        csrfToken: generateToken(req, res),
        TEMPLATES,
        flash: { success: null, err: null },
      });
    }

    await db('banners').where('id', id).update(data);

    // Sync placements — delete + insert
    await db('banner_placements').where('banner_id', id).del();
    if (positionIds.length > 0) {
      const placements = positionIds.map((pid) => ({
        banner_id: id,
        position_id: pid,
        target_type: 'global',
      }));
      await db('banner_placements').insert(placements);
    }

    log.info('banner updated', { id, name: data.name, adminId: req.user.id });
    res.redirect(`/admin/banners/${id}/edit?success=Banner bol uložený`);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// TOGGLE STATUS
// ---------------------------------------------------------------------------

router.post('/:id/toggle', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/banners?err=Neplatné ID');

    const banner = await db('banners').where('id', id).first();
    if (!banner) return res.redirect('/admin/banners?err=Banner nenájdený');

    const newStatus = banner.status === 'active' ? 'paused' : 'active';
    await db('banners').where('id', id).update({ status: newStatus });

    log.info('banner toggled', { id, status: newStatus, adminId: req.user.id });
    res.redirect('/admin/banners?success=Stav banneru zmenený');
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.redirect('/admin/banners?err=Neplatné ID');

    await db('banners').where('id', id).del();
    log.info('banner deleted', { id, adminId: req.user.id });
    res.redirect('/admin/banners?success=Banner bol zmazaný');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
