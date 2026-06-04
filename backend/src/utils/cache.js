'use strict';

/**
 * Jednoduchý in-memory cache s TTL.
 * 
 * Použitie:
 *   const data = await cache.getOrSet('homepage', 60, async () => { ...db query... });
 *   cache.del('homepage');        // manuálna invalidácia
 *   cache.delPrefix('listing:');  // invalidácia podľa prefixu
 *   cache.clear();                // vyčistiť všetko
 */

const store = new Map();

function getOrSet(key, ttlSeconds, fetchFn) {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return Promise.resolve(entry.value);
  }
  return fetchFn().then(function (value) {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  });
}

function del(key) {
  store.delete(key);
}

function delPrefix(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

function clear() {
  store.clear();
}

module.exports = { getOrSet, del, delPrefix, clear };
