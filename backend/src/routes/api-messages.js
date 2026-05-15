/**
 * API messages routes  (mounted at /api/messages)
 *
 * GET    /conversations            — inbox (zoznam konverzácií)
 * GET    /conversations/:id        — vlákno správ v konverzácii
 * POST   /conversations            — nová konverzácia (prvá správa)
 * POST   /conversations/:id/messages — odpoveď v konverzácii
 * POST   /conversations/:id/read   — označiť ako prečítané
 * GET    /unread-count              — počet konverzácií s neprečítanými
 * GET    /users/search              — autocomplete príjemcov
 * POST   /broadcast                 — admin broadcast (len admin)
 */

'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const log = require('../logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { notifyNewMessage } = require('../utils/notifications');

const router = express.Router();

// Všetky endpointy vyžadujú prihlásenie
router.use((req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Neprihlásený.' });
  next();
});

// Rate limit na posielanie správ: 10 za minútu
const sendLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Príliš veľa správ. Počkaj chvíľu.' },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseId(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Overí, že user je účastníkom konverzácie.
 * @returns {object|null} participant row alebo null (+ pošle 403)
 */
async function requireParticipant(conversationId, userId, res) {
  const p = await db('conversation_participants')
    .where({ conversation_id: conversationId, user_id: userId })
    .first();
  if (!p) {
    res.status(403).json({ error: 'Nemáš prístup k tejto konverzácii.' });
    return null;
  }
  return p;
}

// ---------------------------------------------------------------------------
// GET /conversations — inbox
// ---------------------------------------------------------------------------

