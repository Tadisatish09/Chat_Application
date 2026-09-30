const { v4: uuidv4 } = require('uuid');
const { query } = require('./db');

// Track online user presence
const onlineUsers = new Map(); // userId -> count of active sockets

function initSocketIO(io) {
  io.on('connection', (socket) => {
    let authenticatedUserId = null;

    // 1. User Registration on Socket Connection
    socket.on('register_user', async (userId) => {
      if (!userId) return;
      authenticatedUserId = userId;
      socket.userId = userId;

      // Join room named after user's ID
      socket.join(userId);

      const currentCount = onlineUsers.get(userId) || 0;
      onlineUsers.set(userId, currentCount + 1);

      console.log(`[Socket] User ${userId} joined room (${socket.id}). Active connections: ${currentCount + 1}`);

      // Mark user online in DB and broadcast
      const now = new Date().toISOString();
      try {
        await query('UPDATE users SET online = 1, last_seen = ? WHERE id = ?', [now, userId]);
      } catch (e) {
        console.error('Failed to update user online status', e);
      }

      io.emit('user_status_changed', {
        userId,
        online: true,
        last_seen: now
      });
    });

    // 2. Instant Bidirectional Message Send
    socket.on('send_message', async (data, callback) => {
      try {
        const { sender_id, receiver_id, text, media_url, media_type, reply_to_id } = data;
        if (!sender_id || !receiver_id || (!text && !media_url)) {
          if (callback) callback({ error: 'Missing required message parameters' });
          return;
        }

        const messageId = uuidv4();
        const now = new Date().toISOString();
        const isReceiverOnline = (onlineUsers.get(receiver_id) || 0) > 0;
        const initialStatus = isReceiverOnline ? 'delivered' : 'sent';

        // Check reply_to details if present
        let replyTo = null;
        if (reply_to_id) {
          const parentRows = await query(
            `SELECT m.id, m.text, m.media_url, m.media_type, u.display_name as sender_name 
             FROM messages m 
             LEFT JOIN users u ON m.sender_id = u.id 
             WHERE m.id = ?`,
            [reply_to_id]
          );
          if (parentRows.length > 0) {
            replyTo = {
              id: parentRows[0].id,
              text: parentRows[0].text,
              media_url: parentRows[0].media_url,
              media_type: parentRows[0].media_type,
              sender_name: parentRows[0].sender_name || 'Someone'
            };
          }
        }

        // Save into DB
        await query(
          `INSERT INTO messages (id, sender_id, receiver_id, text, media_url, media_type, reply_to_id, is_forwarded, forwarded_count, status, is_read, deleted_for, deleted_for_everyone, reactions, starred_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 0, '[]', 0, '[]', '[]', ?)`,
          [messageId, sender_id, receiver_id, text || '', media_url || null, media_type || null, reply_to_id || null, initialStatus, now]
        );

        const newMsgPayload = {
          id: messageId,
          sender_id,
          receiver_id,
          text: text || '',
          media_url: media_url || null,
          media_type: media_type || null,
          reply_to_id: reply_to_id || null,
          reply_to: replyTo,
          is_forwarded: false,
          forwarded_count: 0,
          status: initialStatus,
          is_read: 0,
          deleted_for_everyone: false,
          reactions: [],
          is_starred: false,
          created_at: now
        };

        console.log(`[Socket] Emitting new_message to receiver room "${receiver_id}" and sender room "${sender_id}"`);

        // Emit to receiver's room (all tabs/devices)
        io.to(receiver_id).emit('new_message', newMsgPayload);

        // Emit to sender's other tabs
        socket.to(sender_id).emit('new_message', newMsgPayload);

        if (callback) {
          callback({ success: true, message: newMsgPayload });
        }
      } catch (err) {
        console.error('[Socket] send_message error:', err);
        if (callback) callback({ error: 'Failed to send message' });
      }
    });

    // 3. Instant Forward Message to one or multiple users
    socket.on('forward_message', async (data, callback) => {
      try {
        const { sender_id, message_id, target_user_ids } = data;
        if (!sender_id || !message_id || !Array.isArray(target_user_ids) || target_user_ids.length === 0) {
          if (callback) callback({ error: 'Invalid forward parameters' });
          return;
        }

        const originalRows = await query('SELECT * FROM messages WHERE id = ?', [message_id]);
        if (originalRows.length === 0) {
          if (callback) callback({ error: 'Original message not found' });
          return;
        }
        const orig = originalRows[0];
        const forwardedMessages = [];

        for (const targetId of target_user_ids) {
          const fwdId = uuidv4();
          const now = new Date().toISOString();
          const isReceiverOnline = (onlineUsers.get(targetId) || 0) > 0;
          const status = isReceiverOnline ? 'delivered' : 'sent';

          await query(
            `INSERT INTO messages (id, sender_id, receiver_id, text, media_url, media_type, reply_to_id, is_forwarded, forwarded_count, status, is_read, deleted_for, deleted_for_everyone, reactions, starred_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, 0, '[]', 0, '[]', '[]', ?)`,
            [fwdId, sender_id, targetId, orig.text || '', orig.media_url || null, orig.media_type || null, (orig.forwarded_count || 0) + 1, status, now]
          );

          const fwdPayload = {
            id: fwdId,
            sender_id,
            receiver_id: targetId,
            text: orig.text || '',
            media_url: orig.media_url || null,
            media_type: orig.media_type || null,
            reply_to_id: null,
            reply_to: null,
            is_forwarded: true,
            forwarded_count: (orig.forwarded_count || 0) + 1,
            status,
            is_read: 0,
            deleted_for_everyone: false,
            reactions: [],
            is_starred: false,
            created_at: now
          };

          forwardedMessages.push(fwdPayload);

          // Emit to target user's room
          io.to(targetId).emit('new_message', fwdPayload);

          // Emit to sender's other tabs
          socket.to(sender_id).emit('new_message', fwdPayload);
        }

        if (callback) {
          callback({ success: true, forwardedMessages });
        }
      } catch (err) {
        console.error('[Socket] forward_message error:', err);
        if (callback) callback({ error: 'Failed to forward message' });
      }
    });

    // 4. Live Typing Indicator Start / Stop
    socket.on('typing_start', ({ sender_id, receiver_id }) => {
      console.log(`[Socket] typing_start from ${sender_id} -> room ${receiver_id}`);
      io.to(receiver_id).emit('user_typing_start', { sender_id, receiver_id });
    });

    socket.on('typing_stop', ({ sender_id, receiver_id }) => {
      console.log(`[Socket] typing_stop from ${sender_id} -> room ${receiver_id}`);
      io.to(receiver_id).emit('user_typing_stop', { sender_id, receiver_id });
    });

    // 5. Read Receipts (Blue double checks)
    socket.on('mark_as_read', async ({ sender_id, receiver_id }) => {
      try {
        await query(
          `UPDATE messages SET status = 'read', is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
          [sender_id, receiver_id]
        );

        // Notify the original sender that their messages were read
        io.to(sender_id).emit('messages_read_by_peer', {
          chat_with: receiver_id
        });
      } catch (err) {
        console.error('[Socket] mark_as_read error:', err);
      }
    });

    // 6. Message Reactions
    socket.on('toggle_reaction', async ({ message_id, emoji, user_id, peer_id }, callback) => {
      try {
        const rows = await query('SELECT reactions FROM messages WHERE id = ?', [message_id]);
        if (rows.length === 0) return;

        let reactions = [];
        try { reactions = typeof rows[0].reactions === 'string' ? JSON.parse(rows[0].reactions) : (rows[0].reactions || []); } catch(e) {}

        const existingIdx = reactions.findIndex(r => r.userId === user_id);
        if (existingIdx !== -1) {
          if (reactions[existingIdx].emoji === emoji) {
            reactions.splice(existingIdx, 1);
          } else {
            reactions[existingIdx].emoji = emoji;
          }
        } else {
          reactions.push({ userId: user_id, emoji });
        }

        const jsonReactions = JSON.stringify(reactions);
        await query('UPDATE messages SET reactions = ? WHERE id = ?', [jsonReactions, message_id]);

        const updatePayload = { message_id, reactions };

        io.to(user_id).emit('reaction_updated', updatePayload);
        if (peer_id) {
          io.to(peer_id).emit('reaction_updated', updatePayload);
        }

        if (callback) callback({ success: true, reactions });
      } catch (err) {
        console.error('[Socket] toggle_reaction error:', err);
      }
    });

    // 7. Delete Message (For Me or For Everyone)
    socket.on('delete_message', async ({ message_id, delete_type, user_id, peer_id }, callback) => {
      try {
        if (delete_type === 'everyone') {
          await query(
            'UPDATE messages SET deleted_for_everyone = 1, text = "🚫 This message was deleted", media_url = NULL, media_type = NULL WHERE id = ? AND sender_id = ?',
            [message_id, user_id]
          );

          const payload = { message_id, deleted_for_everyone: true };
          io.to(user_id).emit('message_deleted', payload);
          if (peer_id) {
            io.to(peer_id).emit('message_deleted', payload);
          }
        } else {
          const rows = await query('SELECT deleted_for FROM messages WHERE id = ?', [message_id]);
          if (rows.length > 0) {
            let deletedFor = [];
            try { deletedFor = typeof rows[0].deleted_for === 'string' ? JSON.parse(rows[0].deleted_for) : (rows[0].deleted_for || []); } catch(e) {}
            if (!deletedFor.includes(user_id)) {
              deletedFor.push(user_id);
              await query('UPDATE messages SET deleted_for = ? WHERE id = ?', [JSON.stringify(deletedFor), message_id]);
            }
            io.to(user_id).emit('message_deleted_for_me', { message_id });
          }
        }

        if (callback) callback({ success: true });
      } catch (err) {
        console.error('[Socket] delete_message error:', err);
      }
    });

    // 8. WebRTC Live Calling Signaling
    socket.on('webrtc_call_user', ({ user_to_call, from_user, offer, call_type }) => {
      const targetRoom = String(user_to_call);
      const isOnline = (onlineUsers.get(targetRoom) || 0) > 0;
      console.log(`[WebRTC] 📞 Call initiated from ${from_user?.id} (${from_user?.display_name}) -> target room "${targetRoom}" (${call_type}). Target isOnline: ${isOnline}`);

      if (!isOnline) {
        socket.emit('webrtc_call_rejected', { reason: 'User is currently offline' });
        return;
      }

      io.to(targetRoom).emit('webrtc_incoming_call', {
        from_user,
        offer,
        call_type
      });
    });

    socket.on('webrtc_answer_call', ({ to_user, answer }) => {
      const targetRoom = String(to_user);
      console.log(`[WebRTC] ✅ Call answered for target room "${targetRoom}"`);
      io.to(targetRoom).emit('webrtc_call_accepted', { answer });
    });

    socket.on('webrtc_ice_candidate', ({ to_user, candidate }) => {
      const targetRoom = String(to_user);
      io.to(targetRoom).emit('webrtc_ice_candidate', { candidate });
    });

    socket.on('webrtc_end_call', ({ to_user, reason }) => {
      const targetRoom = String(to_user);
      console.log(`[WebRTC] 🛑 Call ended for target room "${targetRoom}" (${reason || 'hung up'})`);
      io.to(targetRoom).emit('webrtc_call_ended', { reason });
    });

    socket.on('webrtc_reject_call', ({ to_user }) => {
      const targetRoom = String(to_user);
      console.log(`[WebRTC] ❌ Call rejected by recipient for target room "${targetRoom}"`);
      io.to(targetRoom).emit('webrtc_call_rejected', { reason: 'Call declined' });
    });

    socket.on('webrtc_toggle_media', ({ to_user, is_video_off, is_muted }) => {
      const targetRoom = String(to_user);
      io.to(targetRoom).emit('webrtc_peer_media_toggled', { is_video_off, is_muted });
    });

    // 9. Handle Disconnect
    socket.on('disconnect', async () => {
      if (authenticatedUserId) {
        const remaining = (onlineUsers.get(authenticatedUserId) || 1) - 1;
        if (remaining <= 0) {
          onlineUsers.delete(authenticatedUserId);
          const now = new Date().toISOString();
          try {
            await query('UPDATE users SET online = 0, last_seen = ? WHERE id = ?', [now, authenticatedUserId]);
          } catch (e) {}

          io.emit('user_status_changed', {
            userId: authenticatedUserId,
            online: false,
            last_seen: now
          });
          console.log(`[Socket] User ${authenticatedUserId} is now offline.`);
        } else {
          onlineUsers.set(authenticatedUserId, remaining);
        }
      }
    });
  });
}

module.exports = { initSocketIO };
