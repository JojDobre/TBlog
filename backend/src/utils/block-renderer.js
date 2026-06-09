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
        if (b.format === 'html') {
          // HTML from Quill — output directly (already sanitized by server)
          p.push(b.text);
        } else {
          // Legacy markdown format
          for (const par of b.text.split(/\n\n+/).filter(Boolean)) {
            p.push('<p>' + inlineFormat(par).replace(/\n/g, '<br>') + '</p>');
          }
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
        ? b.format === 'html'
          ? '<div class="cs-text">' + b.text + '</div>'
          : '<div class="cs-text">' +
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
        if (b.eyebrow || b.title) {
          p.push(
            '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
          );
          if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
          if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
          p.push('</div></div>');
        }
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

    // === RVX BLOCKS — matching design CSS exactly ===
    case 'rvx_quickstrip': {
      p.push('<div class="rvx-quickstrip">');
      for (const it of b.items) {
        p.push(
          `<div class="rvx-qs-item"><span class="rvx-qs-l">${esc(it.label)}</span><span class="rvx-qs-v ${esc(it.style)}">${esc(it.value)}</span></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_glance': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-glance">');
      for (const it of b.items) {
        p.push('<article class="rvx-glance-card">');
        p.push(`<span class="rvx-glance-icon">${rvxIcon(it.icon)}</span>`);
        p.push(`<h4>${esc(it.title)}</h4>`);
        if (it.text) p.push(`<p>${esc(it.text)}</p>`);
        p.push('</article>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_keyspecs': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-keyspecs">');
      for (const it of b.items) {
        p.push(
          `<div class="rvx-keyspec"><span class="rvx-keyspec-n">${esc(it.num)}</span><span class="rvx-keyspec-l">${esc(it.label)}</span></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_connect': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-connect">');
      for (const it of b.items) {
        p.push(`<span class="rvx-connect-chip">${rvxIcon('check')} ${esc(it)}</span>`);
      }
      p.push('</div>');
      break;
    }
    case 'rvx_quotes': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-experts">');
      for (const it of b.items) {
        p.push(`<article class="rvx-expert"><p>"${esc(it.text)}"</p>`);
        if (it.author)
          p.push(`<div class="rvx-expert-attr"><strong>${esc(it.author)}</strong></div>`);
        p.push('</article>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_versus': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-versus">');
      for (const it of b.items) {
        p.push('<article class="rvx-vs-card"><div class="rvx-vs-body">');
        p.push(`<h4>${esc(it.name)}</h4>`);
        if (it.desc) p.push(`<p>${esc(it.desc)}</p>`);
        const parts = [];
        if (it.pros && it.pros.length) parts.push(it.pros.map((s) => '✓ ' + s).join(' · '));
        if (it.cons && it.cons.length) parts.push(it.cons.map((s) => '✗ ' + s).join(' · '));
        if (parts.length) p.push(`<span class="rvx-vs-tags">${esc(parts.join(' · '))}</span>`);
        p.push(
          `</div><div class="rvx-vs-score"><span>${Number(it.score).toFixed(1)}</span></div></article>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_gallery_full': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      const MAX_VISIBLE = 9;
      const allSrcs = [];
      for (const it of b.items) {
        const m = mediaMap.get(it.media_id);
        if (m) allSrcs.push('/uploads/' + (m.original_path || m.thumbnail_path));
      }
      const extra = allSrcs.length - MAX_VISIBLE;
      p.push(`<div class="rv-gal-grid" data-rvx-gallery-all='${JSON.stringify(allSrcs)}'>`);
      const visible = allSrcs.slice(0, MAX_VISIBLE);
      visible.forEach((src, i) => {
        const isLast = i === visible.length - 1 && extra > 0;
        const it = b.items[i];
        p.push(
          `<figure class="rv-gal-grid-item" data-rvx-lightbox-grid="${i}"><img src="${esc(src)}" alt="${esc((it && it.caption) || '')}" loading="lazy">`
        );
        if (it && it.caption) p.push(`<figcaption>${esc(it.caption)}</figcaption>`);
        if (isLast) p.push(`<div class="rv-gal-grid-more"><span>+${extra}</span></div>`);
        p.push('</figure>');
      });
      p.push('</div>');
      break;
    }
    case 'rvx_gallery_exif': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rv-gal-track">');
      b.items.forEach((it, i) => {
        const m = mediaMap.get(it.media_id);
        if (!m) return;
        const src = `/uploads/${esc(m.original_path || m.thumbnail_path)}`;
        const hasBody = it.title || it.focal || it.aperture || it.iso || it.shutter;
        p.push(
          `<div class="rv-gal-card${hasBody ? '' : ' rv-gal-card--nopad'}" data-rvx-lightbox><div class="rv-gal-card-img"><img src="${src}" alt="" loading="lazy"><span class="rv-gal-num">${String(i + 1).padStart(2, '0')}</span></div>`
        );
        if (hasBody) {
          p.push('<div class="rv-gal-card-body">');
          if (it.title) p.push(`<h4>${esc(it.title)}</h4>`);
          const hasExif = it.focal || it.aperture || it.iso || it.shutter;
          if (hasExif) {
            p.push('<div class="rv-gal-exif">');
            if (it.focal) p.push(`<span>Focal<strong>${esc(it.focal)}</strong></span>`);
            if (it.aperture) p.push(`<span>Aperture<strong>${esc(it.aperture)}</strong></span>`);
            if (it.iso) p.push(`<span>ISO<strong>${esc(it.iso)}</strong></span>`);
            if (it.shutter) p.push(`<span>Shutter<strong>${esc(it.shutter)}</strong></span>`);
            p.push('</div>');
          }
          p.push('</div>');
        }
        p.push('</div>');
      });
      p.push('</div>');
      break;
    }
    case 'rvx_gallery_compare': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rv-gal-compare">');
      for (const it of b.items) {
        const bm = mediaMap.get(it.before_media_id),
          am = mediaMap.get(it.after_media_id);
        if (!bm || !am) continue;
        const bl = esc(it.before_label || 'PRED'),
          al = esc(it.after_label || 'PO');
        p.push(
          `<div class="rv-gal-cmp-card"><div class="rv-gal-cmp-frame" data-rvx-compare><img class="rv-gal-cmp-before" src="/uploads/${esc(bm.original_path || bm.thumbnail_path)}" alt="${bl}"><img class="rv-gal-cmp-after" src="/uploads/${esc(am.original_path || am.thumbnail_path)}" alt="${al}"><span class="rv-gal-cmp-tag rv-gal-cmp-tag-l">${bl}</span><span class="rv-gal-cmp-tag rv-gal-cmp-tag-r">${al}</span><div class="rv-gal-cmp-handle"><div class="rv-gal-cmp-handle-knob">⇔</div></div></div>`
        );
        if (it.label) p.push(`<span class="rv-gal-cmp-label">${esc(it.label)}</span>`);
        p.push('</div>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_gallery_modes': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rv-gal-modes">');
      for (const it of b.items) {
        const m = mediaMap.get(it.media_id);
        if (!m) continue;
        const src = `/uploads/${esc(m.original_path || m.thumbnail_path)}`;
        p.push(
          `<div class="rv-gal-mode" data-rvx-lightbox><img class="rv-gal-mode-img" src="${src}" alt="" loading="lazy"><div class="rv-gal-mode-overlay"><div class="rv-gal-mode-icon">${rvxIcon(it.icon || 'image')}</div><div><h4>${esc(it.title)}</h4>`
        );
        if (it.desc) p.push(`<span>${esc(it.desc)}</span>`);
        p.push('</div></div></div>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_gallery_samples': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rv-gal-samples">');
      b.items.forEach((it, i) => {
        const m = mediaMap.get(it.media_id);
        if (!m) return;
        const src = `/uploads/${esc(m.original_path || m.thumbnail_path)}`;
        p.push(
          `<figure class="rv-gal-sample" data-rvx-lightbox><img src="${src}" alt="" loading="lazy">`
        );
        if (it.caption || it.settings) {
          p.push('<figcaption>');
          if (it.caption) p.push(`<span>${esc(it.caption)}</span>`);
          if (it.settings) p.push(`<span class="rv-gal-sample-meta">${esc(it.settings)}</span>`);
          p.push('</figcaption>');
        }
        p.push('</figure>');
      });
      p.push('</div>');
      break;
    }
    case 'rvx_gallery_hero': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rv-gal-hero">');
      b.items.forEach((it, i) => {
        const m = mediaMap.get(it.media_id);
        if (!m) return;
        const src = `/uploads/${esc(m.original_path || m.thumbnail_path)}`;
        p.push(
          `<figure class="rv-gal-hero-item${i === 0 ? ' rv-gal-hero-main' : ''}" data-rvx-lightbox><img src="${src}" alt="" loading="lazy">`
        );
        if (it.caption) p.push(`<figcaption>${esc(it.caption)}</figcaption>`);
        p.push('</figure>');
      });
      p.push('</div>');
      break;
    }
    case 'rvx_deepdive': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-tabs"><div class="rvx-tabs-nav">');
      b.items.forEach((it, i) => {
        p.push(
          `<button class="rvx-tab${i === 0 ? ' active' : ''}" data-rvx-tab="${i}">${esc(it.tab_title)}</button>`
        );
      });
      p.push('</div>');
      b.items.forEach((it, i) => {
        p.push(
          `<div class="rvx-tabs-body${i === 0 ? '' : ' hidden'}" data-rvx-pane="${i}"${i > 0 ? ' style="display:none"' : ''}>`
        );
        for (const par of it.text.split(/\n\n+/).filter(Boolean)) p.push(`<p>${esc(par)}</p>`);
        p.push('</div>');
      });
      p.push('</div>');
      break;
    }
    case 'rvx_bench': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-bench">');
      for (const it of b.items) {
        const pct = Math.min(100, Math.round((it.score / (it.max || 100)) * 100));
        p.push(
          `<div class="rvx-bench-row"><span class="rvx-bench-l">${esc(it.name)}</span><div class="rvx-bench-bar"><i style="width:${pct}%"></i></div><span class="rvx-bench-v">${esc(String(it.score))}${it.label ? ' ' + esc(it.label) : ''}</span></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_timeline': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-timeline">');
      for (const it of b.items) {
        p.push(
          '<div class="rvx-tl-item"><div class="rvx-tl-marker"><span></span></div><div class="rvx-tl-content">'
        );
        if (it.day) p.push(`<span class="rvx-tl-day">${esc(it.day)}</span>`);
        p.push(`<h4>${esc(it.title)}</h4>`);
        if (it.text) p.push(`<p>${esc(it.text)}</p>`);
        p.push('</div></div>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_pricing': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-pricing">');
      for (const it of b.items) {
        p.push('<article class="rvx-price-card">');
        p.push(`<h4>${esc(it.name)}</h4>`);
        p.push(`<span class="rvx-price-num">${esc(it.price)}</span>`);
        if (it.specs) {
          p.push('<ul>');
          for (const s of it.specs.split(',')) p.push(`<li>${esc(s.trim())}</li>`);
          p.push('</ul>');
        }
        if (it.url)
          p.push(
            `<a href="${esc(it.url)}" class="btn btn-sm" style="width:100%;justify-content:center" target="_blank" rel="noopener">Vybrať</a>`
          );
        p.push('</article>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_hilo': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-hilo">');
      if (b.highs && b.highs.length) {
        p.push(
          `<div class="rvx-hilo-col rvx-hi"><span class="rvx-hilo-h">${rvxIcon('trending')} Najväčšie prekvapenia</span>`
        );
        for (const s of b.highs) p.push(`<div class="rvx-hilo-row">${esc(s)}</div>`);
        p.push('</div>');
      }
      if (b.lows && b.lows.length) {
        p.push(
          `<div class="rvx-hilo-col rvx-lo"><span class="rvx-hilo-h">${rvxIcon('close')} Najväčšie sklamania</span>`
        );
        for (const s of b.lows) p.push(`<div class="rvx-hilo-row">${esc(s)}</div>`);
        p.push('</div>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_generations': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      const lastIdx = b.headers.length - 1;
      p.push('<div class="rvx-table-wrap"><table class="rvx-table"><thead><tr>');
      b.headers.forEach((h, i) => {
        p.push(`<th${i === lastIdx ? ' class="hl"' : ''}>${esc(h)}</th>`);
      });
      p.push('</tr></thead><tbody>');
      for (const r of b.rows) {
        p.push('<tr>');
        r.cells.forEach((c, i) => {
          p.push(`<td${i === lastIdx ? ' class="hl"' : ''}>${esc(c)}</td>`);
        });
        p.push('</tr>');
      }
      p.push('</tbody></table></div>');
      break;
    }
    case 'rvx_profile': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-radar"><div class="rvx-radar-bars">');
      for (const it of b.items) {
        const num = parseInt(it.value) || 0;
        const pct = Math.min(100, Math.max(5, num));
        p.push(
          `<div class="rvx-radar-item"><div class="rvx-radar-track"><div class="rvx-radar-fill" style="height:${pct}%"><span>${esc(it.value)}</span></div></div><span class="rvx-radar-l">${esc(it.label)}</span></div>`
        );
      }
      p.push('</div></div>');
      break;
    }
    case 'rvx_awards': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-awards">');
      for (const it of b.items) {
        p.push(
          `<article class="rvx-award"><span class="rvx-award-icon">${rvxIcon('star')}</span><strong>${esc(it.title)}</strong><span>${esc(it.org)}${it.year ? ' · ' + esc(it.year) : ''}</span></article>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_box': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-box">');
      for (const it of b.items) {
        const icon = typeof it === 'string' ? 'category' : it.icon || 'category';
        const text = typeof it === 'string' ? it : it.text;
        p.push(
          `<div class="rvx-box-item"><span class="rvx-box-icon">${rvxIcon(icon)}</span><span>${esc(text)}</span></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_experts': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-experts">');
      for (const it of b.items) {
        p.push(
          `<article class="rvx-expert"><p>"${esc(it.text)}"</p><div class="rvx-expert-attr"><strong>${esc(it.name)}</strong>`
        );
        if (it.role) p.push(`<span>${esc(it.role)}</span>`);
        if (it.score != null) p.push(`<span>${Number(it.score).toFixed(1)}/10</span>`);
        p.push('</div></article>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_usecases': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-usecases">');
      for (const it of b.items) {
        const vl = { yes: 'Výborné', maybe: 'Dobré', no: 'Slabé' };
        p.push(
          `<article class="rvx-usecase"><span class="rvx-usecase-icon">${rvxIcon(it.icon)}</span><div class="rvx-usecase-body"><h4>${esc(it.title)}</h4>`
        );
        if (it.text) p.push(`<p>${esc(it.text)}</p>`);
        p.push(
          `</div><span class="rvx-usecase-rating">${esc(vl[it.verdict] || it.verdict)}</span></article>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_battery': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-battery">');
      for (const it of b.items) {
        p.push(
          `<div class="rvx-bat-row"><span class="rvx-bat-l">${esc(it.scenario)}</span><div class="rvx-bat-bar"><i style="width:${it.pct}%"></i></div><span class="rvx-bat-h">${esc(it.hours)}</span></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_software': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-software">');
      for (const it of b.items) {
        p.push(`<article class="rvx-sw-card"><h4>${esc(it.title)}</h4>`);
        if (it.text) p.push(`<p>${esc(it.text)}</p>`);
        p.push('</article>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_design': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      if (b.text) {
        for (const par of b.text.split(/\n\n+/).filter(Boolean)) p.push(`<p>${esc(par)}</p>`);
      }
      if (b.items && b.items.length) {
        p.push('<div class="rvx-design">');
        for (const it of b.items) {
          p.push(
            `<article class="rvx-design-card"><h4>${esc(it.label)}</h4><span>${esc(it.value)}</span></article>`
          );
        }
        p.push('</div>');
      }
      break;
    }
    case 'rvx_sustain': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-sustain">');
      for (const it of b.items) {
        p.push(
          `<div class="rvx-sustain-item"><span class="rvx-sustain-n">${esc(it.value)}</span><span class="rvx-sustain-l">${esc(it.label)}</span></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_accessories': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-accessories">');
      for (const it of b.items) {
        const m = it.media_id ? mediaMap.get(it.media_id) : null;
        const href = it.url ? ` href="${esc(it.url)}" target="_blank" rel="noopener"` : '';
        const tag = it.url ? 'a' : 'div';
        p.push(`<${tag} class="rvx-acc-card"${href}>`);
        if (m)
          p.push(
            `<div class="rvx-acc-img"><img src="/uploads/${esc(m.thumbnail_path || m.original_path)}" alt="" loading="lazy"></div>`
          );
        p.push(`<div class="rvx-acc-body"><h4>${esc(it.name)}</h4>`);
        if (it.note) p.push(`<span class="rvx-acc-note">${esc(it.note)}</span>`);
        p.push('</div>');
        if (it.price) p.push(`<span class="rvx-acc-price">${esc(it.price)}</span>`);
        p.push(`</${tag}>`);
      }
      p.push('</div>');
      break;
    }
    case 'rvx_repair': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      const sc = Number(b.score || 0);
      const dashLen = Math.round((sc / 10) * 213);
      p.push('<div class="rvx-repair">');
      p.push(
        `<div class="rvx-repair-score"><svg viewBox="0 0 80 80" class="rvx-repair-ring"><circle cx="40" cy="40" r="34" fill="none" stroke="var(--border)" stroke-width="6"/><circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent)" stroke-width="6" stroke-dasharray="${dashLen} 213" transform="rotate(-90 40 40)" stroke-linecap="round"/></svg><div class="rvx-repair-num"><strong>${sc.toFixed(1)}</strong><span>/ 10</span></div></div>`
      );
      if (b.items && b.items.length) {
        p.push('<div class="rvx-repair-list">');
        for (const it of b.items)
          p.push(
            `<div class="rvx-repair-row"><span>${esc(it.label)}</span><strong>${esc(it.value)}</strong></div>`
          );
        p.push('</div>');
      }
      p.push('</div>');
      break;
    }
    case 'rvx_buy': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-buy">');
      b.items.forEach((it, i) => {
        p.push(
          `<article class="rvx-buy-row${i === 0 ? ' best' : ''}"><span class="rvx-buy-shop">${esc(it.shop)}</span><span class="rvx-buy-note"></span><span class="rvx-buy-price">${esc(it.price)}</span><a href="${esc(it.url)}" class="btn btn-sm" target="_blank" rel="noopener">Kúpiť →</a></article>`
        );
      });
      p.push('</div>');
      break;
    }
    case 'rvx_faq': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-faq">');
      for (const it of b.items) {
        p.push(
          `<div class="rvx-faq-item"><button class="rvx-faq-q" data-rvx-faq><span>${esc(it.q)}</span>${rvxIcon('check')}</button><p class="rvx-faq-a" style="display:none">${esc(it.a)}</p></div>`
        );
      }
      p.push('</div>');
      break;
    }
    case 'rvx_alts': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-alts">');
      for (const it of b.items) {
        const link = it.slug ? `/${esc(it.slug)}` : it.url || '';
        const href = link
          ? ` href="${link}"${it.url ? ' target="_blank" rel="noopener"' : ''}`
          : '';
        const tag = link ? 'a' : 'div';
        p.push(
          `<${tag} class="rvx-alt-card"${href}><div class="rvx-alt-body"><h4>${esc(it.name)}</h4>`
        );
        if (it.reason) p.push(`<p>${esc(it.reason)}</p>`);
        p.push('</div>');
        if (it.score != null)
          p.push(`<div class="rvx-alt-score"><span>${Number(it.score).toFixed(1)}</span></div>`);
        p.push(`</${tag}>`);
      }
      p.push('</div>');
      break;
    }
    case 'rvx_pricehist': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-pricehist">');
      if (b.note)
        p.push(
          `<p style="font-size:14px;color:var(--text-muted);margin:0 0 16px">${esc(b.note)}</p>`
        );
      if (b.url)
        p.push(
          `<a href="${esc(b.url)}" class="btn btn-sm btn-accent" target="_blank" rel="noopener">Zobraziť na Heureke →</a>`
        );
      p.push('</div>');
      break;
    }
    case 'rvx_editornote': {
      p.push('<div class="rvx-editor-note">');
      p.push(`<div class="rvx-editor-avatar">${rvxIcon('user')}</div>`);
      p.push('<div class="rvx-editor-body">');
      p.push('<span class="eyebrow" style="color:var(--accent)">Poznámka editora</span>');
      p.push(`<p>"${esc(b.text)}"</p>`);
      if (b.author) p.push(`<strong>${esc(b.author)}</strong>`);
      p.push('</div></div>');
      break;
    }
    case 'rvx_method': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      if (b.text) {
        p.push(
          `<p style="font-size:14px;color:var(--text-muted);line-height:1.7;margin-bottom:var(--s-4)">${esc(b.text)}</p>`
        );
      }
      if (b.items && b.items.length) {
        p.push('<div class="rvx-method">');
        for (const s of b.items) {
          p.push(
            `<div class="rvx-method-item"><span class="rvx-method-icon">${rvxIcon('check')}</span><span>${esc(s)}</span></div>`
          );
        }
        p.push('</div>');
      }
      break;
    }
    case 'rvx_buyers': {
      if (b.eyebrow || b.title) {
        p.push(
          '<div class="sec-head" style="margin-top:var(--s-section)"><div class="sec-head-l">'
        );
        if (b.eyebrow) p.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
        if (b.title) p.push(`<h2>${esc(b.title)}</h2>`);
        p.push('</div></div>');
      }
      p.push('<div class="rvx-usecases">');
      if (b.yes)
        for (const s of b.yes) {
          p.push(
            `<article class="rvx-usecase"><span class="rvx-usecase-icon">${rvxIcon('check')}</span><div class="rvx-usecase-body"><h4>${esc(s)}</h4></div><span class="rvx-usecase-rating">Ideálne</span></article>`
          );
        }
      if (b.maybe)
        for (const s of b.maybe) {
          p.push(
            `<article class="rvx-usecase"><span class="rvx-usecase-icon" style="background:oklch(0.7 0.13 75/0.12);color:oklch(0.7 0.13 75)">${rvxIcon('clock')}</span><div class="rvx-usecase-body"><h4>${esc(s)}</h4></div><span class="rvx-usecase-rating" style="color:oklch(0.7 0.13 75)">Zvážte</span></article>`
          );
        }
      if (b.no)
        for (const s of b.no) {
          p.push(
            `<article class="rvx-usecase"><span class="rvx-usecase-icon" style="background:oklch(0.62 0.21 25/0.12);color:oklch(0.62 0.21 25)">${rvxIcon('close')}</span><div class="rvx-usecase-body"><h4>${esc(s)}</h4></div><span class="rvx-usecase-rating" style="color:oklch(0.62 0.21 25)">Nie</span></article>`
          );
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

  // --- New banner templates ---
  // TEMPLATE: pro-membership
  if (b.type === 'template' && b.template_key === 'pro-membership') {
    const bg = td.bg_color ? ` style="background:${esc(td.bg_color)}"` : '';
    return `<section class="promo-banner promo-pro" data-banner-id="${id}"${bg}><div class="promo-banner-bg promo-bg-mesh"></div><div style="position:relative;z-index:1">${td.eyebrow ? `<span class="eyebrow" style="color:oklch(1 0 0/0.7)">${esc(td.eyebrow)}</span>` : ''}<h2 class="h-2" style="margin:12px 0;color:oklch(1 0 0)">${esc(td.title)}</h2>${td.description ? `<p class="lead" style="max-width:520px;color:oklch(1 0 0/0.85)">${esc(td.description)}</p>` : ''}${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn btn-lg btn-accent" style="margin-top:20px" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</div></section>`;
  }

  // TEMPLATE: affiliate-product
  if (b.type === 'template' && b.template_key === 'affiliate-product') {
    return `<section class="promo-banner promo-affiliate" data-banner-id="${id}"><div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">${td.product_media_id ? `<div style="width:120px;height:120px;border-radius:var(--r-xl);background:var(--bg-card);display:grid;place-items:center;flex-shrink:0"><img src="/uploads/originals/${esc(td.product_media_id)}" style="max-width:100px;max-height:100px;object-fit:contain" alt=""></div>` : ''}<div style="flex:1;min-width:200px">${td.badge ? `<span class="promo-badge" style="margin-bottom:8px">${esc(td.badge)}</span>` : ''}<h3 style="margin:0 0 8px;font-size:18px">${esc(td.title)}</h3>${td.description ? `<p style="margin:0;font-size:14px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}</div><div style="text-align:right">${td.price ? `<span style="font-family:var(--font-display);font-size:24px;font-weight:800;color:var(--accent)">${esc(td.price)}</span>` : ''}<br>${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn btn-sm btn-accent" style="margin-top:8px" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</div></div></section>`;
  }

  // TEMPLATE: inline-ad
  if (b.type === 'template' && b.template_key === 'inline-ad') {
    return `<section class="promo-banner promo-inline-ad" data-banner-id="${id}" style="padding:var(--s-5);border:1px solid var(--border)">${td.badge ? `<span class="promo-badge">${esc(td.badge)}</span>` : ''}<h3 style="margin:8px 0;font-size:16px">${esc(td.title)}</h3>${td.description ? `<p style="margin:0 0 12px;font-size:14px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn btn-sm btn-accent" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</section>`;
  }

  // TEMPLATE: related-article
  if (b.type === 'template' && b.template_key === 'related-article') {
    return `<a href="${esc(td.url || '#')}" class="promo-banner promo-related" data-banner-id="${id}" style="display:block;text-decoration:none;color:inherit;padding:var(--s-5);border:1px solid var(--border)">${td.eyebrow ? `<span class="eyebrow">${esc(td.eyebrow)}</span>` : ''}<h3 style="margin:8px 0;font-size:18px">${esc(td.title)}</h3>${td.description ? `<p style="margin:0;font-size:14px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}</a>`;
  }

  // TEMPLATE: alert-notice
  if (b.type === 'template' && b.template_key === 'alert-notice') {
    const colors = {
      warning: 'oklch(0.8 0.15 85)',
      error: 'oklch(0.65 0.2 25)',
      success: 'oklch(0.72 0.19 155)',
      info: 'var(--accent)',
    };
    const c = colors[td.style] || colors.info;
    return `<section class="promo-banner promo-alert" data-banner-id="${id}" style="border-left:4px solid ${c};padding:var(--s-5)"><h3 style="margin:0 0 8px;font-size:16px;color:${c}">${esc(td.title)}</h3>${td.description ? `<p style="margin:0 0 12px;font-size:14px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn btn-sm" style="border-color:${c};color:${c}" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</section>`;
  }

  // TEMPLATE: video-embed
  if (b.type === 'template' && b.template_key === 'video-embed') {
    return `<section class="promo-banner promo-video" data-banner-id="${id}" style="padding:0;overflow:hidden">${td.title ? `<div style="padding:var(--s-4) var(--s-5)"><h3 style="margin:0;font-size:16px">${esc(td.title)}</h3></div>` : ''}<div class="video-wrap"><iframe src="https://www.youtube.com/embed/${esc(td.video_id)}" title="YouTube" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>${td.description ? `<div style="padding:var(--s-4) var(--s-5)"><p style="margin:0;font-size:13px;color:var(--text-muted)">${esc(td.description)}</p></div>` : ''}</section>`;
  }

  // TEMPLATE: countdown
  if (b.type === 'template' && b.template_key === 'countdown') {
    return `<section class="promo-banner promo-countdown" data-banner-id="${id}" data-target-date="${esc(td.target_date || '')}"><h2 class="h-2" style="margin:0 0 8px">${esc(td.title)}</h2>${td.description ? `<p style="margin:0 0 16px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}<div class="countdown-digits" style="display:flex;gap:16px;font-family:var(--font-display);font-size:36px;font-weight:800;letter-spacing:-0.03em"><span data-cd-d>--</span><span style="opacity:0.3">:</span><span data-cd-h>--</span><span style="opacity:0.3">:</span><span data-cd-m>--</span><span style="opacity:0.3">:</span><span data-cd-s>--</span></div>${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn btn-accent" style="margin-top:20px" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</section>`;
  }

  // TEMPLATE: pull-quote
  if (b.type === 'template' && b.template_key === 'pull-quote') {
    return `<blockquote class="promo-banner promo-pull-quote" data-banner-id="${id}" style="border-left:3px solid var(--accent);padding:var(--s-6)"><p style="font-family:var(--font-display);font-size:22px;font-weight:700;line-height:1.4;margin:0 0 12px;letter-spacing:-0.02em">${esc(td.text)}</p>${td.author ? `<cite style="font-family:var(--font-mono);font-size:13px;color:var(--text-subtle);font-style:normal">— ${esc(td.author)}</cite>` : ''}</blockquote>`;
  }

  // TEMPLATE: discord
  if (b.type === 'template' && b.template_key === 'discord') {
    return `<section class="promo-banner promo-discord" data-banner-id="${id}" style="background:oklch(0.32 0.1 270)"><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap"><svg width="32" height="32" viewBox="0 0 24 24" fill="oklch(0.7 0.15 280)"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.11 13.11 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg><div style="flex:1"><h3 style="margin:0 0 4px;color:oklch(1 0 0);font-size:18px">${esc(td.title)}</h3>${td.description ? `<p style="margin:0;color:oklch(1 0 0/0.7);font-size:14px">${esc(td.description)}</p>` : ''}</div>${td.members_count ? `<span style="font-family:var(--font-mono);font-size:13px;color:oklch(1 0 0/0.5)">${esc(td.members_count)} členov</span>` : ''}</div>${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn" style="margin-top:16px;background:oklch(0.7 0.15 280);color:oklch(1 0 0);width:100%;justify-content:center" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</section>`;
  }

  // TEMPLATE: deal-promo
  if (b.type === 'template' && b.template_key === 'deal-promo') {
    return `<section class="promo-banner promo-deal" data-banner-id="${id}" style="border:2px solid var(--accent)"><div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">${td.badge ? `<span style="background:var(--accent);color:var(--accent-fg,oklch(0.18 0.04 155));padding:6px 14px;border-radius:var(--r-full);font-family:var(--font-display);font-size:18px;font-weight:800">${esc(td.badge)}</span>` : ''}<div style="flex:1"><h3 style="margin:0 0 4px;font-size:18px">${esc(td.title)}</h3>${td.description ? `<p style="margin:0;font-size:14px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}</div><div style="text-align:right">${td.original_price ? `<span style="text-decoration:line-through;color:var(--text-subtle);font-size:14px">${esc(td.original_price)}</span>` : ''} ${td.sale_price ? `<span style="font-family:var(--font-display);font-size:28px;font-weight:800;color:var(--accent)">${esc(td.sale_price)}</span>` : ''}<br>${td.cta_label && td.cta_url ? `<a href="${esc(td.cta_url)}" class="btn btn-sm btn-accent" style="margin-top:8px" target="_blank" rel="noopener">${esc(td.cta_label)}</a>` : ''}</div></div></section>`;
  }

  // TEMPLATE: testimonials
  if (b.type === 'template' && b.template_key === 'testimonials') {
    const ts = [];
    if (td.t1_text) ts.push({ text: td.t1_text, author: td.t1_author || '' });
    if (td.t2_text) ts.push({ text: td.t2_text, author: td.t2_author || '' });
    if (td.t3_text) ts.push({ text: td.t3_text, author: td.t3_author || '' });
    return `<section class="promo-banner promo-testimonials" data-banner-id="${id}">${td.title ? `<h3 style="margin:0 0 20px;text-align:center;font-size:18px">${esc(td.title)}</h3>` : ''}<div style="display:grid;grid-template-columns:repeat(${Math.min(ts.length, 3)},1fr);gap:var(--s-4)">${ts.map((t) => `<blockquote style="margin:0;padding:var(--s-4);background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-xl)"><p style="margin:0 0 8px;font-size:14px;line-height:1.6;font-style:italic">${esc(t.text)}</p>${t.author ? `<cite style="font-size:12px;color:var(--text-subtle);font-style:normal">— ${esc(t.author)}</cite>` : ''}</blockquote>`).join('')}</div></section>`;
  }

  // TEMPLATE: social-share
  if (b.type === 'template' && b.template_key === 'social-share') {
    return `<section class="promo-banner promo-social-share" data-banner-id="${id}" style="text-align:center;padding:var(--s-6)"><h3 style="margin:0 0 8px;font-size:18px">${esc(td.title)}</h3>${td.description ? `<p style="margin:0 0 16px;font-size:14px;color:var(--text-muted)">${esc(td.description)}</p>` : ''}<div style="display:flex;justify-content:center;gap:12px"><button class="btn btn-sm" data-share="twitter">Twitter</button><button class="btn btn-sm" data-share="facebook">Facebook</button><button class="btn btn-sm" data-share="copy">Kopírovať</button></div></section>`;
  }

  // CUSTOM

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
function rvxIcon(name) {
  const icons = {
    flame:
      '<path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 1-3s-3 2-3 6a6 6 0 0 0 12 0c0-6-6-11-6-11z"/>',
    rocket: '<path d="M5 13l4 4M12 2c5 2 8 6 8 12 0 0-4-1-6 1s-1 6-1 6c-6 0-10-3-12-8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    star: '<path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    image:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7" cy="7" r="1.5"/>',
    edit: '<path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    category:
      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    trending: '<path d="M22 7l-8 8-4-4-7 7M16 7h6v6"/>',
    close: '<path d="M18 6L6 18M6 6l12 12"/>',
  };
  const path = icons[name] || icons.check;
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

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
