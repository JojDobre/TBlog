/**
 * Admin contact messages routes  (Phase 2 — Balík B)
 *
 * Zobrazenie správ z kontaktného formulára: /admin/messages
 * Tabuľka: contact_messages
 */

'use strict';

const { notifyNewMessage } = require('../utils/notifications');
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
router.use(requireAuth());
router.use(requireRole('admin', 'editor'));
const db = require('../db');
const log = require('../logger');
const { generateToken } = require('../middleware/csrf');

// =========================================================================
// BROADCAST — GET
// =========================================================================

router.get('/broadcast', async (req, res, next) => {
  try {
    const userCount = await db('users')
      .where('is_banned', false)
      .whereNot('role', 'admin')
      .count({ c: '*' })
      .first();

    res.render('admin/messages/broadcast', {
      title: 'Broadcast správa',
      currentPath: '/admin/messages',
      pageTitle: 'Broadcast správa',
      userCount: Number(userCount.c),
      csrfToken: res.locals.csrfToken,
      flash: {
        success: req.query.sent ? `Broadcast odoslaný ${req.query.sent} používateľom.` : null,
        error: req.query.err || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// BROADCAST — POST
// =========================================================================

router.post('/broadcast', async (req, res, next) => {
  try {
    // Len admin
    if (req.user.role !== 'admin') {
      return res.redirect(
        '/admin/messages/broadcast?err=' + encodeURIComponent('Len admin môže posielať broadcast.')
      );
    }

    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.redirect(
        '/admin/messages/broadcast?err=' + encodeURIComponent('Správa nemôže byť prázdna.')
      );
    }
    if (content.length > 5000) {
      return res.redirect(
        '/admin/messages/broadcast?err=' + encodeURIComponent('Správa je príliš dlhá.')
      );
    }

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

    log.info('broadcast sent', { userId: req.user.id, recipients: created });
    res.redirect('/admin/messages/broadcast?sent=' + created);
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// REPLY TO CONTACT — POST (admin odpovedá na kontaktnú správu)
// =========================================================================

router.post('/:id/reply', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    const msg = await db('contact_messages').where('id', id).first();
    if (!msg) return res.redirect('/admin/messages?err=' + encodeURIComponent('Správa nenájdená.'));

    const replyContent = String(req.body.reply || '').trim();
    if (!replyContent) {
      return res.redirect(
        '/admin/messages/' + id + '?err=' + encodeURIComponent('Odpoveď nemôže byť prázdna.')
      );
    }

    // Nájdi registrovaného usera podľa emailu
    const recipient = await db('users').where('email', msg.email).where('is_banned', false).first();
    if (!recipient) {
      return res.redirect(
        '/admin/messages/' +
          id +
          '?err=' +
          encodeURIComponent('Používateľ s emailom ' + msg.email + ' nie je registrovaný.')
      );
    }

    // Nájdi alebo vytvor contact konverzáciu
    let contactConv = await db('conversation_participants as cp1')
      .join('conversation_participants as cp2', 'cp1.conversation_id', 'cp2.conversation_id')
      .join('conversations as c', 'cp1.conversation_id', 'c.id')
      .where('cp1.user_id', req.user.id)
      .where('cp2.user_id', recipient.id)
      .where('c.type', 'contact')
      .select('c.id')
      .first();

    let convId;

    if (contactConv) {
      convId = contactConv.id;
    } else {
      // Vytvor novú contact konverzáciu
      const [newId] = await db('conversations').insert({
        type: 'contact',
        last_message_at: new Date(),
      });
      convId = newId;
      await db('conversation_participants').insert([
        { conversation_id: convId, user_id: req.user.id },
        { conversation_id: convId, user_id: recipient.id },
      ]);

      // Vlož pôvodnú kontaktnú správu ako prvú správu
      const originalContent = (msg.subject ? '[' + msg.subject + '] ' : '') + msg.message;
      await db('messages').insert({
        conversation_id: convId,
        sender_id: recipient.id,
        content: originalContent,
        is_system: false,
      });
    }

    // Vlož admin odpoveď
    await db('messages').insert({
      conversation_id: convId,
      sender_id: req.user.id,
      content: replyContent,
      is_system: false,
    });

    await db('conversations').where('id', convId).update({ last_message_at: new Date() });

    // Notifikácia
    await notifyNewMessage(db, {
      recipientId: recipient.id,
      senderId: req.user.id,
      senderNickname: req.user.nickname,
      conversationId: convId,
    });

    // Označ kontaktnú správu ako prečítanú
    if (!msg.is_read) {
      await db('contact_messages').where('id', id).update({ is_read: 1, read_at: new Date() });
    }

    log.info('admin replied to contact message', {
      contactMsgId: id,
      recipientId: recipient.id,
      convId,
    });
    res.redirect('/admin/messages/' + id + '?replied=1');
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// LIST
// =========================================================================

router.get('/', async (req, res, next) => {
  try {
    const tab = req.query.tab === 'read' ? 'read' : 'unread';
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = 20;
    const offset = (page - 1) * perPage;

    let qb = db('contact_messages').orderBy('created_at', 'desc');
    let countQb = db('contact_messages');

    if (tab === 'unread') {
      qb = qb.where('is_read', 0);
      countQb = countQb.where('is_read', 0);
    } else {
      qb = qb.where('is_read', 1);
      countQb = countQb.where('is_read', 1);
    }

    if (q) {
      qb = qb.where(function () {
        this.where('name', 'like', `%${q}%`)
          .orWhere('email', 'like', `%${q}%`)
          .orWhere('subject', 'like', `%${q}%`)
          .orWhere('message', 'like', `%${q}%`);
      });
      countQb = countQb.where(function () {
        this.where('name', 'like', `%${q}%`)
          .orWhere('email', 'like', `%${q}%`)
          .orWhere('subject', 'like', `%${q}%`)
          .orWhere('message', 'like', `%${q}%`);
      });
    }

    const [items, countRow, unreadCount] = await Promise.all([
      qb.clone().limit(perPage).offset(offset),
      countQb.clone().count({ c: '*' }).first(),
      db('contact_messages').where('is_read', 0).count({ c: '*' }).first(),
    ]);

    const total = Number(countRow.c);
    const totalPages = Math.ceil(total / perPage) || 1;

    res.render('admin/messages/index', {
      title: 'Kontaktné správy',
      currentPath: '/admin/messages',
      pageTitle: 'Kontaktné správy',
      items,
      activeTab: tab,
      unreadCount: Number(unreadCount.c),
      query: { q },
      pagination: { page, totalPages, total },
      csrfToken: res.locals.csrfToken,
      flash: {
        marked: !!req.query.marked,
        deleted: !!req.query.deleted,
        err: req.query.err || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// DETAIL (modal-less — zobrazí sa v tabuľke cez expand, ale aj standalone)
// =========================================================================

router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    const msg = await db('contact_messages').where('id', id).first();
    if (!msg) return res.redirect('/admin/messages?err=' + encodeURIComponent('Správa nenájdená.'));

    // Auto-mark as read
    if (!msg.is_read) {
      await db('contact_messages').where('id', id).update({ is_read: 1, read_at: new Date() });
      msg.is_read = 1;
      msg.read_at = new Date();
    }

    res.render('admin/messages/detail', {
      title: 'Správa #' + id,
      currentPath: '/admin/messages',
      pageTitle: 'Správa #' + id,
      msg,
      csrfToken: res.locals.csrfToken,
      replied: !!req.query.replied,
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// MARK READ / UNREAD
// =========================================================================

router.post('/:id/toggle-read', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    const msg = await db('contact_messages').where('id', id).first();
    if (!msg) return res.redirect('/admin/messages?err=' + encodeURIComponent('Správa nenájdená.'));

    const newRead = msg.is_read ? 0 : 1;
    await db('contact_messages')
      .where('id', id)
      .update({
        is_read: newRead,
        read_at: newRead ? new Date() : null,
      });

    log.info('contact message toggled', { id, is_read: newRead, userId: req.user.id });
    res.redirect('/admin/messages?marked=1');
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// MARK ALL READ
// =========================================================================

router.post('/mark-all-read', async (req, res, next) => {
  try {
    const count = await db('contact_messages')
      .where('is_read', 0)
      .update({ is_read: 1, read_at: new Date() });

    log.info('contact messages all marked read', { count, userId: req.user.id });
    res.redirect('/admin/messages?marked=1');
  } catch (err) {
    next(err);
  }
});

// =========================================================================
// DELETE
// =========================================================================

router.post('/:id/delete', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/messages');

    await db('contact_messages').where('id', id).del();
    log.info('contact message deleted', { id, userId: req.user.id });
    res.redirect('/admin/messages?deleted=1');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
