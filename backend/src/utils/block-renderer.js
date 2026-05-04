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
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
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
          parts.push(`<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="${esc(b.alt || '')}" loading="lazy">`);
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
          parts.push(`<iframe src="https://www.youtube.com/embed/${esc(b.video_id)}" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`);
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
            parts.push(`<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="" loading="lazy">`);
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
