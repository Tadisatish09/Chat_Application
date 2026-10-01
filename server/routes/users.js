const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../authMiddleware');

// GET /api/users - list all registered users with last message preview and unread count
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Get all other users
    const users = await query(
      `SELECT id, username, display_name, email, avatar, about, online, last_seen, created_at 
       FROM users 
       WHERE id != ? 
       ORDER BY online DESC, display_name ASC`,
      [currentUserId]
    );

    if (!users || !Array.isArray(users) || users.length === 0) {
      return res.json({ users: [] });
    }

    const unreadMap = {};
    const lastMsgMap = {};

    // 2. Fetch unread counts safely
    try {
      const unreadRows = await query(
        `SELECT sender_id, COUNT(*) as unread_count
         FROM messages
         WHERE receiver_id = ? AND (is_read = 0 OR is_read IS NULL) AND status != 'read'
         GROUP BY sender_id`,
        [currentUserId]
      );

      if (Array.isArray(unreadRows)) {
        for (const row of unreadRows) {
          const count = row.unread_count || row['COUNT(*)'] || 0;
          unreadMap[row.sender_id] = parseInt(count, 10);
        }
      }
    } catch (unreadErr) {
      console.warn('Unread count query warning:', unreadErr.message);
    }

    // 3. Fetch latest messages for each contact in one simple, ordered query
    try {
      const userMessages = await query(
        `SELECT id, sender_id, receiver_id, text, media_url, media_type, is_forwarded, status, is_read, created_at
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
         ORDER BY created_at DESC`,
        [currentUserId, currentUserId]
      );

      if (Array.isArray(userMessages)) {
        for (const msg of userMessages) {
          const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
          if (!lastMsgMap[partnerId]) {
            lastMsgMap[partnerId] = msg;
          }
        }
      }
    } catch (msgErr) {
      console.warn('Latest message query warning:', msgErr.message);
    }

    // 4. Combine users with their latest activity
    const enrichedUsers = users.map((u) => ({
      ...u,
      lastMessage: lastMsgMap[u.id] || null,
      unreadCount: unreadMap[u.id] || 0
    }));

    enrichedUsers.sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    });

    res.json({ users: enrichedUsers });
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

module.exports = router;
