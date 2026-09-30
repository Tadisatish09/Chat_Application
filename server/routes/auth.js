const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticateToken, JWT_SECRET } = require('../authMiddleware');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, display_name, email, password, avatar, about } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username or email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = new Date().toISOString();
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username)}`;
    const displayName = display_name || username;
    const userAbout = about || 'Hey there! I am using WhatsApp.';

    await query(
      `INSERT INTO users (id, username, display_name, email, password, avatar, about, online, last_seen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [userId, username, displayName, email, hashedPassword, defaultAvatar, userAbout, now, now]
    );

    const token = jwt.sign(
      { id: userId, username, display_name: displayName, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const user = {
      id: userId,
      username,
      display_name: displayName,
      email,
      avatar: defaultAvatar,
      about: userAbout,
      online: 1,
      last_seen: now
    };

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Username/email and password required' });
    }

    const rows = await query(
      'SELECT * FROM users WHERE username = ? OR email = ?',
      [login, login]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, display_name: user.display_name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Update user status
    await query('UPDATE users SET online = 1 WHERE id = ?', [user.id]);

    const sanitizedUser = {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      avatar: user.avatar,
      about: user.about,
      online: 1,
      last_seen: user.last_seen
    };

    res.json({ token, user: sanitizedUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, username, display_name, email, avatar, about, online, last_seen FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Me endpoint error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { display_name, about, avatar } = req.body;
    await query(
      'UPDATE users SET display_name = COALESCE(?, display_name), about = COALESCE(?, about), avatar = COALESCE(?, avatar) WHERE id = ?',
      [display_name, about, avatar, req.user.id]
    );

    const rows = await query(
      'SELECT id, username, display_name, email, avatar, about, online, last_seen FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
