const path = require('path');
const fs = require('fs');
require('dotenv').config();

let dbType = 'sqlite';
let mysqlPool = null;
let sqliteDb = null;

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'chat';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_SSL = process.env.DB_SSL === 'true' || process.env.DB_HOST?.includes('aivencloud.com') || Boolean(process.env.DATABASE_URL?.includes('aivencloud.com'));

async function initDB() {
  const mysql2 = require('mysql2/promise');
  let mysqlConnected = false;

  const aivenUri = process.env.DATABASE_URL || process.env.MYSQL_URI || process.env.AIVEN_URL || process.env.AIVEN_MYSQL_URI;

  // 1. Try Aiven / MySQL Connection via URI or Config
  if (aivenUri || process.env.USE_MYSQL === 'true' || process.env.DB_HOST || process.env.DB_PASSWORD !== undefined) {
    try {
      let poolConfig = {};

      if (aivenUri) {
        console.log('[Database] Connecting to Aiven / Cloud MySQL via URI...');
        poolConfig = {
          uri: aivenUri,
          ssl: { rejectUnauthorized: false },
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        };
      } else {
        const sslOptions = DB_SSL ? { rejectUnauthorized: false } : undefined;

        // Ensure database exists if permission allows
        try {
          const rootConn = await mysql2.createConnection({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASSWORD,
            port: DB_PORT,
            ssl: sslOptions
          });
          await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
          await rootConn.end();
        } catch (dbCreateErr) {
          console.log(`[Database] Note on database creation: ${dbCreateErr.message}`);
        }

        poolConfig = {
          host: DB_HOST,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          port: DB_PORT,
          ssl: sslOptions,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        };
      }

      mysqlPool = mysql2.createPool(poolConfig);

      // Verify connection with test query
      await mysqlPool.query('SELECT 1');
      dbType = 'mysql';
      mysqlConnected = true;
      console.log(`[Database] ✅ Successfully connected to MySQL / Aiven database (${aivenUri ? 'Cloud URI' : `${DB_HOST}:${DB_PORT}`})`);
    } catch (err) {
      console.warn(`[Database] MySQL/Aiven connection failed (${err.message}). Falling back to local SQLite for database "${DB_NAME}".`);
      mysqlConnected = false;
    }
  }

  if (!mysqlConnected) {
    dbType = 'sqlite';
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, '..', `${DB_NAME}.db`);

    await new Promise((resolve, reject) => {
      sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('[Database] SQLite error:', err);
          return reject(err);
        }
        console.log(`[Database] Connected to SQLite database "${DB_NAME}" (${dbPath})`);
        resolve();
      });
    });
  }

  await createTables();
  await seedInitialDemoUsers();
}

async function query(sql, params = []) {
  if (dbType === 'mysql') {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  } else {
    return new Promise((resolve, reject) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('SHOW')) {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      } else {
        sqliteDb.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ insertId: this.lastID, affectedRows: this.changes });
        });
      }
    });
  }
}

async function createTables() {
  if (dbType === 'mysql') {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar TEXT,
        about VARCHAR(255) DEFAULT 'Hey there! I am using WhatsApp.',
        online INT DEFAULT 0,
        last_seen VARCHAR(64),
        created_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(64) PRIMARY KEY,
        sender_id VARCHAR(64) NOT NULL,
        receiver_id VARCHAR(64) NOT NULL,
        text TEXT,
        media_url TEXT,
        media_type VARCHAR(50),
        reply_to_id VARCHAR(64) NULL,
        is_forwarded INT DEFAULT 0,
        forwarded_count INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'sent',
        is_read INT DEFAULT 0,
        deleted_for TEXT,
        deleted_for_everyone INT DEFAULT 0,
        reactions TEXT,
        starred_by TEXT,
        created_at VARCHAR(64) NOT NULL,
        INDEX idx_chat (sender_id, receiver_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } else {
    // SQLite Tables
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        about TEXT DEFAULT 'Hey there! I am using WhatsApp.',
        online INTEGER DEFAULT 0,
        last_seen TEXT,
        created_at TEXT NOT NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        text TEXT,
        media_url TEXT,
        media_type TEXT,
        reply_to_id TEXT,
        is_forwarded INTEGER DEFAULT 0,
        forwarded_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'sent',
        is_read INTEGER DEFAULT 0,
        deleted_for TEXT DEFAULT '[]',
        deleted_for_everyone INTEGER DEFAULT 0,
        reactions TEXT DEFAULT '[]',
        starred_by TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      );
    `);
  }

  // Ensure is_read column exists on existing installations
  try {
    if (dbType === 'mysql') {
      await query('ALTER TABLE messages ADD COLUMN is_read INT DEFAULT 0 AFTER status');
    } else {
      await query('ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0');
    }
  } catch (e) {
    // Column already exists
  }
  console.log('[Database] Schema initialized successfully.');
}

async function seedInitialDemoUsers() {
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');

  const existing = await query('SELECT COUNT(*) as count FROM users');
  const count = existing[0]?.count || existing[0]?.['COUNT(*)'] || 0;

  if (count === 0) {
    console.log('[Database] Seeding initial demo contacts to chat database...');
    const hashedPw = await bcrypt.hash('password123', 10);
    const now = new Date().toISOString();

    const demoUsers = [
      {
        id: 'user_alex',
        username: 'alex_turner',
        display_name: 'Alex Turner',
        email: 'alex@example.com',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        about: 'Available for design collabs 🚀'
      },
      {
        id: 'user_sarah',
        username: 'sarah_connor',
        display_name: 'Sarah Connor',
        email: 'sarah@example.com',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        about: 'Building the future ✨'
      },
      {
        id: 'user_michael',
        username: 'michael_scott',
        display_name: 'Michael Scott',
        email: 'michael@dundermifflin.com',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        about: 'World’s Best Boss ☕'
      },
      {
        id: 'user_emma',
        username: 'emma_watson',
        display_name: 'Emma Watson',
        email: 'emma@example.com',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
        about: 'Reading & Coding 📚'
      }
    ];

    for (const u of demoUsers) {
      await query(
        `INSERT INTO users (id, username, display_name, email, password, avatar, about, online, last_seen, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [u.id, u.username, u.display_name, u.email, hashedPw, u.avatar, u.about, now, now]
      );
    }

    // Seed sample greeting messages
    const m1Id = uuidv4();
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, text, media_url, media_type, reply_to_id, is_forwarded, status, deleted_for, deleted_for_everyone, reactions, starred_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m1Id, 'user_sarah', 'user_alex', 'Hey Alex! Did you check out the new socket updates with forward & reply?', null, null, null, 0, 'read', '[]', 0, JSON.stringify([{ emoji: '🔥', userId: 'user_alex' }]), '[]', new Date(Date.now() - 3600000).toISOString()]
    );

    const m2Id = uuidv4();
    await query(
      `INSERT INTO messages (id, sender_id, receiver_id, text, media_url, media_type, reply_to_id, is_forwarded, status, deleted_for, deleted_for_everyone, reactions, starred_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [m2Id, 'user_alex', 'user_sarah', 'Yes! The instant forwarding and typing indicators work like a charm! ⚡', null, null, m1Id, 0, 'read', '[]', 0, '[]', '[]', new Date(Date.now() - 1800000).toISOString()]
    );

    console.log('[Database] Demo users & messages seeded successfully.');
  }
}

module.exports = {
  initDB,
  query,
  getDbType: () => dbType
};
