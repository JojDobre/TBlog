/**
 * IP hashing
 *
 * GDPR-friendly hashovanie IP adries:
 *   - žiadna IP sa nikdy neuloží do DB v plain texte
 *   - salt rotuje každý deň (HMAC zo session_secret + dátumu)
 *   - rovnaká IP v ten istý deň → rovnaký hash → vieme rátať unique visitors
 *   - v inom dni → iný hash → neidentifikovateľné cross-day
 *
 * Trade-off: ak by niekto získal SESSION_SECRET, vedel by brute-forcovať
 * IPv4 priestor (~4 mld) a reverznúť hashe v rámci retencie (90 dní).
 * Na bežný blog je to dostatočná ochrana — pre prísnejšie nasadenie by
 * salt mal byť oddelený a periodicky mazaný.
 *
 * IPv6 idú cez ten istý mechanizmus, len input je dlhší string.
 */

'use strict';

const crypto = require('crypto');
const config = require('../../../config');

/**
 * Vráti deterministický salt pre daný deň.
 * @param {Date} [date]
 * @returns {string} hex
 */
function getDailySalt(date = new Date()) {
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return crypto
    .createHmac('sha256', config.session.secret)
    .update('ip-salt:' + dateStr)
    .digest('hex');
}

/**
 * Hash IP adresy s denným saltom.
 * @param {string} ip
 * @param {Date} [date]
 * @returns {string} 64 hex znakov
 */
function hashIp(ip, date = new Date()) {
  if (!ip) return null;
  const salt = getDailySalt(date);
  return crypto
    .createHash('sha256')
    .update(salt + '|' + ip)
    .digest('hex');
}

/**
 * Vyextrahuje klientskú IP z requestu, pri proxy bere prvý X-Forwarded-For.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function getClientIp(req) {
  if (config.app.trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      return String(xff).split(',')[0].trim();
    }
  }
  return req.ip || req.socket?.remoteAddress || null;
}

module.exports = { getDailySalt, hashIp, getClientIp };
