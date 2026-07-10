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

// --- HTML sanitizácia (DOMPurify + jsdom) ---------------------------------
// Singleton: jsdom window + DOMPurify sa vytvoria raz pri načítaní modulu.
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const DOMPurify = createDOMPurify(new JSDOM('').window);

// Externé odkazy automaticky dostanú target="_blank" + rel="noopener".
// Quill: ponechaj len bezpečné style (color/background-color) a ql-align triedy.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute && node.hasAttribute('style')) {
    const style = node.getAttribute('style');
    const m = style.match(
      /(?:^|;)\s*(color|background-color)\s*:\s*(rgb\([^)]+\)|#[0-9a-fA-F]{3,6}|[a-z]+)/gi
    );
    const safe = m ? m.map((s) => s.replace(/^;/, '').trim()) : [];
    if (safe.length) node.setAttribute('style', safe.join('; '));
    else node.removeAttribute('style');
  }
  if (node.hasAttribute && node.hasAttribute('class')) {
    const keep = (node.getAttribute('class').match(/ql-align-(center|right|justify)/g) || []).join(
      ' '
    );
    if (keep) node.setAttribute('class', keep);
    else node.removeAttribute('class');
  }
});

const HTML_SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'a',
    'ul',
    'ol',
    'li',
    'blockquote',
    'h2',
    'h3',
    'h4',
    'code',
    'pre',
    'span',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'class', 'data-list'],
  // povolené href schémy: http(s), mailto, relatívne — NIE javascript:/data:
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

function sanitizeHtml(html) {
  return DOMPurify.sanitize(String(html || ''), HTML_SANITIZE_OPTS);
}

