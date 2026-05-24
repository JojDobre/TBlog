/**
 * Messages routes  (public — /spravy)
 *
 * GET  /spravy      — inbox (zoznam konverzácií)
 * GET  /spravy/:id  — detail konverzácie
 *
 * Vyžaduje prihlásenie. Dáta načítava frontend JS cez /api/messages/*.
 */

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth({ redirectTo: '/login' }));

// Inbox
router.get('/', (req, res) => {
  res.render('messages/inbox', {
    title: 'Správy',
    currentPath: '/spravy',
  });
});

// Detail konverzácie
router.get('/:id', (req, res) => {
  const convId = Number(req.params.id);
  if (!Number.isInteger(convId) || convId < 1) {
    return res.redirect('/spravy');
  }
  res.render('messages/conversation', {
    title: 'Konverzácia',
    currentPath: '/spravy',
    conversationId: convId,
  });
});

// Nájdi alebo vytvor konverzáciu s userom a presmeruj do nej
router.get('/novy/:nickname', async (req, res, next) => {
  try {
    const db = require('../db');
    const nickname = req.params.nickname;
    const userId = req.user.id;

    const recipient = await db('users')
      .where('nickname', nickname)
      .whereNot('id', userId)
      .where('is_banned', false)
      .first();

    if (!recipient) return res.redirect('/spravy');

    // Existuje direct konverzácia?
    const existing = await db('conversation_participants as cp1')
      .join('conversation_participants as cp2', 'cp1.conversation_id', 'cp2.conversation_id')
      .join('conversations as c', 'cp1.conversation_id', 'c.id')
      .where('cp1.user_id', userId)
      .where('cp2.user_id', recipient.id)
      .where('c.type', 'direct')
      .select('c.id')
      .first();

    if (existing) return res.redirect('/spravy/' + existing.id);

    // Vytvor novú prázdnu konverzáciu
    const [convId] = await db('conversations').insert({
      type: 'direct',
      last_message_at: null,
    });
    await db('conversation_participants').insert([
      { conversation_id: convId, user_id: userId },
      { conversation_id: convId, user_id: recipient.id },
    ]);

    res.redirect('/spravy/' + convId);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
