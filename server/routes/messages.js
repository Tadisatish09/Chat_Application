const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { authenticateToken } = require('../authMiddleware');

const cloudinary = require('cloudinary').v2;

// Cloudinary configuration (supports CLOUDINARY_URL or individual credentials)
const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloudinary_url: process.env.CLOUDINARY_URL
    });
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim()
    });
  }
  console.log('[Storage] Cloudinary media storage is ENABLED ☁️');
} else {
  console.log('[Storage] Cloudinary not fully configured in .env. Using local /uploads disk storage.');
}

// Local storage fallback directory
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Memory storage to stream either to Cloudinary or write to local disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB max
});

// GET /api/messages/:otherUserId - Get chat conversation
router.get('/:otherUserId', authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const otherUserId = req.params.otherUserId;

    const messages = await query(
      `SELECT m.*, 
              rm.text as reply_to_text, 
              rm.media_url as reply_to_media_url, 
              rm.media_type as reply_to_media_type,
              ru.display_name as reply_to_sender_name
       FROM messages m
       LEFT JOIN messages rm ON m.reply_to_id = rm.id
       LEFT JOIN users ru ON rm.sender_id = ru.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) 
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC`,
      [currentUserId, otherUserId, otherUserId, currentUserId]
    );

    // Format fields (reactions, starred_by, deleted_for)
    const formatted = messages.map(msg => {
      let reactions = [];
      let starredBy = [];
      let deletedFor = [];
      try { reactions = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : (msg.reactions || []); } catch(e) {}
      try { starredBy = typeof msg.starred_by === 'string' ? JSON.parse(msg.starred_by) : (msg.starred_by || []); } catch(e) {}
      try { deletedFor = typeof msg.deleted_for === 'string' ? JSON.parse(msg.deleted_for) : (msg.deleted_for || []); } catch(e) {}

      // If user deleted for themselves, hide or filter out
      const isDeletedForMe = deletedFor.includes(currentUserId);
      if (isDeletedForMe) {
        return null;
      }

      let replyTo = null;
      if (msg.reply_to_id) {
        replyTo = {
          id: msg.reply_to_id,
          text: msg.reply_to_text,
          media_url: msg.reply_to_media_url,
          media_type: msg.reply_to_media_type,
          sender_name: msg.reply_to_sender_name || 'Someone'
        };
      }

      return {
        id: msg.id,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        text: msg.deleted_for_everyone ? '🚫 This message was deleted' : msg.text,
        media_url: msg.deleted_for_everyone ? null : msg.media_url,
        media_type: msg.deleted_for_everyone ? null : msg.media_type,
        reply_to_id: msg.reply_to_id,
        reply_to: replyTo,
        is_forwarded: Boolean(msg.is_forwarded),
        forwarded_count: msg.forwarded_count || 0,
        status: msg.status,
        is_read: Number(msg.is_read || 0) === 1 || msg.status === 'read',
        deleted_for_everyone: Boolean(msg.deleted_for_everyone),
        reactions,
        is_starred: starredBy.includes(currentUserId),
        created_at: msg.created_at
      };
    }).filter(Boolean);

    res.json({ messages: formatted });
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages/upload - Upload file/image/audio with deduplication check
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const crypto = require('crypto');
  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const ext = path.extname(req.file.originalname) || '';

  let mediaType = 'document';
  if (req.file.mimetype.startsWith('image/')) {
    mediaType = 'image';
  } else if (req.file.mimetype.startsWith('audio/')) {
    mediaType = 'audio';
  } else if (req.file.mimetype.startsWith('video/')) {
    mediaType = 'video';
  }

  try {
    // 1. Check if an identical working file is already stored in our database
    const existingMsg = await query(
      `SELECT media_url, media_type FROM messages 
       WHERE media_url LIKE ? 
         AND media_url NOT LIKE '%/raw/upload/%'
       LIMIT 1`,
      [`%${fileHash}%`]
    );

    if (existingMsg.length > 0 && existingMsg[0].media_url) {
      console.log(`[Storage] Deduplication hit: Reusing existing server attachment (${existingMsg[0].media_url})`);
      return res.json({
        url: existingMsg[0].media_url,
        filename: req.file.originalname,
        mediaType: existingMsg[0].media_type || mediaType,
        size: req.file.size,
        deduplicated: true
      });
    }

    // 2. If Cloudinary is configured, upload to Cloudinary with correct resource_type & format
    if (isCloudinaryConfigured) {
      let cldResourceType = 'auto';
      if (req.file.mimetype.startsWith('image/')) {
        cldResourceType = 'image';
      } else if (req.file.mimetype.startsWith('video/') || req.file.mimetype.startsWith('audio/')) {
        cldResourceType = 'video';
      }

      const cleanFormat = ext ? ext.replace('.', '').toLowerCase() : undefined;
      const uploadOptions = {
        folder: 'chat_uploads',
        public_id: `img_${fileHash.substring(0, 16)}`,
        resource_type: cldResourceType,
        overwrite: true,
        invalidate: true
      };

      if (cleanFormat && cleanFormat !== 'jfif' && cldResourceType === 'image') {
        uploadOptions.format = cleanFormat;
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      console.log(`[Storage] File stored on Cloudinary (${cldResourceType}): ${uploadResult.secure_url}`);

      return res.json({
        url: uploadResult.secure_url,
        filename: req.file.originalname,
        mediaType,
        size: req.file.size
      });
    }

    // 3. Fallback: Check local disk or save locally
    const uniqueLocalName = `${fileHash.substring(0, 16)}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = path.join(uploadsDir, uniqueLocalName);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, req.file.buffer);
      console.log(`[Storage] New file saved to local server disk: ${filePath}`);
    } else {
      console.log(`[Storage] File already existed on local server disk: ${filePath}`);
    }

    const fileUrl = `/uploads/${uniqueLocalName}`;

    res.json({
      url: fileUrl,
      filename: req.file.originalname,
      mediaType,
      size: req.file.size
    });
  } catch (err) {
    console.error('[Storage] Media upload error:', err);
    res.status(500).json({ error: 'Failed to process media file' });
  }
});

module.exports = router;