const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'image',
  'divider',
  'youtube',
  'quote',
  'gallery',
  'full_gallery',
  'list',
  'section',
  'pros_cons',
  'specs',
  'rating',
  'rating_breakdown',
  'color_variants',
  'review_banner',
  'banner',
  'rvx_glance',
  'rvx_keyspecs',
  'rvx_quickstrip',
  'rvx_connect',
  'rvx_quotes',
  'rvx_versus',
  'rvx_gallery_full',
  'rvx_gallery_exif',
  'rvx_gallery_compare',
  'rvx_gallery_modes',
  'rvx_gallery_samples',
  'rvx_gallery_hero',
  'rvx_buyers',
  'rvx_deepdive',
  'rvx_bench',
  'rvx_timeline',
  'rvx_pricing',
  'rvx_hilo',
  'rvx_generations',
  'rvx_profile',
  'rvx_awards',
  'rvx_box',
  'rvx_experts',
  'rvx_usecases',
  'rvx_battery',
  'rvx_software',
  'rvx_design',
  'rvx_sustain',
  'rvx_accessories',
  'rvx_repair',
  'rvx_buy',
  'rvx_faq',
  'rvx_alts',
  'rvx_pricehist',
  'rvx_editornote',
  'rvx_method',
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
        const format = b.format === 'html' ? 'html' : 'md';
        const block = { type: 'paragraph', text };
        if (format === 'html') {
          block.format = 'html';
          block.text = sanitizeHtml(text);
        }
        blocks.push(block);
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
      case 'full_gallery': {
        // Automatická galéria všetkých obrázkov článku — nemá vlastné items
        const block = { type: 'full_gallery' };
        if (b.eyebrow) block.eyebrow = String(b.eyebrow).slice(0, 80).trim();
        if (b.title) block.title = String(b.title).slice(0, 255).trim();
        blocks.push(block);
        break;
      }
      case 'youtube': {
        const candidate = b.video_id || b.url || '';
        const videoId = extractYoutubeId(candidate);
        const block = { type: 'youtube', video_id: videoId || '' };
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
        if (b.format === 'html') {
          out.format = 'html';
          out.text = sanitizeHtml(String(b.text || '').slice(0, MAX_PARAGRAPH_LEN));
        } else {
          out.text = String(b.text || '').slice(0, MAX_PARAGRAPH_LEN);
        }
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
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
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
      case 'banner': {
        const bid = b.banner_id ? Number(b.banner_id) : null;
        if (bid && Number.isInteger(bid) && bid > 0) {
          blocks.push({ type: 'banner', banner_id: bid });
        }
        break;
      }
      case 'rvx_glance': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 6)
          .map((it) => ({
            icon: String(it.icon || 'check')
              .slice(0, 30)
              .trim(),
            title: String(it.title || '')
              .slice(0, 120)
              .trim(),
            text: String(it.text || '')
              .slice(0, 400)
              .trim(),
          }))
          .filter((it) => it.title);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_glance',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_keyspecs': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 12)
          .map((it) => ({
            num: String(it.num || '')
              .slice(0, 40)
              .trim(),
            label: String(it.label || '')
              .slice(0, 80)
              .trim(),
          }))
          .filter((it) => it.num);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_keyspecs',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_quickstrip': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 8)
          .map((it) => ({
            label: String(it.label || '')
              .slice(0, 60)
              .trim(),
            value: String(it.value || '')
              .slice(0, 80)
              .trim(),
            style: ['', 'good', 'great', 'bad'].includes(it.style) ? it.style : '',
          }))
          .filter((it) => it.label);
        if (!items.length) return;
        blocks.push({ type: 'rvx_quickstrip', items });
        break;
      }
      case 'rvx_connect': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 30)
          .map((it) =>
            String(it || '')
              .slice(0, 60)
              .trim()
          )
          .filter(Boolean);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_connect',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_quotes': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            text: String(it.text || '')
              .slice(0, 1000)
              .trim(),
            author: String(it.author || '')
              .slice(0, 120)
              .trim(),
          }))
          .filter((it) => it.text);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_quotes',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_versus': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 5)
          .map((it) => ({
            name: String(it.name || '')
              .slice(0, 120)
              .trim(),
            desc: String(it.desc || '')
              .slice(0, 300)
              .trim(),
            score: Math.min(10, Math.max(0, Number(it.score) || 0)),
            pros: Array.isArray(it.pros)
              ? it.pros
                  .slice(0, 5)
                  .map((s) =>
                    String(s || '')
                      .slice(0, 200)
                      .trim()
                  )
                  .filter(Boolean)
              : [],
            cons: Array.isArray(it.cons)
              ? it.cons
                  .slice(0, 5)
                  .map((s) =>
                    String(s || '')
                      .slice(0, 200)
                      .trim()
                  )
                  .filter(Boolean)
              : [],
          }))
          .filter((it) => it.name);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_versus',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_gallery_full': {
        if (!Array.isArray(b.items)) return;
        const items = [];
        for (const it of b.items.slice(0, 50)) {
          const mid = Number(it.media_id);
          if (!Number.isInteger(mid) || mid < 1) continue;
          const o = { media_id: mid };
          if (it.caption) o.caption = String(it.caption).slice(0, 500).trim();
          items.push(o);
        }
        if (!items.length) return;
        blocks.push({
          type: 'rvx_gallery_full',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_gallery_exif': {
        if (!Array.isArray(b.items)) return;
        const items = [];
        for (const it of b.items.slice(0, 30)) {
          const mid = Number(it.media_id);
          if (!Number.isInteger(mid) || mid < 1) continue;
          items.push({
            media_id: mid,
            title: String(it.title || '')
              .slice(0, 200)
              .trim(),
            focal: String(it.focal || '')
              .slice(0, 40)
              .trim(),
            aperture: String(it.aperture || '')
              .slice(0, 20)
              .trim(),
            iso: String(it.iso || '')
              .slice(0, 20)
              .trim(),
            shutter: String(it.shutter || '')
              .slice(0, 20)
              .trim(),
          });
        }
        if (!items.length) return;
        blocks.push({
          type: 'rvx_gallery_exif',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_gallery_compare': {
        if (!Array.isArray(b.items)) return;
        const items = [];
        for (const it of b.items.slice(0, 10)) {
          const bid2 = Number(it.before_media_id),
            aid = Number(it.after_media_id);
          if (!Number.isInteger(bid2) || bid2 < 1 || !Number.isInteger(aid) || aid < 1) continue;
          items.push({
            before_media_id: bid2,
            after_media_id: aid,
            label: String(it.label || '')
              .slice(0, 100)
              .trim(),
            before_label: String(it.before_label || 'PRED')
              .slice(0, 40)
              .trim(),
            after_label: String(it.after_label || 'PO')
              .slice(0, 40)
              .trim(),
          });
        }
        if (!items.length) return;
        blocks.push({
          type: 'rvx_gallery_compare',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_gallery_modes': {
        if (!Array.isArray(b.items)) return;
        const items = [];
        for (const it of b.items.slice(0, 12)) {
          const mid = Number(it.media_id);
          if (!Number.isInteger(mid) || mid < 1) continue;
          items.push({
            media_id: mid,
            title: String(it.title || '')
              .slice(0, 100)
              .trim(),
            desc: String(it.desc || '')
              .slice(0, 200)
              .trim(),
            icon: String(it.icon || 'image')
              .slice(0, 30)
              .trim(),
          });
        }
        if (!items.length) return;
        blocks.push({
          type: 'rvx_gallery_modes',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_gallery_samples': {
        if (!Array.isArray(b.items)) return;
        const items = [];
        for (const it of b.items.slice(0, 30)) {
          const mid = Number(it.media_id);
          if (!Number.isInteger(mid) || mid < 1) continue;
          items.push({
            media_id: mid,
            caption: String(it.caption || '')
              .slice(0, 300)
              .trim(),
            settings: String(it.settings || '')
              .slice(0, 200)
              .trim(),
          });
        }
        if (!items.length) return;
        blocks.push({
          type: 'rvx_gallery_samples',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_gallery_hero': {
        if (!Array.isArray(b.items)) return;
        const items = [];
        for (const it of b.items.slice(0, 10)) {
          const mid = Number(it.media_id);
          if (!Number.isInteger(mid) || mid < 1) continue;
          items.push({
            media_id: mid,
            caption: String(it.caption || '')
              .slice(0, 300)
              .trim(),
          });
        }
        if (!items.length) return;
        blocks.push({
          type: 'rvx_gallery_hero',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_buyers': {
        const yes = Array.isArray(b.yes)
          ? b.yes
              .slice(0, 10)
              .map((s) =>
                String(s || '')
                  .slice(0, 200)
                  .trim()
              )
              .filter(Boolean)
          : [];
        const maybe = Array.isArray(b.maybe)
          ? b.maybe
              .slice(0, 10)
              .map((s) =>
                String(s || '')
                  .slice(0, 200)
                  .trim()
              )
              .filter(Boolean)
          : [];
        const no = Array.isArray(b.no)
          ? b.no
              .slice(0, 10)
              .map((s) =>
                String(s || '')
                  .slice(0, 200)
                  .trim()
              )
              .filter(Boolean)
          : [];
        if (!yes.length && !maybe.length && !no.length) return;
        blocks.push({
          type: 'rvx_buyers',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          yes,
          maybe,
          no,
        });
        break;
      }
      case 'rvx_deepdive': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            tab_title: String(it.tab_title || '')
              .slice(0, 100)
              .trim(),
            text: String(it.text || '')
              .slice(0, 5000)
              .trim(),
          }))
          .filter((it) => it.tab_title);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_deepdive',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_bench': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 20)
          .map((it) => ({
            name: String(it.name || '')
              .slice(0, 100)
              .trim(),
            score: Math.max(0, Number(it.score) || 0),
            max: Math.max(1, Number(it.max) || 100),
            label: String(it.label || '')
              .slice(0, 60)
              .trim(),
          }))
          .filter((it) => it.name);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_bench',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_timeline': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 30)
          .map((it) => ({
            day: String(it.day || '')
              .slice(0, 40)
              .trim(),
            title: String(it.title || '')
              .slice(0, 200)
              .trim(),
            text: String(it.text || '')
              .slice(0, 1000)
              .trim(),
          }))
          .filter((it) => it.title);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_timeline',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_pricing': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            name: String(it.name || '')
              .slice(0, 120)
              .trim(),
            price: String(it.price || '')
              .slice(0, 60)
              .trim(),
            specs: String(it.specs || '')
              .slice(0, 500)
              .trim(),
            url: String(it.url || '')
              .slice(0, 500)
              .trim(),
          }))
          .filter((it) => it.name);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_pricing',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_hilo': {
        const highs = Array.isArray(b.highs)
          ? b.highs
              .slice(0, 10)
              .map((s) =>
                String(s || '')
                  .slice(0, 300)
                  .trim()
              )
              .filter(Boolean)
          : [];
        const lows = Array.isArray(b.lows)
          ? b.lows
              .slice(0, 10)
              .map((s) =>
                String(s || '')
                  .slice(0, 300)
                  .trim()
              )
              .filter(Boolean)
          : [];
        if (!highs.length && !lows.length) return;
        blocks.push({
          type: 'rvx_hilo',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          highs,
          lows,
        });
        break;
      }
      case 'rvx_generations': {
        if (!Array.isArray(b.headers) || !Array.isArray(b.rows)) return;
        const headers = b.headers
          .slice(0, 10)
          .map((s) =>
            String(s || '')
              .slice(0, 100)
              .trim()
          )
          .filter(Boolean);
        const rows = b.rows
          .slice(0, 30)
          .map((r) => ({
            cells: Array.isArray(r.cells)
              ? r.cells.slice(0, 10).map((s) =>
                  String(s || '')
                    .slice(0, 200)
                    .trim()
                )
              : [],
          }))
          .filter((r) => r.cells.length);
        if (!headers.length || !rows.length) return;
        blocks.push({
          type: 'rvx_generations',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          headers,
          rows,
        });
        break;
      }
      case 'rvx_profile': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 20)
          .map((it) => ({
            label: String(it.label || '')
              .slice(0, 100)
              .trim(),
            value: String(it.value || '')
              .slice(0, 200)
              .trim(),
          }))
          .filter((it) => it.label);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_profile',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_awards': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            title: String(it.title || '')
              .slice(0, 200)
              .trim(),
            org: String(it.org || '')
              .slice(0, 120)
              .trim(),
            year: String(it.year || '')
              .slice(0, 10)
              .trim(),
          }))
          .filter((it) => it.title);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_awards',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_box': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 20)
          .map((it) => {
            if (typeof it === 'string') return { icon: 'category', text: it.slice(0, 200).trim() };
            return {
              icon: String(it.icon || 'category')
                .slice(0, 30)
                .trim(),
              text: String(it.text || '')
                .slice(0, 200)
                .trim(),
            };
          })
          .filter((it) => it.text);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_box',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_experts': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            name: String(it.name || '')
              .slice(0, 120)
              .trim(),
            role: String(it.role || '')
              .slice(0, 120)
              .trim(),
            text: String(it.text || '')
              .slice(0, 1000)
              .trim(),
            score: it.score ? Math.min(10, Math.max(0, Number(it.score) || 0)) : null,
          }))
          .filter((it) => it.name && it.text);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_experts',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_usecases': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            icon: String(it.icon || 'check')
              .slice(0, 30)
              .trim(),
            title: String(it.title || '')
              .slice(0, 120)
              .trim(),
            text: String(it.text || '')
              .slice(0, 500)
              .trim(),
            verdict: ['yes', 'maybe', 'no'].includes(it.verdict) ? it.verdict : 'yes',
          }))
          .filter((it) => it.title);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_usecases',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_battery': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 15)
          .map((it) => ({
            scenario: String(it.scenario || '')
              .slice(0, 100)
              .trim(),
            hours: String(it.hours || '')
              .slice(0, 20)
              .trim(),
            pct: Math.min(100, Math.max(0, Number(it.pct) || 0)),
          }))
          .filter((it) => it.scenario);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_battery',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_software': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 15)
          .map((it) => ({
            title: String(it.title || '')
              .slice(0, 120)
              .trim(),
            text: String(it.text || '')
              .slice(0, 500)
              .trim(),
          }))
          .filter((it) => it.title);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_software',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_design': {
        const text = String(b.text || '')
          .slice(0, 3000)
          .trim();
        const items = Array.isArray(b.items)
          ? b.items
              .slice(0, 15)
              .map((it) => ({
                label: String(it.label || '')
                  .slice(0, 100)
                  .trim(),
                value: String(it.value || '')
                  .slice(0, 200)
                  .trim(),
              }))
              .filter((it) => it.label)
          : [];
        if (!text && !items.length) return;
        blocks.push({
          type: 'rvx_design',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          text,
          items,
        });
        break;
      }
      case 'rvx_sustain': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 15)
          .map((it) => ({
            label: String(it.label || '')
              .slice(0, 100)
              .trim(),
            value: String(it.value || '')
              .slice(0, 200)
              .trim(),
          }))
          .filter((it) => it.label);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_sustain',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_accessories': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 20)
          .map((it) => {
            const mid = Number(it.media_id);
            return {
              name: String(it.name || '')
                .slice(0, 120)
                .trim(),
              price: String(it.price || '')
                .slice(0, 60)
                .trim(),
              url: String(it.url || '')
                .slice(0, 500)
                .trim(),
              note: String(it.note || '')
                .slice(0, 200)
                .trim(),
              media_id: Number.isInteger(mid) && mid > 0 ? mid : null,
            };
          })
          .filter((it) => it.name);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_accessories',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_repair': {
        const score = Math.min(10, Math.max(0, Number(b.score) || 0));
        const items = Array.isArray(b.items)
          ? b.items
              .slice(0, 10)
              .map((it) => ({
                label: String(it.label || '')
                  .slice(0, 100)
                  .trim(),
                value: String(it.value || '')
                  .slice(0, 200)
                  .trim(),
              }))
              .filter((it) => it.label)
          : [];
        blocks.push({
          type: 'rvx_repair',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          score,
          items,
        });
        break;
      }
      case 'rvx_buy': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 20)
          .map((it) => ({
            shop: String(it.shop || '')
              .slice(0, 120)
              .trim(),
            price: String(it.price || '')
              .slice(0, 60)
              .trim(),
            url: String(it.url || '')
              .slice(0, 500)
              .trim(),
          }))
          .filter((it) => it.shop);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_buy',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_faq': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 20)
          .map((it) => ({
            q: String(it.q || '')
              .slice(0, 300)
              .trim(),
            a: String(it.a || '')
              .slice(0, 2000)
              .trim(),
          }))
          .filter((it) => it.q && it.a);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_faq',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_alts': {
        if (!Array.isArray(b.items)) return;
        const items = b.items
          .slice(0, 10)
          .map((it) => ({
            name: String(it.name || '')
              .slice(0, 120)
              .trim(),
            score: it.score ? Math.min(10, Math.max(0, Number(it.score) || 0)) : null,
            reason: String(it.reason || '')
              .slice(0, 300)
              .trim(),
            url: String(it.url || '')
              .slice(0, 500)
              .trim(),
            slug: String(it.slug || '')
              .slice(0, 200)
              .trim(),
          }))
          .filter((it) => it.name);
        if (!items.length) return;
        blocks.push({
          type: 'rvx_alts',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          items,
        });
        break;
      }
      case 'rvx_pricehist': {
        blocks.push({
          type: 'rvx_pricehist',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          note: String(b.note || '')
            .slice(0, 500)
            .trim(),
          url: String(b.url || '')
            .slice(0, 500)
            .trim(),
        });
        break;
      }
      case 'rvx_editornote': {
        const text = String(b.text || '')
          .slice(0, 3000)
          .trim();
        if (!text) return;
        blocks.push({
          type: 'rvx_editornote',
          text,
          author: String(b.author || '')
            .slice(0, 120)
            .trim(),
        });
        break;
      }
      case 'rvx_method': {
        const text = String(b.text || '')
          .slice(0, 3000)
          .trim();
        const items = Array.isArray(b.items)
          ? b.items
              .slice(0, 20)
              .map((s) =>
                String(s || '')
                  .slice(0, 200)
                  .trim()
              )
              .filter(Boolean)
          : [];
        if (!text && !items.length) return;
        blocks.push({
          type: 'rvx_method',
          eyebrow: String(b.eyebrow || '')
            .slice(0, 120)
            .trim(),
          title: String(b.title || '')
            .slice(0, 200)
            .trim(),
          text,
          items,
        });
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

/**
 * Odhad času čítania (minúty) z content blokov — počíta slová vo všetkých
 * textových poliach (text, title, excerpt, caption, items…), HTML tagy ignoruje.
 */
function estimateReadTimeMin(contentBlocks) {
  let words = 0;
  const countWords = (v) => {
    words += String(v)
      .replace(/<[^>]*>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
  };
  const TEXT_KEYS = new Set([
    'text',
    'title',
    'subtitle',
    'excerpt',
    'caption',
    'eyebrow',
    'quote',
    'author',
    'label',
    'name',
    'value',
    'description',
    'body',
    'html',
  ]);
  const walk = (node) => {
    if (node == null) return;
    if (typeof node === 'string') return countWords(node);
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (TEXT_KEYS.has(k)) walk(v);
        else if (Array.isArray(v) || (v && typeof v === 'object')) walk(v);
      }
    }
  };
  walk(contentBlocks);
  return Math.max(1, Math.round(words / 200));
}

module.exports = {
  estimateReadTimeMin,
  BLOCK_TYPES,
  HEADING_LEVELS,
  sanitizeBlocks,
  extractSearchText,
  extractFirstImageId,
  extractYoutubeId,
};
