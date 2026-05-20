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

/**
 * Renderuje pole blokov na HTML string.
 * Všetky bloky idú na plnú šírku kontajnera.
 */
function renderBlocks(blocks, opts = {}) {
  if (!Array.isArray(blocks)) return '';
  const mediaMap = opts.mediaMap || new Map();
  const output = [];

  for (const b of blocks) {
    if (!b || !b.type) continue;
    const html = renderSingle(b, mediaMap, opts);
    if (html) output.push(html);
  }

  return output.join('\n');
}

// =========================================================================
// Single block renderer
// =========================================================================
function renderSingle(b, mediaMap, opts) {
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
      const media = b.media_id ? mediaMap.get(b.media_id) : null;
      const isVideo = !!b.video_url;
      const widthCls = b.width === 'half' ? ' review-half' : '';

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

      if (b.layout === 'grid') {
        const titleLeft = b.grid_title_side === 'left';
        p.push(`<section class="cs cs-grid${titleLeft ? ' cs-grid--title-left' : ''}${widthCls}">`);
        if (titleLeft) {
          if (titleHtml) p.push(`<div class="cs-grid-title">${titleHtml}</div>`);
          if (textHtml) p.push(`<div class="cs-grid-text">${textHtml}</div>`);
        } else {
          if (textHtml) p.push(`<div class="cs-grid-text">${textHtml}</div>`);
          if (titleHtml) p.push(`<div class="cs-grid-title">${titleHtml}</div>`);
        }
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
        p.push(`<section class="cs${widthCls}">`);
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
      break;
    }

    case 'rating_breakdown': {
      const widthCls = b.width === 'half' ? ' review-half' : '';
      p.push(`<div class="review-block-breakdown${widthCls}">`);
      p.push('<h3 class="h-4" style="margin-bottom:24px;">Hodnotenie vlastností</h3>');
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
      break;
    }

    case 'color_variants': {
      if (Array.isArray(b.variants) && b.variants.length > 0) {
        const widthCls = b.width === 'half' ? ' review-half' : '';
        p.push(`<div class="rv-colors${widthCls}">`);
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
      const bgMedia = b.background_media_id ? mediaMap.get(b.background_media_id) : null;
      const widthCls = b.width === 'half' ? ' review-half' : '';
      p.push(
        '<div class="review-banner' +
          widthCls +
          '"' +
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

    case 'banner': {
      const bannerId = b.banner_id;
      if (!bannerId) break;
      const bannerData = (opts.bannerMap || new Map()).get(Number(bannerId));
      if (!bannerData) {
        p.push(
          `<div class="promo-banner" style="padding:20px; text-align:center; color:var(--text-subtle); font-size:13px">Banner #${esc(bannerId)} nenájdený</div>`
        );
        break;
      }
      p.push(renderBannerHtml(bannerData));
      break;
    }
  }

  return p.join('\n');
}

// =========================================================================
// banner block renderer
// =========================================================================
function renderBannerHtml(b) {
  const id = b.id;
  let td = {};
  if (b.template_data) {
    try {
      td = typeof b.template_data === 'string' ? JSON.parse(b.template_data) : b.template_data;
    } catch (e) {
      td = {};
    }
  }

  // IMAGE
  if (b.type === 'image' && (b.original_path || b.thumbnail_path)) {
    const src = '/uploads/' + esc(b.original_path || b.thumbnail_path);
    const alt = esc(b.alt_text || b.name);
    const img = `<img src="${src}" alt="${alt}" style="width:100%;display:block;border-radius:var(--r-2xl)" loading="lazy">`;
    if (b.link_url) {
      return `<a href="${esc(b.link_url)}" class="promo-banner" style="display:block;padding:0" target="_blank" rel="noopener" data-banner-id="${id}">${img}</a>`;
    }
    return `<div class="promo-banner" style="padding:0" data-banner-id="${id}">${img}</div>`;
  }

  // TEMPLATE: promo-brand
  if (b.type === 'template' && b.template_key === 'promo-brand') {
    const bg = td.bg_color ? ` style="background:${esc(td.bg_color)}"` : '';
    return (
      `<section class="promo-banner promo-brand" data-banner-id="${id}"${bg}>` +
      `<div class="promo-banner-bg promo-bg-mesh"></div>` +
      `<div style="position:relative;z-index:1">` +
      (td.eyebrow
        ? `<span class="eyebrow" style="color:oklch(1 0 0/0.7)">${esc(td.eyebrow)}</span>`
        : '') +
      `<h2 class="h-2" style="margin:12px 0;color:oklch(1 0 0)">${esc(td.title)}</h2>` +
      (td.description
        ? `<p class="lead" style="max-width:520px;color:oklch(1 0 0/0.85)">${esc(td.description)}</p>`
        : '') +
      (td.sponsor_text
        ? `<span style="font-family:var(--font-mono);font-size:11px;color:oklch(1 0 0/0.5);margin-top:16px;display:block">${esc(td.sponsor_text)}</span>`
        : '') +
      `</div>` +
      `<div class="promo-banner-cta">` +
      (td.product_media_id
        ? `<div class="promo-banner-product" style="background-image:url('/uploads/originals/${esc(td.product_media_id)}');background-size:contain;background-position:center;background-repeat:no-repeat"></div>`
        : `<div class="promo-banner-product ph ph-mesh"></div>`) +
      (td.cta_label && td.cta_url
        ? `<a href="${esc(td.cta_url)}" class="btn btn-lg" style="background:oklch(1 0 0);color:oklch(0.18 0.01 240)" target="_blank" rel="noopener">${esc(td.cta_label)}</a>`
        : '') +
      `</div></section>`
    );
  }

  // TEMPLATE: promo-app
  if (b.type === 'template' && b.template_key === 'promo-app') {
    let statsHtml = '';
    const stats = [];
    if (td.stat1_num) stats.push({ num: td.stat1_num, label: td.stat1_label || '' });
    if (td.stat2_num) stats.push({ num: td.stat2_num, label: td.stat2_label || '' });
    if (td.stat3_num) stats.push({ num: td.stat3_num, label: td.stat3_label || '' });
    if (stats.length > 0) {
      statsHtml =
        '<div class="promo-app-stats">' +
        stats
          .map(
            (s) =>
              `<div class="promo-stat"><span class="promo-stat-num">${esc(s.num)}</span><span class="promo-stat-label">${esc(s.label)}</span></div>`
          )
          .join('') +
        '</div>';
    }
    return (
      `<section class="promo-banner promo-app" data-banner-id="${id}">` +
      `<div class="promo-app-grid"></div><div class="promo-app-content"><div>` +
      (td.eyebrow
        ? `<span class="eyebrow" style="color:oklch(0.85 0.1 155)">${esc(td.eyebrow)}</span>`
        : '') +
      `<h2 class="h-2" style="margin:12px 0;max-width:540px;color:oklch(1 0 0)">${esc(td.title)}</h2>` +
      (td.description
        ? `<p class="lead" style="max-width:480px;margin:0;color:oklch(1 0 0/0.8)">${esc(td.description)}</p>`
        : '') +
      `<div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap">` +
      (td.cta1_label && td.cta1_url
        ? `<a href="${esc(td.cta1_url)}" class="btn btn-lg btn-accent" target="_blank" rel="noopener">${esc(td.cta1_label)}</a>`
        : '') +
      (td.cta2_label && td.cta2_url
        ? `<a href="${esc(td.cta2_url)}" class="btn btn-lg" style="background:oklch(1 0 0/0.15);color:oklch(1 0 0);border-color:oklch(1 0 0/0.2)" target="_blank" rel="noopener">${esc(td.cta2_label)}</a>`
        : '') +
      `</div></div>${statsHtml}</div></section>`
    );
  }

  // TEMPLATE: promo-cross
  if (b.type === 'template' && b.template_key === 'promo-cross') {
    const bg = td.bg_color ? ` style="background:${esc(td.bg_color)}"` : '';
    return (
      `<section class="promo-banner promo-cross" data-banner-id="${id}"${bg}>` +
      `<div class="promo-cross-pattern"></div>` +
      `<div style="position:relative;z-index:1;display:flex;align-items:center;gap:16px;flex-wrap:wrap">` +
      (td.badge_text ? `<span class="promo-badge">${esc(td.badge_text)}</span>` : '') +
      (td.meta_text ? `<span class="promo-meta-text">${esc(td.meta_text)}</span>` : '') +
      `</div>` +
      `<h2 class="h-2" style="margin:16px 0;max-width:680px;position:relative;z-index:1">${esc(td.title)}</h2>` +
      (td.description
        ? `<p class="lead" style="max-width:540px;position:relative;z-index:1">${esc(td.description)}</p>`
        : '') +
      `<div style="display:flex;gap:10px;margin-top:24px;position:relative;z-index:1;flex-wrap:wrap">` +
      (td.cta1_label && td.cta1_url
        ? `<a href="${esc(td.cta1_url)}" class="btn btn-accent" target="_blank" rel="noopener">${esc(td.cta1_label)}</a>`
        : '') +
      (td.cta2_label && td.cta2_url
        ? `<a href="${esc(td.cta2_url)}" class="btn" target="_blank" rel="noopener">${esc(td.cta2_label)}</a>`
        : '') +
      (td.cta3_label && td.cta3_url
        ? `<a href="${esc(td.cta3_url)}" class="btn" target="_blank" rel="noopener">${esc(td.cta3_label)}</a>`
        : '') +
      `</div></section>`
    );
  }

  // TEMPLATE: newsletter
  if (b.type === 'template' && b.template_key === 'newsletter') {
    return (
      `<section class="newsletter-section" data-banner-id="${id}">` +
      `<div class="newsletter-mesh"></div><div class="newsletter-content">` +
      (td.eyebrow ? `<span class="eyebrow">${esc(td.eyebrow)}</span>` : '') +
      `<h2 class="h-2" style="margin:12px 0">${esc(td.title)}</h2>` +
      (td.description ? `<p class="lead" style="max-width:520px">${esc(td.description)}</p>` : '') +
      `</div><div class="newsletter-form">` +
      `<div class="search" style="min-width:0;height:52px;border-radius:var(--r-lg)">` +
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>` +
      `<input type="email" placeholder="${esc(td.placeholder || 'tvoj@email.sk')}" style="font-size:15px">` +
      `</div>` +
      `<button class="btn btn-accent btn-lg" style="justify-content:center;width:100%">${esc(td.cta_label || 'Prihlásiť sa')}</button>` +
      (td.note ? `<span class="newsletter-note">${esc(td.note)}</span>` : '') +
      `</div></section>`
    );
  }

  // CUSTOM
  if (b.type === 'custom' && b.custom_code) {
    return `<div class="promo-banner" style="padding:0;overflow:hidden" data-banner-id="${id}">${b.custom_code}</div>`;
  }

  // Fallback
  return `<div class="promo-banner" style="padding:20px;text-align:center" data-banner-id="${id}"><span style="font-size:13px;color:var(--text-muted)">Banner: ${esc(b.name)}</span></div>`;
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
