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
 *                   Ak nie, vyrenderuje verejnú 403 stránku (NIE admin
 *                   layout — reader nemá vidieť admin sidebar).
 */

'use strict';

const db = require('../db');
const log = require('../logger');

async function attachUser(req, res, next) {
  res.locals.user = null;

  if (!req.session?.userId) {
    return next();
  }

  try {
    const user = await db('users')
      .leftJoin('media', 'users.avatar_media_id', 'media.id')
      .where('users.id', req.session.userId)
      .select('users.*', 'media.thumbnail_path as avatar_path')
      .first();

    if (!user || user.is_banned) {
      req.session.destroy(() => {});
      return next();
    }

    req.user = user;
    res.locals.user = {
      id: user.id,
      role: user.role,
      nickname: user.nickname,
      email: user.email,
      avatar_media_id: user.avatar_media_id,
      avatar_path: user.avatar_path || null,
    };

    next();
  } catch (err) {
    log.error('attachUser failed', { err: err.message });
    next(err);
  }
}

function requireAuth(opts = {}) {
  const redirectTo = opts.redirectTo || '/admin/login';
  return (req, res, next) => {
    if (req.user) return next();
    const nextUrl = encodeURIComponent(req.originalUrl);
    return res.redirect(`${redirectTo}?next=${nextUrl}`);
  };
}

/**
 * Factory: vyžaduje že user má jednu z daných rolí.
 *
 * Ak user nie je prihlásený → redirect na login.
 * Ak je prihlásený ale nemá rolu → render verejnej 403 stránky.
 *
 * Zámerne renderujeme VEREJNÚ 403, nie admin error stránku — keď reader
 * skúša ísť na /admin/*, nemá zmysel mu ukázať admin layout. Verejná 403
 * je v rovnakej kostre ako zvyšok webu (header + footer + dropdown s
 * odhlásením), takže user sa môže odhlásiť alebo ísť späť.
 */
function requireRole(...allowed) {
  const roles = allowed.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.redirect('/admin/login');
    }
    if (!roles.includes(req.user.role)) {
      log.info('access denied', {
        userId: req.user.id,
        role: req.user.role,
        path: req.originalUrl,
        required: roles,
      });
      return res.status(403).render('errors/403', {
        title: 'Bez oprávnenia',
      });
    }
    next();
  };
}

module.exports = { attachUser, requireAuth, requireRole };
