/**
 * Track-visit middleware
 *
 * Na každý GET request verejnej stránky asynchrónne zapíše záznam do
 * `page_visits`. Insert nečaká (fire-and-forget) — chyba pri zápise
 * sa zaloguje, ale nikdy neblokuje response.
 *
 * Skipuje:
 *   - non-GET metódy
 *   - /admin/*, /api/*, /uploads/*, /health
 *   - statické assety (/.well-known, /favicon.ico, súbory s príponou)
 *   - bots (heuristicky podľa User-Agent)
 *
 * Article/page ID sa do záznamu doplní neskôr — buď v route handleri
 * (najbližšia fáza) alebo aggregačným cronom. Preto teraz uložíme len
 * path + meta.
 */

'use strict';

const db = require('../db');
const log = require('../logger');
const { hashIp, getClientIp } = require('../utils/ip-hash');

// cesty, ktoré nikdy netrackujeme
const SKIP_PREFIXES = ['/admin', '/api', '/uploads', '/static', '/health', '/.well-known'];
const SKIP_EXACT = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml']);

// Heuristika pre bot detekciu (rozšírime neskôr ak bude treba)
const BOT_RE = /bot|crawler|spider|crawling|slurp|facebookexternalhit|whatsapp|telegrambot/i;

function shouldSkip(req) {
  if (req.method !== 'GET') return true;
  if (SKIP_EXACT.has(req.path)) return true;
  for (const prefix of SKIP_PREFIXES) {
    if (req.path.startsWith(prefix + '/') || req.path === prefix) return true;
  }
  // súbory typu /something.css, /something.js — preskočiť
  if (/\.[a-z0-9]{1,5}$/i.test(req.path)) return true;

  const ua = req.headers['user-agent'] || '';
  if (BOT_RE.test(ua)) return true;

  return false;
}

module.exports = function trackVisit(req, res, next) {
  if (shouldSkip(req)) return next();

  // získať IP a hashnuť
  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  // skrátený UA (max 120 chars)
  const ua = (req.headers['user-agent'] || '').slice(0, 120) || null;
  const referer = (req.headers.referer || req.headers.referrer || '').slice(0, 500) || null;

  // useruj len skutočne prihláseného (nie anonymné session)
  const userId = req.session?.user?.id || null;

  // truncate path na 500 chars (limit stĺpca)
  const path = req.originalUrl.slice(0, 500);

  // fire-and-forget insert
  db('page_visits')
    .insert({
      path,
      user_id: userId,
      ip_hash: ipHash || '0'.repeat(64),
      referer,
      user_agent_short: ua,
    })
    .catch((err) => {
      // nikdy nesfailovať request kvôli trackingu
      log.warn('track-visit insert failed', { err: err.message, path });
    });

  next();
};
