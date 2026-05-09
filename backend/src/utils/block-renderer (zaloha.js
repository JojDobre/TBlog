/**
 * Block renderer  (Phase 6.3)
 *
 * Konvertuje JSON content bloky na HTML string pre verejný frontend.
 * "Prose" bloky (paragraph, heading, image …) sa balia do <div class="article-prose">.
 * "Wide" bloky (section, rating, pros_cons …) idú na plnú šírku kontajnera.
 */

'use strict';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineFormat(text) {
  let s = esc(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>'
  );
  return s;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/** Typy, ktoré sa renderujú v úzkom prose bloku */
const PROSE_TYPES = new Set([
  'paragraph',
  'heading',
  'image',
  'divider',
  'youtube',
  'quote',
  'gallery',
  'list',
]);

/**
 * Renderuje pole blokov na HTML string.
 * Prose bloky sa balia do <div class="article-prose">.
 * Wide bloky (section, rating, …) idú priamo.
 */
function renderBlocks(blocks, opts = {}) {
  if (!Array.isArray(blocks)) return '';
  const mediaMap = opts.mediaMap || new Map();
  const output = [];

  for (const b of blocks) {
    if (!b || !b.type) continue;
    const html = renderSingle(b, mediaMap);
    if (html) output.push(html);
  }

  return output.join('\n');
}

// =========================================================================
// Single block renderer
// =========================================================================
function renderSingle(b, mediaMap) {
  const p = [];

  switch (b.type) {
    // ---- PROSE BLOCKS (unchanged) ----
    case 'paragraph':
      if (b.text) {
        for (const par of b.text.split(/\n\n+/).filter(Boolean)) {
          p.push('<p>' + inlineFormat(par).replace(/\n/g, '<br>') + '</p>');
        }
      }
      break;

    case 'heading':
      if (b.text) {
        const tag = b.level === 3 ? 'h3' : 'h2';
        const id = slugify(b.text);
        p.push(`<${tag} id="${id}">${esc(b.text)}</${tag}>`);
      }
      break;

    case 'image': {
      const media = mediaMap.get(b.media_id);
      if (media) {
        p.push('<figure>');
        p.push(
          `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="${esc(b.alt || '')}" loading="lazy">`
        );
        if (b.caption) p.push(`<figcaption>${esc(b.caption)}</figcaption>`);
        p.push('</figure>');
      }
      break;
    }

    case 'divider':
      p.push('<hr>');
      break;

    case 'youtube':
      if (b.video_id) {
        p.push('<figure class="article-video"><div class="video-wrap">');
        p.push(
          `<iframe src="https://www.youtube.com/embed/${esc(b.video_id)}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
        );
        p.push('</div>');
        if (b.caption) p.push(`<figcaption>${esc(b.caption)}</figcaption>`);
        p.push('</figure>');
      }
      break;

    case 'quote':
      if (b.text) {
        p.push('<blockquote>');
        p.push('<p>' + esc(b.text) + '</p>');
        if (b.author) p.push(`<cite>— ${esc(b.author)}</cite>`);
        p.push('</blockquote>');
      }
      break;

    case 'gallery':
      if (Array.isArray(b.items) && b.items.length > 0) {
        p.push('<div class="article-gallery">');
        for (const item of b.items) {
          const media = mediaMap.get(item.media_id);
          if (!media) continue;
          p.push('<figure class="article-gallery-item">');
          p.push(
            `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
          );
          if (item.caption) p.push(`<figcaption>${esc(item.caption)}</figcaption>`);
          p.push('</figure>');
        }
        p.push('</div>');
      }
      break;

    case 'list':
      if (Array.isArray(b.items) && b.items.length > 0) {
        const tag = b.ordered ? 'ol' : 'ul';
        p.push(`<${tag}>`);
        for (const item of b.items) p.push(`<li>${inlineFormat(item)}</li>`);
        p.push(`</${tag}>`);
      }
      break;

    // ---- WIDE BLOCKS ----

    case 'section': {
      const widthCls = b.width === 'half' ? ' review-half' : '';
      const media = b.media_id ? mediaMap.get(b.media_id) : null;
      const isVideo = !!b.video_url;

      // Title classes
      let titleCls = 'cs-title';
      if (b.title_style === 'xl') titleCls += ' cs-title--xl';
      else if (b.title_style === 'gradient') titleCls += ' cs-title--gradient';
      else if (b.title_style === 'accent') titleCls += ' cs-title--accent';
      if (b.number) titleCls += ' cs-title--numbered';
      const titleAlign = b.title_style === 'centered' ? ' style="text-align:center;"' : '';

      // Helper: render title with optional number
      const titleHtml = b.title
        ? b.number
          ? `<h2 class="${titleCls}"${titleAlign}><span class="cs-num">${esc(b.number)}</span>${esc(b.title)}</h2>`
          : `<h2 class="${titleCls}"${titleAlign}>${esc(b.title)}</h2>`
        : '';

      // Helper: render text paragraphs
      const textHtml = b.text
        ? '<div class="cs-text">' +
          b.text
            .split(/\n\n+/)
            .filter(Boolean)
            .map((par) => '<p>' + inlineFormat(par).replace(/\n/g, '<br>') + '</p>')
            .join('') +
          '</div>'
        : '';

      // Helper: render media figure
      const mediaHtml = media ? renderMediaFigure(media, b, isVideo) : '';

      if (b.layout === 'grid') {
        p.push('<section class="cs cs-grid${widthCls}">');
        if (textHtml) p.push(`<div class="cs-grid-text">${textHtml}</div>`);
        if (titleHtml) p.push(`<div class="cs-grid-title">${titleHtml}</div>`);
        if (media) {
          if (isVideo) {
            p.push('<figure class="cs-grid-media cs-media--video">');
            p.push(videoLinkHtml(media, b.video_url));
            p.push('</figure>');
          } else {
            p.push(
              `<figure class="cs-grid-media"><img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy"></figure>`
            );
          }
          if (b.caption)
            p.push(`<figcaption class="cs-grid-figcaption">${esc(b.caption)}</figcaption>`);
        }
        p.push('</section>');
      } else if (b.layout === 'split' || b.layout === 'split-reverse') {
        const rev = b.layout === 'split-reverse' ? ' cs-split--reverse' : '';
        p.push(`<section class="cs cs-split${rev}${widthCls}">`);
        p.push('<div class="cs-split-text">');
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (titleHtml) p.push(titleHtml);
        if (b.show_divider) p.push('<div class="cs-divider"></div>');
        if (textHtml) p.push(textHtml);
        p.push('</div>');
        if (media) {
          if (b.media_style === 'tilt') {
            p.push(
              `<figure class="cs-split-media cs-split-media--tilt${isVideo ? ' cs-media--video' : ''}">`
            );
            p.push('<div class="cs-tilt-shadow"></div><div class="cs-tilt-img">');
            if (isVideo) {
              p.push(videoLinkHtml(media, b.video_url));
            } else {
              p.push(
                `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
              );
            }
            p.push('<div class="cs-tilt-shine"></div></div></figure>');
          } else {
            p.push(`<figure class="cs-split-media${isVideo ? ' cs-media--video' : ''}">`);
            if (isVideo) {
              p.push(videoLinkHtml(media, b.video_url));
            } else {
              p.push(
                `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
              );
            }
            p.push('</figure>');
          }
        }
        p.push('</section>');
      } else {
        // Default (stacked)
        p.push('<section class="cs${widthCls}">');
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (titleHtml) p.push(titleHtml);
        if (b.show_divider) p.push('<div class="cs-divider"></div>');
        if (textHtml) p.push(textHtml);
        if (media) {
          if (isVideo) {
            p.push('<figure class="cs-media cs-media--video">');
            p.push(videoLinkHtml(media, b.video_url));
            p.push('</figure>');
          } else {
            p.push(
              `<figure class="cs-media"><img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="${esc(b.caption || '')}" loading="lazy"></figure>`
            );
          }
          if (b.caption) p.push(`<figcaption>${esc(b.caption)}</figcaption>`);
        }
        p.push('</section>');
      }
      break;
    }

    case 'pros_cons': {
      const hasPros = Array.isArray(b.pros) && b.pros.length > 0;
      const hasCons = Array.isArray(b.cons) && b.cons.length > 0;
      if (hasPros || hasCons) {
        const widthCls = b.width === 'half' ? ' review-half' : '';
        p.push(`<div class="proscons${widthCls}">`);
        if (hasPros) {
          p.push('<div class="proscons-col proscons-col--pros">');
          p.push(
            '<h6 class="proscons-title proscons-title--pros"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg> Páči sa nám</h6>'
          );
          p.push('<ul>');
          for (const item of b.pros) {
            if (item) p.push(`<li>${esc(item)}</li>`);
          }
          p.push('</ul></div>');
        }
        if (hasCons) {
          p.push('<div class="proscons-col proscons-col--cons">');
          p.push(
            '<h6 class="proscons-title proscons-title--cons"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg> Zamyslíme sa</h6>'
          );
          p.push('<ul>');
          for (const item of b.cons) {
            if (item) p.push(`<li>${esc(item)}</li>`);
          }
          p.push('</ul></div>');
        }
        p.push('</div>');
      }
      break;
    }

    case 'specs': {
      if (Array.isArray(b.rows) && b.rows.length > 0) {
        const widthCls = b.width === 'half' ? ' review-half' : '';
        p.push(`<div class="review-block-specs${widthCls}">`);
        p.push('<h3 class="h-4" style="margin-bottom:24px;">Špecifikácie</h3>');
        p.push('<table class="spec-table"><tbody>');
        for (const r of b.rows) {
          if (r.key || r.value) p.push(`<tr><th>${esc(r.key)}</th><td>${esc(r.value)}</td></tr>`);
        }
        p.push('</tbody></table></div>');
      }
      break;
    }

    case 'rating': {
      // Verdict card
      p.push('<section class="verdict">');
      p.push('<div class="verdict-score">');
      p.push('<span class="verdict-score-label">Celkové skóre</span>');
      const sc = b.total_score ? Number(b.total_score).toFixed(1) : '—';
      p.push(`<span class="verdict-score-num">${sc}</span>`);
      const fullStars = Math.round((b.total_score || 0) / 2);
      p.push('<div class="verdict-stars">');
      for (let si = 0; si < 5; si++) {
        const fill = si < fullStars ? 'currentColor' : 'none';
        p.push(
          `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z"/></svg>`
        );
      }
      p.push('</div>');
      if (b.badge) p.push(`<span class="verdict-badge">${esc(b.badge)}</span>`);
      p.push('</div>');
      p.push('<div class="verdict-text">');
      if (b.verdict_title)
        p.push(`<h3 class="h-3" style="margin:0 0 12px;">${esc(b.verdict_title)}</h3>`);
      if (b.verdict_text)
        p.push(
          `<p style="color:var(--text-muted); font-size:16px; line-height:1.6; margin:0;">${esc(b.verdict_text)}</p>`
        );
      p.push('</div></section>');

      // Breakdown bars
      if (Array.isArray(b.criteria) && b.criteria.length > 0) {
        const widthCls = b.width === 'half' ? ' review-half' : '';
        p.push(`<div class="review-block-breakdown${widthCls}">`);
        p.push('<h3 class="h-4" style="margin-bottom:24px;">Hodnotenie podľa kategórií</h3>');
        p.push('<div class="score-bd">');
        for (const c of b.criteria) {
          if (c.name) {
            p.push('<div class="score-bd-row">');
            p.push(`<span class="score-bd-label">${esc(c.name)}</span>`);
            p.push(`<div class="score-bar"><i style="width:${(c.score || 0) * 10}%;"></i></div>`);
            p.push(`<span class="score-bd-val">${Number(c.score || 0).toFixed(1)}</span>`);
            p.push('</div>');
          }
        }
        p.push('</div></div>');
      }
      break;
    }

    case 'color_variants': {
      if (Array.isArray(b.variants) && b.variants.length > 0) {
        p.push('<div class="rv-colors">');
        for (const v of b.variants) {
          const hex = esc(v.hex || '#000000');
          // Determine text color based on luminance (simple heuristic)
          const textColor = isLightColor(v.hex) ? 'oklch(0.2 0 0)' : 'oklch(1 0 0)';
          p.push(
            `<article class="rv-color-card" style="--swatch:${hex}; --swatch-text:${textColor};">`
          );
          p.push('<div class="rv-color-swatch">');
          p.push('<div class="rv-color-phone"></div>');
          if (v.code) p.push(`<span class="rv-color-code">${esc(v.code)}</span>`);
          p.push('</div>');
          p.push('<div class="rv-color-meta">');
          p.push(`<h4>${esc(v.name)}</h4>`);
          if (v.note) p.push(`<span>${esc(v.note)}</span>`);
          p.push('</div></article>');
        }
        p.push('</div>');
      }
      break;
    }

    case 'review_banner': {
      const widthCls = b.width === 'half' ? ' review-half' : '';
      const bgMedia = b.background_media_id ? mediaMap.get(b.background_media_id) : null;
      p.push(
        '<div class="review-banner' +
          widthCls +
          (bgMedia
            ? ` style="background-image:url(/uploads/${esc(bgMedia.original_path || bgMedia.thumbnail_path)})"`
            : '') +
          '>'
      );
      if (b.title) p.push(`<h2 class="review-banner-title">${esc(b.title)}</h2>`);
      if (b.subtitle) p.push(`<p class="review-banner-subtitle">${esc(b.subtitle)}</p>`);
      if (Array.isArray(b.buttons) && b.buttons.length > 0) {
        p.push('<div class="review-banner-buttons">');
        for (const btn of b.buttons) {
          const cls =
            btn.style === 'ghost'
              ? 'btn btn-ghost'
              : btn.style === 'secondary'
                ? 'btn'
                : 'btn btn-primary';
          p.push(`<a href="${esc(btn.anchor || '#')}" class="${cls}">${esc(btn.label)}</a>`);
        }
        p.push('</div>');
      }
      if (Array.isArray(b.slider_media_ids) && b.slider_media_ids.length > 0) {
        p.push('<div class="review-banner-slider">');
        for (const mid of b.slider_media_ids) {
          const sm = mid ? mediaMap.get(mid) : null;
          if (sm)
            p.push(
              `<img src="/uploads/${esc(sm.original_path || sm.thumbnail_path)}" alt="" loading="lazy">`
            );
        }
        p.push('</div>');
      }
      p.push('</div>');
      break;
    }
  }

  return p.join('\n');
}

// =========================================================================
// Helpers
// =========================================================================

function videoLinkHtml(media, videoUrl) {
  return (
    `<a href="${esc(videoUrl)}" target="_blank" rel="noopener" class="cs-video-link">` +
    `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">` +
    '<div class="cs-play-btn"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>' +
    '</a>'
  );
}

function renderMediaFigure(media, b, isVideo) {
  // Not used directly — kept for potential future use
  return '';
}

/** Simple luminance check for hex color */
function isLightColor(hex) {
  if (!hex || typeof hex !== 'string') return false;
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const bl = parseInt(m[3], 16) / 255;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  return lum > 0.5;
}

/**
 * Extrahuje nadpisy (h2, h3) pre Table of Contents widget.
 */
function extractToc(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .filter((b) => b && b.type === 'heading' && b.text)
    .map((b) => ({
      level: b.level || 2,
      text: b.text,
      id: slugify(b.text),
    }));
}

module.exports = { renderBlocks, extractToc, esc };
