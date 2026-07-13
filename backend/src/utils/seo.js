/**
 * SEO helpers — canonical URL, meta robots, JSON-LD breadcrumbs.
 */

'use strict';

const config = require('../../../config');

/** Absolútna base URL webu (bez trailing slash). */
function getBaseUrl(req) {
  return config.baseUrl || `${req.protocol}://${req.get('host')}`;
}

/**
 * SEO dáta pre listing stránky (kategórie, tagy, rubriky, rebríčky).
 * - canonicalUrl: čistá URL; pri page > 1 s ?page=N
 * - metaRobots: 'noindex, follow' ak sú aktívne filtre (sort/type/tag/q),
 *   aby sa filtrované varianty neindexovali ako duplicitný obsah
 */
function buildListingSeo(req, path) {
  const baseUrl = getBaseUrl(req);
  const page = parseInt(req.query.page, 10) || 1;
  const hasFilters = Boolean(
    (req.query.sort && req.query.sort !== 'newest') ||
      req.query.type ||
      req.query.tag ||
      req.query.q
  );
  let canonicalUrl = baseUrl + path;
  if (page > 1) canonicalUrl += '?page=' + page;
  return {
    canonicalUrl,
    metaRobots: hasFilters ? 'noindex, follow' : null,
  };
}

/**
 * BreadcrumbList JSON-LD.
 * crumbs = [{ name, path }] — posledná položka (aktuálna stránka) bez path.
 */
function breadcrumbJsonLd(baseUrl, crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => {
      const el = { '@type': 'ListItem', position: i + 1, name: c.name };
      if (c.path) el.item = baseUrl + c.path;
      return el;
    }),
  };
}

module.exports = { getBaseUrl, buildListingSeo, breadcrumbJsonLd };
