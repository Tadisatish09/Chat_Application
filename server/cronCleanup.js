const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { query } = require('./db');
const cloudinary = require('cloudinary').v2;

// Initialize Cloudinary if credentials exist
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim()
  });
}

/**
 * Extract Cloudinary public_id from secure URL
 * e.g. https://res.cloudinary.com/tvppl1sq/image/upload/v1790763130/chat_uploads/img_test.png -> chat_uploads/img_test
 */
function extractCloudinaryPublicId(url) {
  try {
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let pathPart = url.substring(uploadIndex + 8); // after /upload/
    // Strip version prefix if present (e.g. v1790763130/)
    if (/^v\d+\//.test(pathPart)) {
      pathPart = pathPart.replace(/^v\d+\//, '');
    }
    // Remove extension (.png, .jpg, etc.)
    const publicId = pathPart.replace(/\.[^/.]+$/, '');
    return publicId;
  } catch (e) {
    return null;
  }
}

/**
 * Clean up attachments older than retentionDays (default: 90 days)
 * with no recent/active references by any user.
 */
async function cleanupExpiredMedia(retentionDays = 90) {
  console.log(`[Cron Cleanup] 🧹 Running automated media cleanup check (retention: ${retentionDays} days)...`);
  const cutoffTime = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Find candidate messages older than retentionDays with media attachments
    const candidates = await query(
      `SELECT id, media_url, media_type, created_at, deleted_for_everyone 
       FROM messages 
       WHERE media_url IS NOT NULL 
         AND media_url != '' 
         AND created_at < ?`,
      [cutoffTime]
    );

    if (!candidates || candidates.length === 0) {
      console.log(`[Cron Cleanup] ✅ No expired media files older than ${retentionDays} days found.`);
      return { deletedFilesCount: 0, candidatesChecked: 0 };
    }

    console.log(`[Cron Cleanup] Found ${candidates.length} candidate messages older than ${retentionDays} days. Verifying active usage...`);

    let deletedFilesCount = 0;
    const localUploadsDir = path.join(__dirname, 'uploads');

    for (const msg of candidates) {
      const mediaUrl = msg.media_url;
      if (!mediaUrl) continue;

      // 2. Check if ANY recent message (created within the last 90 days) is still referencing this exact media_url
      const activeRows = await query(
        `SELECT COUNT(*) as active_count 
         FROM messages 
         WHERE media_url = ? 
           AND created_at >= ? 
           AND deleted_for_everyone = 0`,
        [mediaUrl, cutoffTime]
      );

      const activeCount = activeRows[0]?.active_count || activeRows[0]?.['COUNT(*)'] || 0;

      // If no active users or recent messages use this media file, purge it!
      if (parseInt(activeCount, 10) === 0) {
        // A. Delete from Cloudinary Storage
        if (mediaUrl.includes('cloudinary.com')) {
          const publicId = extractCloudinaryPublicId(mediaUrl);
          if (publicId) {
            let resourceType = 'image';
            if (msg.media_type === 'video' || msg.media_type === 'audio') {
              resourceType = 'video';
            } else if (msg.media_type === 'document' || mediaUrl.includes('/raw/upload/')) {
              resourceType = 'raw';
            }

            try {
              await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
              console.log(`[Cron Cleanup] 🗑️ Removed from Cloudinary storage (${resourceType}): ${publicId}`);
              deletedFilesCount++;
            } catch (cldErr) {
              console.warn(`[Cron Cleanup] Cloudinary deletion error for ${publicId}:`, cldErr.message);
            }
          }
        }
        // B. Delete from Local Server Disk Storage
        else if (mediaUrl.startsWith('/uploads/')) {
          const filename = path.basename(mediaUrl);
          const localPath = path.join(localUploadsDir, filename);
          if (fs.existsSync(localPath)) {
            try {
              fs.unlinkSync(localPath);
              console.log(`[Cron Cleanup] 🗑️ Removed from server local disk: ${localPath}`);
              deletedFilesCount++;
            } catch (fsErr) {
              console.warn(`[Cron Cleanup] Local file delete error for ${localPath}:`, fsErr.message);
            }
          }
        }

        // C. Update database record to mark media purged
        await query(
          `UPDATE messages 
           SET media_url = NULL, 
               text = CASE 
                 WHEN text IS NULL OR text = '' THEN '[Attachment expired after 90 days of inactivity]' 
                 ELSE CONCAT(text, ' (Attachment expired)') 
               END 
           WHERE id = ?`,
          [msg.id]
        );
      }
    }

    console.log(`[Cron Cleanup] 🎉 Cleanup complete! Purged ${deletedFilesCount} inactive files older than ${retentionDays} days.`);
    return { deletedFilesCount, candidatesChecked: candidates.length };
  } catch (err) {
    console.error('[Cron Cleanup] Error during media cleanup job:', err);
    return { error: err.message };
  }
}

/**
 * Start recurring Cron Schedule
 * Default: Runs everyday at midnight (00:00)
 */
function startMediaCleanupCron() {
  // '0 0 * * *' = Every day at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[Cron Cleanup] ⏰ Triggered scheduled daily 90-day media retention cleanup.');
    await cleanupExpiredMedia(90);
  });

  console.log('[Cron] 🕒 90-day automated media cleanup cron job registered (runs daily at 00:00).');
}

module.exports = {
  startMediaCleanupCron,
  cleanupExpiredMedia
};
