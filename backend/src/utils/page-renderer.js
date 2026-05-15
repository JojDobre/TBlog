/**
 * Page block renderer  (Phase 2 — static pages)
 *
 * Konvertuje page-specific JSON bloky na HTML string pre verejný frontend.
 * Zdieľa esc() a inlineFormat() s article block-renderer.
 */

'use strict';

const { esc } = require('./block-renderer');

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

// SVG ikony pre page bloky (subset)
const ICONS = {
  flame: '<path d="M12 2c.5 2.5 2 4.5 2 7a4 4 0 1 1-8 0c0-2.5 2-6 4-9a18 18 0 0 1 2 2z"/>',
  scale: '<path d="M12 3v19M5 8l7-5 7 5M5 8v4a7 7 0 0 0 14 0V8"/>',
  users:
    '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 11a4 4 0 0 0 0-8M22 21a7 7 0 0 0-5-6.7"/>',
  rocket:
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash:
    '<polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/>',
  close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  tag: '<path d="M20 12l-8 8a2 2 0 0 1-2.8 0L3 13.8a2 2 0 0 1 0-2.8L11 3h9v9z"/><circle cx="16" cy="8" r="1.5"/>',
  comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};

function icon(name, size = 16) {
  const d = ICONS[name] || ICONS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
}

/**
 * Renderuje pole page blokov na HTML.
 */
function renderPageBlocks(blocks, opts = {}) {
  if (!Array.isArray(blocks)) return { html: '', sections: [] };
  const mediaMap = opts.mediaMap || new Map();
  const output = [];
  const sections = []; // pre TOC
  let sectionIndex = 0;

  for (const b of blocks) {
    if (!b || !b.type) continue;

    // Heading bloky = sekcie pre TOC
    if (b.type === 'heading' && b.text) {
      sectionIndex++;
      const id = slugify(b.text);
      sections.push({ id, text: b.text, num: sectionIndex });
      const tag = b.level === 3 ? 'h3' : 'h2';
      output.push(
        `<section id="${id}" class="sp-section">` +
          `<header class="sp-section-head">` +
          `<span class="sp-section-num">${String(sectionIndex).padStart(2, '0')}</span>` +
          `<${tag}>${esc(b.text)}</${tag}>` +
          `</header>`
      );
      continue;
    }

    const html = renderSinglePageBlock(b, mediaMap);
    if (html) output.push(html);
  }

  // Close any open section
  return { html: output.join('\n'), sections };
}

