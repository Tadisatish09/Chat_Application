const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../authMiddleware');

// GET /api/users - list all registered users with last message preview and unread count
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // 1. Get all other users in a single query
    const users = await query(
      `SELECT id, username, display_name, email, avatar, about, online, last_seen, created_at 
       FROM users 
       WHERE id != ? 
       ORDER BY online DESC, display_name ASC`,
      [currentUserId]
    );

    if (!users || users.length === 0) {
      return res.json({ users: [] });
    }

    // 2. Fetch unread counts in ONE batch query for all contacts
    const unreadRows = await query(
      `SELECT sender_id, COUNT(*) as unread_count
       FROM messages
       WHERE receiver_id = ? AND (is_read = 0 OR is_read IS NULL) AND status != 'read'
       GROUP BY sender_id`,
      [currentUserId]
    );

    const unreadMap = {};
    if (Array.isArray(unreadRows)) {
      for (const row of unreadRows) {
        const count = row.unread_count || row['COUNT(*)'] || 0;
        unreadMap[row.sender_id] = parseInt(count, 10);
      }
    }

    // 3. Fetch latest messages for each active conversation in ONE batch query
    const latestMessages = await query(
      `SELECT m.id, m.sender_id, m.receiver_id, m.text, m.media_url, m.media_type, m.is_forwarded, m.status, m.is_read, m.created_at
       FROM messages m
       INNER JOIN (
         SELECT 
           CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as peer_id,
           MAX(created_at) as max_created
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
         GROUP BY CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END
       ) latest ON (
         (m.sender_id = latest.peer_id AND m.receiver_id = ?) OR
         (m.sender_id = ? AND m.receiver_id = latest.peer_id)
       ) AND m.created_at = latest.max_created`,
      [currentUserId, currentUserId, currentUserId, currentUserId, currentUserId, currentUserId]
    );

    const lastMsgMap = {};
    if (Array.isArray(latestMessages)) {
      for (const msg of latestMessages) {
        const partnerId = msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
        if (!lastMsgMap[partnerId]) {
          lastMsgMap[partnerId] = msg;
        }
      }
    }

    // 4. Combine and sort
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
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
