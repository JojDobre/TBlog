'use strict';

/**
 * Normalizuje a validuje URL pre použitie v href.
 * - Povolí: http(s) URL, relatívne URL (začínajúce '/')
 * - Odstráni nebezpečné schémy: javascript:, data:, vbscript: → vráti null
 * - Markdown [text](url) → vytiahne url
 * - URL bez schémy → predpokladá https://
 *
 * @param {string} raw
 * @returns {string|null}
 */
function safeExternalUrl(raw) {
  let url = String(raw || '')
    .trim()
    .slice(0, 500);
  if (!url) return null;

  // markdown [text](url) → url
  const md = url.match(/\]\((https?:\/\/[^)]+)\)/);
  if (md) url = md[1];

  // relatívny interný odkaz
  if (url.startsWith('/')) return url;

  // ak má schému, povoľ len http/https
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    if (!/^https?:\/\//i.test(url)) return null;
    return url;
  }

  // bez schémy → https
  return 'https://' + url;
}

module.exports = { safeExternalUrl };