function renderSinglePageBlock(b, mediaMap) {
  switch (b.type) {
    case 'paragraph':
      if (!b.text) return '';
      return (
        '<p class="sp-section-body">' +
        b.text
          .split(/\n\n+/)
          .filter(Boolean)
          .map((par) => inlineFormat(par).replace(/\n/g, '<br>'))
          .join('</p><p class="sp-section-body">') +
        '</p>'
      );

    case 'image': {
      const media = mediaMap.get(b.media_id);
      if (!media) return '';
      return (
        '<figure class="sp-figure">' +
        `<img src="/uploads/${esc(media.original_path || media.thumbnail_path)}" alt="${esc(b.alt || '')}" loading="lazy">` +
        (b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : '') +
        '</figure>'
      );
    }

    case 'divider':
      return '<hr class="sp-divider">';

    case 'sp_values':
      if (!Array.isArray(b.items) || b.items.length === 0) return '';
      return (
        '<div class="sp-values">' +
        b.items
          .map(
            (v) =>
              '<article class="sp-value">' +
              `<span class="sp-value-icon">${icon(v.icon, 18)}</span>` +
              '<div>' +
              `<h4>${esc(v.title)}</h4>` +
              `<p>${esc(v.desc)}</p>` +
              '</div></article>'
          )
          .join('') +
        '</div>'
      );

    case 'sp_team':
      if (!Array.isArray(b.members) || b.members.length === 0) return '';
      return (
        '<div class="sp-team">' +
        b.members
          .map((m) => {
            const initials = m.name
              .split(' ')
              .map((s) => s[0] || '')
              .slice(0, 2)
              .join('')
              .toUpperCase();
            return (
              '<article class="sp-team-card">' +
              `<div class="sp-team-avatar"><span class="avatar">${initials}</span></div>` +
              '<div class="sp-team-body">' +
              `<h4>${esc(m.name)}</h4>` +
              `<span class="sp-team-role">${esc(m.role)}</span>` +
              `<p>${esc(m.bio)}</p>` +
              '</div></article>'
            );
          })
          .join('') +
        '</div>'
      );

    case 'sp_contact_cta':
      return (
        '<div class="sp-cta">' +
        '<div class="sp-cta-text">' +
        (b.title ? `<h4>${esc(b.title)}</h4>` : '') +
        (b.text ? `<p>${esc(b.text)}</p>` : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        (b.email
          ? `<a href="mailto:${esc(b.email)}" class="btn btn-accent">${esc(b.email)}</a>`
          : '') +
        (b.show_pgp ? '<button class="btn">PGP kľúč</button>' : '') +
        '</div></div>'
      );

    case 'sp_contact_form':
      return (
        '<form class="sp-form" method="POST" action="/kontakt">' +
        '<input type="hidden" name="_csrf" value="">' +
        '<div class="sp-form-row">' +
        '<label><span>Meno</span><input class="sp-input" name="name" placeholder="Tvoje meno" required maxlength="120"></label>' +
        '<label><span>Email</span><input class="sp-input" type="email" name="email" placeholder="ty@example.sk" required maxlength="255"></label>' +
        '</div>' +
        '<label><span>Téma</span><select class="sp-input" name="subject">' +
        '<option>Všeobecná otázka</option>' +
        '<option>Tip na článok / recenziu</option>' +
        '<option>Inzercia &amp; partnerstvá</option>' +
        '<option>Tech / chyba na webe</option>' +
        '<option>GDPR / vymazanie údajov</option>' +
        '<option>Iné</option>' +
        '</select></label>' +
        '<label><span>Správa</span><textarea class="sp-input" name="message" rows="6" placeholder="Píš tak, ako keby si nám napísal email…" required maxlength="5000"></textarea></label>' +
        '<div class="sp-form-foot">' +
        `<span class="sp-form-hint">${icon('info', 11)} Odpisujeme do 48 hodín. Cez víkend možno neskôr.</span>` +
        `<button type="submit" class="btn btn-accent">Odoslať ${icon('send', 13)}</button>` +
        '</div></form>'
      );

    case 'sp_channels':
      if (!Array.isArray(b.channels) || b.channels.length === 0) return '';
      return (
        '<div class="sp-channels">' +
        b.channels
          .map(
            (c) =>
              '<a class="sp-channel">' +
              `<span class="sp-channel-icon">${icon(c.icon, 16)}</span>` +
              '<div>' +
              `<span class="sp-channel-label">${esc(c.label)}</span>` +
              `<strong>${esc(c.value)}</strong>` +
              `<span class="sp-channel-note">${esc(c.note)}</span>` +
              '</div>' +
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg>` +
              '</a>'
          )
          .join('') +
        '</div>'
      );

    case 'sp_office':
      return (
        '<div class="sp-office">' +
        '<div class="sp-office-map ph ph-grid"><div class="sp-office-pin"><span class="sp-office-pin-dot"></span><span class="sp-office-pin-label">Sídlo</span></div></div>' +
        '<div class="sp-office-info">' +
        (b.address ? `<h4>${esc(b.address)}</h4>` : '') +
        (b.description ? `<p>${esc(b.description)}</p>` : '') +
        (Array.isArray(b.stats) && b.stats.length > 0
          ? '<div class="sp-office-stats">' +
            b.stats
              .map((s) => `<div><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></div>`)
              .join('') +
            '</div>'
          : '') +
        (b.map_url
          ? `<a href="${esc(b.map_url)}" target="_blank" rel="noopener" class="btn btn-sm">Otvoriť v mapách <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M7 7h10v10"/></svg></a>`
          : '') +
        '</div></div>'
      );

    case 'sp_key_value':
      if (!Array.isArray(b.items) || b.items.length === 0) return '';
      return (
        '<div class="sp-rows">' +
        b.items
          .map(
            (it) =>
              '<div class="sp-row">' +
              `<span class="sp-row-k">${esc(it.key)}</span>` +
              `<span class="sp-row-v">${esc(it.value)}</span>` +
              '</div>'
          )
          .join('') +
        '</div>'
      );

    case 'sp_rights':
      if (!Array.isArray(b.items) || b.items.length === 0) return '';
      return (
        '<div class="sp-rights">' +
        b.items
          .map(
            (r) =>
              '<article class="sp-right">' +
              `<span class="sp-right-icon">${icon(r.icon, 14)}</span>` +
              `<h5>${esc(r.title)}</h5>` +
              `<p>${esc(r.desc)}</p>` +
              '</article>'
          )
          .join('') +
        '</div>'
      );

    case 'sp_cookies':
      if (!Array.isArray(b.rows) || b.rows.length === 0) return '';
      return (
        '<table class="sp-table"><thead><tr>' +
        '<th>Cookie</th><th>Účel</th><th>Platnosť</th><th>Typ</th>' +
        '</tr></thead><tbody>' +
        b.rows
          .map((c) => {
            const cls =
              c.cookie_type === 'Nutný'
                ? 'sp-cookie-required'
                : c.cookie_type === 'Funkčný'
                  ? 'sp-cookie-func'
                  : 'sp-cookie-analytics';
            return (
              '<tr>' +
              `<td><code>${esc(c.name)}</code></td>` +
              `<td>${esc(c.purpose)}</td>` +
              `<td>${esc(c.ttl)}</td>` +
              `<td><span class="sp-cookie-type ${cls}">${esc(c.cookie_type)}</span></td>` +
              '</tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      );

    case 'sp_summary':
      return (
        '<div class="sp-summary">' +
        '<div class="sp-summary-tldr">' +
        '<span class="sp-summary-tag">TL;DR</span>' +
        `<p>${esc(b.tldr)}</p>` +
        '</div>' +
        (b.body ? `<p class="sp-summary-body">${inlineFormat(b.body)}</p>` : '') +
        '</div>'
      );

    case 'sp_legal_meta':
      if (!Array.isArray(b.items) || b.items.length === 0) return '';
      return (
        '<div class="sp-legal-meta">' +
        b.items
          .map(
            (m) =>
              '<div class="sp-legal-meta-item">' +
              `<span class="sp-legal-meta-label">${esc(m.label)}</span>` +
              `<span class="sp-legal-meta-value">${esc(m.value)}</span>` +
              '</div>'
          )
          .join('') +
        '</div>'
      );

    default:
      return '';
  }
}

module.exports = { renderPageBlocks };
