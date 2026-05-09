/**
 * Block renderer  (Phase 6.2)
 *
 * Konvertuje JSON content bloky na HTML string pre verejný frontend.
 * Escapuje HTML vo všetkých textových poliach (XSS prevencia).
 */

'use strict';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Jednoduchý inline markdown: **bold**, *italic*, [text](url)
 */
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

/**
 * Renderuje pole blokov na HTML string.
 *
 * @param {Array} blocks
 * @param {Object} opts  — { mediaMap: Map<id, {thumbnail_path, original_path}> }
 * @returns {string} HTML
 */
function renderBlocks(blocks, opts = {}) {
  if (!Array.isArray(blocks)) return '';
  const mediaMap = opts.mediaMap || new Map();
  const parts = [];

  for (const b of blocks) {
    if (!b || !b.type) continue;

    switch (b.type) {
      case 'paragraph':
        if (b.text) {
          // Rozdeľ na odstavce podľa \n\n
          const paragraphs = b.text.split(/\n\n+/).filter(Boolean);
          for (const p of paragraphs) {
            parts.push('<p>' + inlineFormat(p).replace(/\n/g, '<br>') + '</p>');
          }
        }
        break;

      case 'heading':
        if (b.text) {
          const tag = b.level === 3 ? 'h3' : 'h2';
          const id = slugify(b.text);
          parts.push(`<${tag} id="${id}">${esc(b.text)}</${tag}>`);
        }
        break;

      case 'image': {
        const media = mediaMap.get(b.media_id);
        if (media) {
          parts.push('<figure>');
          parts.push(
            `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="${esc(b.alt || '')}" loading="lazy">`
          );
          if (b.caption) {
            parts.push(`<figcaption>${esc(b.caption)}</figcaption>`);
          }
          parts.push('</figure>');
        }
        break;
      }

      case 'divider':
        parts.push('<hr>');
        break;

      case 'youtube':
        if (b.video_id) {
          parts.push('<figure class="article-video">');
          parts.push('<div class="video-wrap">');
          parts.push(
            `<iframe src="https://www.youtube.com/embed/${esc(b.video_id)}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
          );
          parts.push('</div>');
          if (b.caption) parts.push(`<figcaption>${esc(b.caption)}</figcaption>`);
          parts.push('</figure>');
        }
        break;

      case 'quote':
        if (b.text) {
          parts.push('<blockquote>');
          parts.push('<p>' + esc(b.text) + '</p>');
          if (b.author) parts.push(`<cite>— ${esc(b.author)}</cite>`);
          parts.push('</blockquote>');
        }
        break;

      case 'gallery':
        if (Array.isArray(b.items) && b.items.length > 0) {
          parts.push('<div class="article-gallery">');
          for (const item of b.items) {
            const media = mediaMap.get(item.media_id);
            if (!media) continue;
            parts.push('<figure class="article-gallery-item">');
            parts.push(
              `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
            );
            if (item.caption) parts.push(`<figcaption>${esc(item.caption)}</figcaption>`);
            parts.push('</figure>');
          }
          parts.push('</div>');
        }
        break;

      case 'list':
        if (Array.isArray(b.items) && b.items.length > 0) {
          const tag = b.ordered ? 'ol' : 'ul';
          parts.push(`<${tag}>`);
          for (const item of b.items) {
            parts.push(`<li>${inlineFormat(item)}</li>`);
          }
          parts.push(`</${tag}>`);
        }
        break;

      case 'section': {
        const layoutCls =
          b.layout === 'split'
            ? ' cs-split'
            : b.layout === 'split-reverse'
              ? ' cs-split cs-split--reverse'
              : b.layout === 'grid'
                ? ' cs-grid'
                : '';
        const media = b.media_id ? mediaMap.get(b.media_id) : null;
        const isVideo = !!b.video_url;
        const tiltCls = b.media_style === 'tilt' ? ' cs-split-media--tilt' : '';
        const videoCls = isVideo ? ' cs-media--video' : '';

        // Determine title class
        let titleCls = 'cs-title';
        if (b.title_style === 'xl') titleCls += ' cs-title--xl';
        else if (b.title_style === 'gradient') titleCls += ' cs-title--gradient';
        else if (b.title_style === 'accent') titleCls += ' cs-title--accent';
        const titleStyle = b.title_style === 'centered' ? ' style="text-align:center;"' : '';

        if (b.layout === 'grid') {
          // Grid layout: text left, title right, media below
          parts.push(`<section class="cs cs-grid">`);
          if (b.text) {
            parts.push(`<div class="cs-grid-text"><div class="cs-text">`);
            for (const p of b.text.split(/\n\n+/).filter(Boolean)) {
              parts.push('<p>' + inlineFormat(p).replace(/\n/g, '<br>') + '</p>');
            }
            parts.push(`</div></div>`);
          }
          if (b.title) {
            parts.push(
              `<div class="cs-grid-title"><h2 class="${titleCls}">${esc(b.title)}</h2></div>`
            );
          }
          if (media) {
            if (isVideo) {
              parts.push(`<figure class="cs-grid-media cs-media--video">`);
              parts.push(
                `<a href="${esc(b.video_url)}" target="_blank" rel="noopener" class="cs-video-link">`
              );
              parts.push(
                `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
              );
              parts.push(
                `<div class="cs-play-btn"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`
              );
              parts.push(`</a></figure>`);
            } else {
              parts.push(
                `<figure class="cs-grid-media"><img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy"></figure>`
              );
            }
            if (b.caption)
              parts.push(`<figcaption class="cs-grid-figcaption">${esc(b.caption)}</figcaption>`);
          }
          parts.push(`</section>`);
        } else if (b.layout === 'split' || b.layout === 'split-reverse') {
          // Split layout
          parts.push(`<section class="cs${layoutCls}">`);
          parts.push(`<div class="cs-split-text">`);
          if (b.eyebrow) parts.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
          if (b.title) parts.push(`<h2 class="${titleCls}"${titleStyle}>${esc(b.title)}</h2>`);
          if (b.show_divider) parts.push(`<div class="cs-divider"></div>`);
          if (b.text) {
            parts.push(`<div class="cs-text">`);
            for (const p of b.text.split(/\n\n+/).filter(Boolean)) {
              parts.push('<p>' + inlineFormat(p).replace(/\n/g, '<br>') + '</p>');
            }
            parts.push(`</div>`);
          }
          parts.push(`</div>`);
          if (media) {
            if (b.media_style === 'tilt') {
              parts.push(`<figure class="cs-split-media cs-split-media--tilt${videoCls}">`);
              parts.push(`<div class="cs-tilt-shadow"></div><div class="cs-tilt-img">`);
              if (isVideo) {
                parts.push(
                  `<a href="${esc(b.video_url)}" target="_blank" rel="noopener" class="cs-video-link">`
                );
                parts.push(
                  `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
                );
                parts.push(
                  `<div class="cs-play-btn"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`
                );
                parts.push(`</a>`);
              } else {
                parts.push(
                  `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
                );
              }
              parts.push(`<div class="cs-tilt-shine"></div></div></figure>`);
            } else {
              parts.push(`<figure class="cs-split-media${videoCls}">`);
              if (isVideo) {
                parts.push(
                  `<a href="${esc(b.video_url)}" target="_blank" rel="noopener" class="cs-video-link">`
                );
                parts.push(
                  `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
                );
                parts.push(
                  `<div class="cs-play-btn"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`
                );
                parts.push(`</a>`);
              } else {
                parts.push(
                  `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
                );
              }
              parts.push(`</figure>`);
            }
          }
          parts.push(`</section>`);
        } else {
          // Default (stacked) layout
          parts.push(`<section class="cs">`);
          if (b.eyebrow) parts.push(`<span class="eyebrow">${esc(b.eyebrow)}</span>`);
          if (b.title) parts.push(`<h2 class="${titleCls}"${titleStyle}>${esc(b.title)}</h2>`);
          if (b.show_divider) parts.push(`<div class="cs-divider"></div>`);
          if (b.text) {
            parts.push(`<div class="cs-text">`);
            for (const p of b.text.split(/\n\n+/).filter(Boolean)) {
              parts.push('<p>' + inlineFormat(p).replace(/\n/g, '<br>') + '</p>');
            }
            parts.push(`</div>`);
          }
          if (media) {
            if (isVideo) {
              parts.push(`<figure class="cs-media cs-media--video">`);
              parts.push(
                `<a href="${esc(b.video_url)}" target="_blank" rel="noopener" class="cs-video-link">`
              );
              parts.push(
                `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`
              );
              parts.push(
                `<div class="cs-play-btn"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></div>`
              );
              parts.push(`</a></figure>`);
            } else {
              parts.push(
                `<figure class="cs-media"><img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="${esc(b.caption || '')}" loading="lazy"></figure>`
              );
            }
            if (b.caption) parts.push(`<figcaption>${esc(b.caption)}</figcaption>`);
          }
          parts.push(`</section>`);
        }
        break;
      }

      case 'pros_cons': {
        const hasPros = Array.isArray(b.pros) && b.pros.length > 0;
        const hasCons = Array.isArray(b.cons) && b.cons.length > 0;
        if (hasPros || hasCons) {
          parts.push('<div class="proscons">');
          if (hasPros) {
            parts.push('<div class="proscons-col proscons-col--pros">');
            parts.push(
              '<h6 class="proscons-title proscons-title--pros"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg> Páči sa nám</h6>'
            );
            parts.push('<ul>');
            for (const p of b.pros) {
              if (p) parts.push(`<li>${esc(p)}</li>`);
            }
            parts.push('</ul></div>');
          }
          if (hasCons) {
            parts.push('<div class="proscons-col proscons-col--cons">');
            parts.push(
              '<h6 class="proscons-title proscons-title--cons"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg> Zamyslíme sa</h6>'
            );
            parts.push('<ul>');
            for (const c of b.cons) {
              if (c) parts.push(`<li>${esc(c)}</li>`);
            }
            parts.push('</ul></div>');
          }
          parts.push('</div>');
        }
        break;
      }

      case 'specs': {
        if (Array.isArray(b.rows) && b.rows.length > 0) {
          parts.push('<div><h3 class="h-4" style="margin-bottom:24px;">Špecifikácie</h3>');
          parts.push('<table class="spec-table"><tbody>');
          for (const r of b.rows) {
            if (r.key || r.value) {
              parts.push(`<tr><th>${esc(r.key)}</th><td>${esc(r.value)}</td></tr>`);
            }
          }
          parts.push('</tbody></table></div>');
        }
        break;
      }

      case 'rating': {
        parts.push('<section class="verdict">');
        parts.push('<div class="verdict-score">');
        parts.push('<span class="verdict-score-label">Celkové skóre</span>');
        const sc = b.total_score ? Number(b.total_score).toFixed(1) : '—';
        parts.push(`<span class="verdict-score-num">${sc}</span>`);
        // Stars
        const fullStars = Math.round((b.total_score || 0) / 2);
        parts.push('<div class="verdict-stars">');
        for (let si = 0; si < 5; si++) {
          const fill = si < fullStars ? 'currentColor' : 'none';
          parts.push(
            `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5L12 3z"/></svg>`
          );
        }
        parts.push('</div>');
        if (b.badge) parts.push(`<span class="verdict-badge">${esc(b.badge)}</span>`);
        parts.push('</div>');
        parts.push('<div class="verdict-text">');
        if (b.verdict_title)
          parts.push(`<h3 class="h-3" style="margin:0 0 12px;">${esc(b.verdict_title)}</h3>`);
        if (b.verdict_text)
          parts.push(
            `<p style="color:var(--text-muted); font-size:16px; line-height:1.6; margin:0;">${esc(b.verdict_text)}</p>`
          );
        parts.push('</div></section>');
        // Breakdown bars
        if (Array.isArray(b.criteria) && b.criteria.length > 0) {
          parts.push(
            '<div><h3 class="h-4" style="margin-bottom:24px;">Hodnotenie podľa kategórií</h3>'
          );
          parts.push('<div class="score-bd">');
          for (const c of b.criteria) {
            if (c.name) {
              parts.push('<div class="score-bd-row">');
              parts.push(`<span class="score-bd-label">${esc(c.name)}</span>`);
              parts.push(
                `<div class="score-bar"><i style="width:${(c.score || 0) * 10}%;"></i></div>`
              );
              parts.push(`<span class="score-bd-val">${Number(c.score || 0).toFixed(1)}</span>`);
              parts.push('</div>');
            }
          }
          parts.push('</div></div>');
        }
        break;
      }

      case 'color_variants': {
        if (Array.isArray(b.variants) && b.variants.length > 0) {
          parts.push('<div class="color-variants">');
          parts.push('<h3 class="h-4" style="margin-bottom:16px;">Farebné varianty</h3>');
          parts.push('<div class="color-variants-grid">');
          for (const v of b.variants) {
            const media = v.media_id ? mediaMap.get(v.media_id) : null;
            parts.push('<div class="color-variant-item">');
            parts.push(
              `<span class="color-variant-swatch" style="background:${esc(v.hex)};"></span>`
            );
            parts.push(`<span class="color-variant-name">${esc(v.name)}</span>`);
            if (media) {
              parts.push(
                `<img src="/uploads/${esc(media.thumbnail_path || media.original_path)}" alt="${esc(v.name)}" loading="lazy" class="color-variant-img">`
              );
            }
            parts.push('</div>');
          }
          parts.push('</div></div>');
        }
        break;
      }

      case 'review_banner': {
        const bgMedia = b.background_media_id ? mediaMap.get(b.background_media_id) : null;
        parts.push(
          '<div class="review-banner"' +
            (bgMedia
              ? ` style="background-image:url(/uploads/${esc(bgMedia.original_path || bgMedia.thumbnail_path)})"`
              : '') +
            '>'
        );
        if (b.title) parts.push(`<h2 class="review-banner-title">${esc(b.title)}</h2>`);
        if (b.subtitle) parts.push(`<p class="review-banner-subtitle">${esc(b.subtitle)}</p>`);
        if (Array.isArray(b.buttons) && b.buttons.length > 0) {
          parts.push('<div class="review-banner-buttons">');
          for (const btn of b.buttons) {
            const cls =
              btn.style === 'ghost'
                ? 'btn btn-ghost'
                : btn.style === 'secondary'
                  ? 'btn'
                  : 'btn btn-primary';
            parts.push(`<a href="${esc(btn.anchor || '#')}" class="${cls}">${esc(btn.label)}</a>`);
          }
          parts.push('</div>');
        }
        // Slider images
        if (Array.isArray(b.slider_media_ids) && b.slider_media_ids.length > 0) {
          parts.push('<div class="review-banner-slider">');
          for (const mid of b.slider_media_ids) {
            const sm = mid ? mediaMap.get(mid) : null;
            if (sm) {
              parts.push(
                `<img src="/uploads/${esc(sm.original_path || sm.thumbnail_path)}" alt="" loading="lazy">`
              );
            }
          }
          parts.push('</div>');
        }
        parts.push('</div>');
        break;
      }
    }
  }

  return parts.join('\n');
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

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

module.exports = { renderBlocks, extractToc, esc };
