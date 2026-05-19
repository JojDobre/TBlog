/**
 * Newsletter routes
 *
 * POST /api/newsletter/subscribe  — AJAX prihlásenie
 * GET  /newsletter/odhlasit/:token — unsubscribe stránka
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const log = require('../logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/newsletter/subscribe
// ---------------------------------------------------------------------------

router.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 255);
    const source = String(req.body.source || 'homepage').slice(0, 100);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Zadaj platnú emailovú adresu.' });
    }

    // Check if already subscribed
    const existing = await db('newsletter_subscribers').where('email', email).first();

    if (existing) {
      if (existing.is_active) {
        return res.json({ ok: true, message: 'Tento email je už prihlásený.' });
      }
      // Re-subscribe
      await db('newsletter_subscribers').where('id', existing.id).update({
        is_active: true,
        unsubscribed_at: null,
        source,
      });
      log.info('newsletter re-subscribed', { email });
      return res.json({ ok: true, message: 'Úspešne prihlásený do newslettera!' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await db('newsletter_subscribers').insert({
      email,
      unsubscribe_token: token,
      is_active: true,
      source,
    });

    log.info('newsletter subscribed', { email, source });
    res.json({ ok: true, message: 'Úspešne prihlásený do newslettera!' });
  } catch (err) {
    log.error('newsletter subscribe failed', { err: err.message });
    res.status(500).json({ error: 'Nastala chyba, skús to znova.' });
  }
});

// ---------------------------------------------------------------------------
// GET /newsletter/odhlasit/:token — unsubscribe
// ---------------------------------------------------------------------------

router.get('/newsletter/odhlasit/:token', async (req, res) => {
  try {
    const token = req.params.token;

    const sub = await db('newsletter_subscribers')
      .where('unsubscribe_token', token)
      .where('is_active', true)
      .first();

    if (!sub) {
      return res.render('newsletter/unsubscribed', {
        title: 'Newsletter',
        currentPath: '/newsletter',
        success: false,
        message: 'Tento odkaz je neplatný alebo ste sa už odhlásili.',
      });
    }

    await db('newsletter_subscribers').where('id', sub.id).update({
      is_active: false,
      unsubscribed_at: new Date(),
    });

    log.info('newsletter unsubscribed', { email: sub.email });

    res.render('newsletter/unsubscribed', {
      title: 'Newsletter — odhlásenie',
      currentPath: '/newsletter',
      success: true,
      message: 'Boli ste úspešne odhlásení z newslettera.',
    });
  } catch (err) {
    log.error('newsletter unsubscribe failed', { err: err.message });
    res.render('newsletter/unsubscribed', {
      title: 'Newsletter',
      currentPath: '/newsletter',
      success: false,
      message: 'Nastala chyba, skúste to znova.',
    });
  }
});

module.exports = router;
