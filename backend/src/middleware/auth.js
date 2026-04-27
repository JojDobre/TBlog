/**
 * Auth middleware
 *
 *   attachUser    — načíta usera z DB podľa req.session.userId. Beží na
 *                   každom requeste. Ak je user banovaný alebo neexistuje,
 *                   session sa zničí.
 *
 *   requireAuth() — middleware factory. Ak req.user nie je nastavený,
 *                   redirectne na login s ?next=originalUrl.
 *
 *   requireRole(roles) — vyžaduje že user má jednu z daných rolí.
 *                   Inak vráti 403. Beží AŽ PO requireAuth.
 */

'use strict';

const db = require('../db');
const log = require('../logger');

// ---------------------------------------------------------------------------
// attachUser
// ---------------------------------------------------------------------------

async function attachUser(req, res, next) {
  // default — žiaden prihlásený user
  res.locals.user = null;

  if (!req.session?.userId) {
    return next();
  }

  try {
    const user = await db('users').where('id', req.session.userId).first();

    if (!user || user.is_banned) {
      // Stale session — user vymazaný alebo banovaný. Vyhoď session.
      req.session.destroy(() => {});
      return next();
    }

    // bezpečné — len prečítané z vlastnej DB
    req.user = user;

    // Vo views je `user` len verejne prijateľný subset
    res.locals.user = {
      id: user.id,
      role: user.role,
      nickname: user.nickname,
      email: user.email,
      avatar_media_id: user.avatar_media_id,
    };

    next();
  } catch (err) {
    log.error('attachUser failed', { err: err.message });
    next(err);
  }
}

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

/**
 * Factory: vytvorí middleware ktorý vyžaduje prihlásenie.
 *
 * @param {Object} [opts]
 * @param {string} [opts.redirectTo='/admin/login']
 *        kam presmerovať ak user nie je prihlásený
 */
function requireAuth(opts = {}) {
  const redirectTo = opts.redirectTo || '/admin/login';
  return (req, res, next) => {
    if (req.user) return next();

    // Zachovať pôvodnú URL aby sa po prihlásení dalo vrátiť
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`${redirectTo}?next=${nextUrl}`);
  };
}

// ---------------------------------------------------------------------------
// requireRole
// ---------------------------------------------------------------------------

/**
 * Factory: vyžaduje že user má jednu z daných rolí.
 * Použitie:
 *   router.use(requireRole('admin'))
 *   router.use(requireRole('admin', 'editor'))
 *   router.use(requireRole(['admin', 'editor']))
 */
function requireRole(...allowed) {
  const roles = allowed.flat();
  return (req, res, next) => {
    if (!req.user) {
      // defensive — malo by byť obstarané requireAuth-om predtým
      return res.redirect('/admin/login');
    }
    if (!roles.includes(req.user.role)) {
      const err = new Error('Na túto akciu nemáš oprávnenie.');
      err.status = 403;
      return next(err);
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
