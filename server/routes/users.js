const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../authMiddleware');

// GET /api/users - list all registered users with last message preview and unread count
router.get('/', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get all users except current user
    const users = await query(
      `SELECT id, username, display_name, email, avatar, about, online, last_seen, created_at 
       FROM users 
       WHERE id != ? 
       ORDER BY online DESC, display_name ASC`,
      [currentUserId]
    );

    // Fetch last message and unread count for each user
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        // Last message between current user and u.id
        const lastMsgRows = await query(
          `SELECT id, sender_id, receiver_id, text, media_url, media_type, is_forwarded, status, is_read, created_at
           FROM messages
           WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
           ORDER BY created_at DESC
           LIMIT 1`,
          [currentUserId, u.id, u.id, currentUserId]
        );

        // Unread messages sent by u.id to currentUserId
        const unreadRows = await query(
          `SELECT COUNT(*) as unread_count
           FROM messages
           WHERE sender_id = ? AND receiver_id = ? AND (is_read = 0 OR is_read IS NULL) AND status != 'read'`,
          [u.id, currentUserId]
        );

        const unreadCount = unreadRows[0]?.unread_count || unreadRows[0]?.['COUNT(*)'] || 0;

        return {
          ...u,
          lastMessage: lastMsgRows[0] || null,
          unreadCount: parseInt(unreadCount, 10)
        };
      })
    );

    // Sort by most recent message activity
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