router.get('/conversations', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;

    // Konverzácie, v ktorých je user účastníkom
    const rows = await db('conversations as c')
      .join('conversation_participants as cp', 'c.id', 'cp.conversation_id')
      .where('cp.user_id', userId)
      .select(
        'c.id',
        'c.type',
        'c.last_message_at',
        'c.created_at',
        'cp.last_read_at',
        'cp.is_muted'
      )
      .orderByRaw('c.last_message_at IS NULL, c.last_message_at DESC')
      .limit(perPage)
      .offset(offset);

    // Pre každú konverzáciu: posledná správa + druhý účastník
    const conversations = [];
    for (const row of rows) {
      // Druhý účastník (pre direct/contact)
      const otherParticipant = await db('conversation_participants as cp')
        .join('users as u', 'cp.user_id', 'u.id')
        .leftJoin('media as m', 'u.avatar_media_id', 'm.id')
        .where('cp.conversation_id', row.id)
        .whereNot('cp.user_id', userId)
        .select('u.id as user_id', 'u.nickname', 'u.role', 'm.thumbnail_path as avatar_thumb')
        .first();

      // Posledná správa
      const lastMsg = await db('messages')
        .where('conversation_id', row.id)
        .orderBy('created_at', 'desc')
        .select('content', 'sender_id', 'is_system', 'created_at')
        .first();

      // Počet neprečítaných správ v tejto konverzácii
      let unreadCount = 0;
      const unreadQb = db('messages').where('conversation_id', row.id);
      if (row.last_read_at) {
        unreadQb.where('created_at', '>', row.last_read_at);
      }
      // Nepočítaj vlastné správy
      unreadQb.where(function () {
        this.whereNot('sender_id', userId).orWhereNull('sender_id');
      });
      const countRow = await unreadQb.count({ c: '*' }).first();
      unreadCount = Number(countRow.c);

      conversations.push({
        id: row.id,
        type: row.type,
        last_message_at: row.last_message_at,
        is_muted: !!row.is_muted,
        unread_count: unreadCount,
        other_user: otherParticipant || null,
        last_message: lastMsg
          ? {
              content:
                lastMsg.content.length > 100
                  ? lastMsg.content.substring(0, 100) + '…'
                  : lastMsg.content,
              is_system: !!lastMsg.is_system,
              is_mine: lastMsg.sender_id === userId,
              created_at: lastMsg.created_at,
            }
          : null,
      });
    }

    // Celkový počet konverzácií
    const totalRow = await db('conversation_participants')
      .where('user_id', userId)
      .count({ c: '*' })
      .first();

    res.json({
      conversations,
      pagination: {
        page,
        perPage,
        total: Number(totalRow.c),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /conversations/:id — vlákno správ
// ---------------------------------------------------------------------------

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ error: 'Neplatné ID.' });

    const participant = await requireParticipant(convId, req.user.id, res);
    if (!participant) return;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 30;
    const offset = (page - 1) * perPage;

    const conv = await db('conversations').where('id', convId).first();

    const messages = await db('messages as msg')
      .leftJoin('users as u', 'msg.sender_id', 'u.id')
      .leftJoin('media as m', 'msg.image_media_id', 'm.id')
      .where('msg.conversation_id', convId)
      .select(
        'msg.id',
        'msg.content',
        'msg.is_system',
        'msg.created_at',
        'msg.sender_id',
        'u.nickname as sender_nickname',
        'u.role as sender_role',
        'm.original_path as image_path',
        'm.thumbnail_path as image_thumb'
      )
      .orderBy('msg.created_at', 'desc')
      .limit(perPage)
      .offset(offset);

    // Označ ako prečítané
    await db('conversation_participants')
      .where({ conversation_id: convId, user_id: req.user.id })
      .update({ last_read_at: new Date() });

    const totalRow = await db('messages')
      .where('conversation_id', convId)
      .count({ c: '*' })
      .first();

    // Druhý účastník
    const otherUser = await db('conversation_participants as cp')
      .join('users as u', 'cp.user_id', 'u.id')
      .leftJoin('media as m', 'u.avatar_media_id', 'm.id')
      .where('cp.conversation_id', convId)
      .whereNot('cp.user_id', req.user.id)
      .select('u.id as user_id', 'u.nickname', 'u.role', 'm.thumbnail_path as avatar_thumb')
      .first();

    res.json({
      conversation: {
        id: conv.id,
        type: conv.type,
        created_at: conv.created_at,
        other_user: otherUser || null,
      },
      messages: messages.reverse(), // chronologicky
      pagination: {
        page,
        perPage,
        total: Number(totalRow.c),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /conversations — nová konverzácia
// ---------------------------------------------------------------------------

router.post('/conversations', sendLimiter, async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const recipientNickname = String(req.body.recipient || '').trim();
    const content = String(req.body.content || '').trim();
    const imageMediaId = req.body.image_media_id ? parseId(req.body.image_media_id) : null;

    if (!recipientNickname) {
      return res.status(400).json({ error: 'Zadaj príjemcu.' });
    }
    if (!content && !imageMediaId) {
      return res.status(400).json({ error: 'Správa nemôže byť prázdna.' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Správa je príliš dlhá (max 5000 znakov).' });
    }

    // Nájdi príjemcu
    const recipient = await db('users')
      .where('nickname', recipientNickname)
      .whereNot('id', senderId)
      .where('is_banned', false)
      .first();
    if (!recipient) {
      return res.status(404).json({ error: 'Používateľ nenájdený.' });
    }

    // Overenie obrázka (len admin)
    if (imageMediaId) {
      if (req.user.role !== 'admin' && req.user.role !== 'editor') {
        return res.status(403).json({ error: 'Prílohy môže posielať len admin.' });
      }
      const media = await db('media').where('id', imageMediaId).first();
      if (!media) {
        return res.status(400).json({ error: 'Obrázok nenájdený.' });
      }
    }

    // Existuje už konverzácia medzi týmito 2 usermi (direct)?
    const existingConv = await db('conversation_participants as cp1')
      .join('conversation_participants as cp2', 'cp1.conversation_id', 'cp2.conversation_id')
      .join('conversations as c', 'cp1.conversation_id', 'c.id')
      .where('cp1.user_id', senderId)
      .where('cp2.user_id', recipient.id)
      .where('c.type', 'direct')
      .select('c.id')
      .first();

    let conversationId;

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      // Vytvor novú konverzáciu
      const [id] = await db('conversations').insert({
        type: 'direct',
        last_message_at: new Date(),
      });
      conversationId = id;

      // Pridaj účastníkov
      await db('conversation_participants').insert([
        { conversation_id: conversationId, user_id: senderId },
        { conversation_id: conversationId, user_id: recipient.id },
      ]);
    }

    // Vlož správu
    const [messageId] = await db('messages').insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content || '',
      image_media_id: imageMediaId,
      is_system: false,
    });

    // Aktualizuj last_message_at
    await db('conversations').where('id', conversationId).update({ last_message_at: new Date() });

    // Notifikácia
    await notifyNewMessage(db, {
      recipientId: recipient.id,
      senderId,
      senderNickname: req.user.nickname,
      conversationId,
    });

    res.status(201).json({
      ok: true,
      conversation_id: conversationId,
      message_id: messageId,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /conversations/:id/messages — odpoveď v konverzácii
// ---------------------------------------------------------------------------

router.post('/conversations/:id/messages', sendLimiter, async (req, res, next) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ error: 'Neplatné ID.' });

    const participant = await requireParticipant(convId, req.user.id, res);
    if (!participant) return;

    const content = String(req.body.content || '').trim();
    const imageMediaId = req.body.image_media_id ? parseId(req.body.image_media_id) : null;

    if (!content && !imageMediaId) {
      return res.status(400).json({ error: 'Správa nemôže byť prázdna.' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Správa je príliš dlhá (max 5000 znakov).' });
    }

    // Overenie obrázka (len admin)
    if (imageMediaId) {
      if (req.user.role !== 'admin' && req.user.role !== 'editor') {
        return res.status(403).json({ error: 'Prílohy môže posielať len admin.' });
      }
    }

    // Vlož správu
    const [messageId] = await db('messages').insert({
      conversation_id: convId,
      sender_id: req.user.id,
      content: content || '',
      image_media_id: imageMediaId,
      is_system: false,
    });

    // Aktualizuj last_message_at
    await db('conversations').where('id', convId).update({ last_message_at: new Date() });

    // Aktualizuj last_read_at pre odosielateľa
    await db('conversation_participants')
      .where({ conversation_id: convId, user_id: req.user.id })
      .update({ last_read_at: new Date() });

    // Notifikácia pre druhých účastníkov
    const others = await db('conversation_participants')
      .where('conversation_id', convId)
      .whereNot('user_id', req.user.id)
      .select('user_id');

    for (const other of others) {
      await notifyNewMessage(db, {
        recipientId: other.user_id,
        senderId: req.user.id,
        senderNickname: req.user.nickname,
        conversationId: convId,
      });
    }

    res.status(201).json({ ok: true, message_id: messageId });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /conversations/:id/read — označiť ako prečítané
// ---------------------------------------------------------------------------

router.post('/conversations/:id/read', async (req, res, next) => {
  try {
    const convId = parseId(req.params.id);
    if (!convId) return res.status(400).json({ error: 'Neplatné ID.' });

    const participant = await requireParticipant(convId, req.user.id, res);
    if (!participant) return;

    await db('conversation_participants')
      .where({ conversation_id: convId, user_id: req.user.id })
      .update({ last_read_at: new Date() });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /unread-count — počet konverzácií s neprečítanými správami
// ---------------------------------------------------------------------------

router.get('/unread-count', async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Konverzácie kde existujú správy novšie než last_read_at
    const rows = await db('conversation_participants as cp')
      .join('conversations as c', 'cp.conversation_id', 'c.id')
      .where('cp.user_id', userId)
      .where('cp.is_muted', false)
      .whereNotNull('c.last_message_at')
      .select('cp.conversation_id', 'cp.last_read_at', 'c.last_message_at');

    let count = 0;
    for (const r of rows) {
      if (!r.last_read_at || new Date(r.last_message_at) > new Date(r.last_read_at)) {
        // Overiť že nie sú len moje vlastné správy
        const unreadQb = db('messages')
          .where('conversation_id', r.conversation_id)
          .where(function () {
            this.whereNot('sender_id', userId).orWhereNull('sender_id');
          });
        if (r.last_read_at) {
          unreadQb.where('created_at', '>', r.last_read_at);
        }
        const cnt = await unreadQb.count({ c: '*' }).first();
        if (Number(cnt.c) > 0) count++;
      }
    }

    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /users/search — autocomplete príjemcov
// ---------------------------------------------------------------------------

router.get('/users/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const users = await db('users')
      .leftJoin('media as m', 'users.avatar_media_id', 'm.id')
      .where('users.nickname', 'like', `%${q}%`)
      .where('users.is_banned', false)
      .whereNot('users.id', req.user.id)
      .select('users.id', 'users.nickname', 'users.role', 'm.thumbnail_path as avatar_thumb')
      .orderBy('users.nickname')
      .limit(10);

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /broadcast — admin broadcast
// ---------------------------------------------------------------------------

router.post('/broadcast', sendLimiter, async (req, res, next) => {
  try {
    // Len admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Len admin môže posielať broadcast.' });
    }

    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ error: 'Správa nemôže byť prázdna.' });
    }
    if (content.length > 5000) {
      return res.status(400).json({ error: 'Správa je príliš dlhá (max 5000 znakov).' });
    }

    // Všetci registrovaní okrem admina
    const allUsers = await db('users')
      .where('is_banned', false)
      .whereNot('id', req.user.id)
      .select('id');

    let created = 0;

    for (const user of allUsers) {
      // Nájdi existujúcu broadcast konverzáciu s týmto userom
      let broadcastConv = await db('conversation_participants as cp1')
        .join('conversation_participants as cp2', 'cp1.conversation_id', 'cp2.conversation_id')
        .join('conversations as c', 'cp1.conversation_id', 'c.id')
        .where('cp1.user_id', req.user.id)
        .where('cp2.user_id', user.id)
        .where('c.type', 'broadcast')
        .select('c.id')
        .first();

      let convId;

      if (broadcastConv) {
        convId = broadcastConv.id;
      } else {
        const [id] = await db('conversations').insert({
          type: 'broadcast',
          last_message_at: new Date(),
        });
        convId = id;
        await db('conversation_participants').insert([
          { conversation_id: convId, user_id: req.user.id },
          { conversation_id: convId, user_id: user.id },
        ]);
      }

      await db('messages').insert({
        conversation_id: convId,
        sender_id: req.user.id,
        content,
        is_system: true,
      });

      await db('conversations').where('id', convId).update({ last_message_at: new Date() });

      await notifyNewMessage(db, {
        recipientId: user.id,
        senderId: req.user.id,
        senderNickname: req.user.nickname,
        conversationId: convId,
      });

      created++;
    }

    res.json({ ok: true, sent_to: created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
