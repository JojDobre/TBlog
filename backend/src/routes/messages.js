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
router.get('/spravy', (req, res) => {
  res.render('messages/inbox', {
    title: 'Správy',
    currentPath: '/spravy',
  });
});

// Detail konverzácie
router.get('/spravy/:id', (req, res) => {
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

module.exports = router;
