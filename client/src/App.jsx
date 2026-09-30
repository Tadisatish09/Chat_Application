import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { soundFx } from './utils/audio';
import AuthScreen from './components/AuthScreen';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import ForwardModal from './components/ForwardModal';
import ProfileModal from './components/ProfileModal';
import MediaViewerModal from './components/MediaViewerModal';
import CallModal from './components/CallModal';
import { MessageSquare, Lock, Laptop, Shield, Wifi, WifiOff } from 'lucide-react';

// Connect to backend server directly or via origin
const BACKEND_URL = window.location.port === '5173'
  ? `http://${window.location.hostname}:5000`
  : window.location.origin;

const ICE_SERVERS_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('chat_token') || '');

  const [users, setUsers] = useState([]);
  const [activeUserId, setActiveUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeMediaUrl, setActiveMediaUrl] = useState(null);
  const [typingUsersMap, setTypingUsersMap] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  // WebRTC Calling States
  const [callState, setCallState] = useState(null); // 'outgoing_ringing' | 'incoming_ringing' | 'connected' | null
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [callPartner, setCallPartner] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const socketRef = useRef(null);
  const activeUserIdRef = useRef(activeUserId);
  activeUserIdRef.current = activeUserId;

  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const callPartnerRef = useRef(null);
  callPartnerRef.current = callPartner;
  const callTypeRef = useRef(callType);
  callTypeRef.current = callType;

  // Cleanup all WebRTC resources helper
  const cleanupCall = () => {
    console.log('[WebRTC] 🧹 Cleaning up call streams and peer connection...');
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.close();
      } catch (e) {
        console.warn('PC close error:', e);
      }
      peerConnectionRef.current = null;
    }

    setCallState(null);
    setCallPartner(null);
    setLocalStream(null);
    setRemoteStream(null);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    incomingOfferRef.current = null;
    iceCandidatesQueueRef.current = [];
  };

  // Safe getUserMedia helper with fallback
  const acquireMediaStream = async (type) => {
    const videoConstraint = type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: videoConstraint
      });
      return stream;
    } catch (err) {
      console.warn('[WebRTC] Primary getUserMedia failed:', err.message);
      if (type === 'video') {
        console.log('[WebRTC] Falling back to audio-only stream...');
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        return audioStream;
      }
      throw err;
    }
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!currentUser || !currentUser.id) return;

    console.log('[Socket] Connecting to', BACKEND_URL, 'for user', currentUser.id);

    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ [Socket Connected] Socket ID:', socket.id, 'User:', currentUser.id);
      setIsConnected(true);
      socket.emit('register_user', currentUser.id);
    });

    socket.on('disconnect', (reason) => {
      console.warn('❌ [Socket Disconnected]', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ [Socket Connection Error]', err.message);
      setIsConnected(false);
    });

    // 1. New Message Received
    socket.on('new_message', (msg) => {
      console.log('📩 [Socket new_message received]', msg);

      const currentActiveId = activeUserIdRef.current;
      const isFromCurrentChat =
        (msg.sender_id === currentActiveId && msg.receiver_id === currentUser.id) ||
        (msg.sender_id === currentUser.id && msg.receiver_id === currentActiveId);

      if (isFromCurrentChat) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Mark as read immediately if current user is receiver
        if (msg.sender_id !== currentUser.id) {
          socket.emit('mark_as_read', {
            sender_id: msg.sender_id,
            receiver_id: currentUser.id
          });
          soundFx.playReceive();
        }
      } else {
        if (msg.sender_id !== currentUser.id) {
          soundFx.playReceive();
        }
      }

      // Update sidebar users list
      setUsers((prevUsers) => {
        const partnerId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
        return prevUsers.map((u) => {
          if (u.id === partnerId) {
            const isUnread = partnerId !== currentActiveId && msg.sender_id !== currentUser.id;
            return {
              ...u,
              lastMessage: msg,
              unreadCount: isUnread ? (u.unreadCount || 0) + 1 : (currentActiveId === partnerId ? 0 : u.unreadCount)
            };
          }
          return u;
        }).sort((a, b) => {
          const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
          const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
          return timeB - timeA;
        });
      });
    });

    // 2. Typing Indicators
    socket.on('user_typing_start', ({ sender_id }) => {
      console.log('✍️ [Socket typing_start from]', sender_id);
      setTypingUsersMap((prev) => ({ ...prev, [sender_id]: true }));
    });

    socket.on('user_typing_stop', ({ sender_id }) => {
      console.log('🛑 [Socket typing_stop from]', sender_id);
      setTypingUsersMap((prev) => ({ ...prev, [sender_id]: false }));
    });

    // 3. Read Receipts
    socket.on('messages_read_by_peer', ({ chat_with }) => {
      console.log('👀 [Socket messages_read_by_peer]', chat_with);
      if (activeUserIdRef.current === chat_with) {
        setMessages((prev) =>
          prev.map((m) => (m.sender_id === currentUser.id ? { ...m, is_read: 1, status: 'read' } : m))
        );
      }
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id === chat_with && u.lastMessage && u.lastMessage.sender_id === currentUser.id) {
            return {
              ...u,
              lastMessage: { ...u.lastMessage, is_read: 1, status: 'read' }
            };
          }
          return u;
        })
      );
    });

    // 4. Reactions
    socket.on('reaction_updated', ({ message_id, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === message_id ? { ...m, reactions } : m))
      );
    });

    // 5. Message Deleted
    socket.on('message_deleted', ({ message_id }) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message_id
            ? { ...m, text: '🚫 This message was deleted', deleted_for_everyone: true, media_url: null, media_type: null }
            : m
        )
      );
    });

    socket.on('message_deleted_for_me', ({ message_id }) => {
      setMessages((prev) => prev.filter((m) => m.id !== message_id));
    });

    // 6. User Online / Offline Status
    socket.on('user_status_changed', ({ userId, online, last_seen }) => {
      console.log('🟢 [Socket user_status_changed]', userId, 'Online:', online);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, online: online ? 1 : 0, last_seen } : u))
      );
    });

    // 7. WebRTC Live Calling Handlers
    socket.on('webrtc_incoming_call', ({ from_user, offer, call_type }) => {
      console.log('📞 [WebRTC Incoming Call] From:', from_user.display_name, 'Type:', call_type);
      incomingOfferRef.current = offer;
      setCallPartner(from_user);
      setCallType(call_type || 'video');
      setCallState('incoming_ringing');
    });

    socket.on('webrtc_call_accepted', async ({ answer }) => {
      console.log('✅ [WebRTC Call Accepted by Remote Peer]');
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Process queued ICE candidates
          if (iceCandidatesQueueRef.current.length > 0) {
            console.log(`[WebRTC] Draining ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
            for (const cand of iceCandidatesQueueRef.current) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch (e) {
                console.warn('Queued candidate add error:', e);
              }
            }
            iceCandidatesQueueRef.current = [];
          }
          setCallState('connected');
        } catch (err) {
          console.error('[WebRTC] Error setting remote description from answer:', err);
        }
      }
    });

    socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] addIceCandidate error:', err);
        }
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    });

    socket.on('webrtc_call_ended', ({ reason }) => {
      console.log('🛑 [WebRTC Call Ended by peer]:', reason);
      cleanupCall();
    });

    socket.on('webrtc_call_rejected', ({ reason } = {}) => {
      console.log('❌ [WebRTC Call Rejected by peer]:', reason);
      if (reason) {
        alert(reason);
      }
      cleanupCall();
    });

    return () => {
      cleanupCall();
      socket.disconnect();
    };
  }, [currentUser?.id]);

  // Start outgoing call
  const handleStartCall = async (type = 'video') => {
    if (!activeUser || !socketRef.current) return;

    try {
      setCallType(type);
      setCallPartner(activeUser);
      setCallState('outgoing_ringing');
      setIsMicMuted(false);
      setIsCameraOff(false);
      setIsScreenSharing(false);

      const stream = await acquireMediaStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS_CONFIG);
      peerConnectionRef.current = pc;

      // Add local media tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote media track arrival
      pc.ontrack = (event) => {
        console.log('📡 [WebRTC Caller ontrack]', event.streams);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Send local ICE candidates to peer
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc_ice_candidate', {
            to_user: String(activeUser.id),
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 [WebRTC Connection State]:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupCall();
        }
      };

      // Create Offer and emit to peer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketRef.current.emit('webrtc_call_user', {
        user_to_call: String(activeUser.id),
        from_user: currentUser,
        offer,
        call_type: type
      });
    } catch (err) {
      console.error('Failed to initiate call:', err);
      alert('Could not access camera or microphone. Please check browser permissions.');
      cleanupCall();
    }
  };

  // Accept incoming call
  const handleAcceptCall = async () => {
    const offer = incomingOfferRef.current;
    const partner = callPartnerRef.current;
    const type = callTypeRef.current;

    if (!offer || !partner || !socketRef.current) return;

    try {
      const stream = await acquireMediaStream(type);
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS_CONFIG);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote tracks
      pc.ontrack = (event) => {
        console.log('📡 [WebRTC Callee ontrack]', event.streams);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Send local ICE candidates to peer
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc_ice_candidate', {
            to_user: String(partner.id),
            candidate: event.candidate
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 [WebRTC Callee Connection State]:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupCall();
        }
      };

      // Set Remote Description from incoming offer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process queued candidates
      if (iceCandidatesQueueRef.current.length > 0) {
        console.log(`[WebRTC] Callee draining ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
        for (const cand of iceCandidatesQueueRef.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('Error adding queued ICE candidate on answer:', e);
          }
        }
        iceCandidatesQueueRef.current = [];
      }

      // Create Answer and emit
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('webrtc_answer_call', {
        to_user: String(partner.id),
        answer
      });

      setCallState('connected');
    } catch (err) {
      console.error('Failed to answer call:', err);
      alert('Could not access microphone or camera.');
      handleRejectCall();
    }
  };

  // Reject incoming call
  const handleRejectCall = () => {
    if (callPartnerRef.current && socketRef.current) {
      socketRef.current.emit('webrtc_reject_call', {
        to_user: String(callPartnerRef.current.id)
      });
    }
    cleanupCall();
  };

  // End active or outgoing call
  const handleEndCall = () => {
    if (callPartnerRef.current && socketRef.current) {
      socketRef.current.emit('webrtc_end_call', {
        to_user: String(callPartnerRef.current.id),
        reason: 'User hung up'
      });
    }
    cleanupCall();
  };

  // Toggle Microphone
  const handleToggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const handleToggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  // Screen Sharing
  const handleToggleScreenShare = async () => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    if (isScreenSharing) {
      // Revert screen share back to camera video
      try {
        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const camTrack = camStream.getVideoTracks()[0];

        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender && camTrack) {
          await videoSender.replaceTrack(camTrack);
        }

        if (localStreamRef.current) {
          const currentVideo = localStreamRef.current.getVideoTracks()[0];
          if (currentVideo) {
            localStreamRef.current.removeTrack(currentVideo);
            currentVideo.stop();
          }
          localStreamRef.current.addTrack(camTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setIsScreenSharing(false);
      } catch (err) {
        console.error('Failed to switch back to camera:', err);
      }
    } else {
      // Start Screen Share
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, screenStream);
        }

        screenTrack.onended = () => {
          handleToggleScreenShare();
        };

        if (localStreamRef.current) {
          const currentVideo = localStreamRef.current.getVideoTracks()[0];
          if (currentVideo) {
            localStreamRef.current.removeTrack(currentVideo);
            currentVideo.stop();
          }
          localStreamRef.current.addTrack(screenTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
        setIsScreenSharing(true);
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  // Load contacts list
  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.users) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    if (currentUser && token) {
      fetchUsers();
    }
  }, [currentUser?.id, token]);

  // Load message history when selecting a user
  const handleSelectUser = async (userId) => {
    setActiveUserId(userId);
    setReplyingTo(null);

    // Clear unread count locally for this user
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, unreadCount: 0 } : u))
    );

    try {
      const res = await fetch(`/api/messages/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);

        // Notify socket that all incoming messages are read
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('mark_as_read', {
            sender_id: userId,
            receiver_id: currentUser.id
          });
        }
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  // Send Message via Socket
  const handleSendMessage = ({ text, media_url, media_type, reply_to_id }) => {
    if (!activeUserId) return;

    soundFx.playSend();

    const payload = {
      sender_id: currentUser.id,
      receiver_id: activeUserId,
      text,
      media_url,
      media_type,
      reply_to_id
    };

    if (socketRef.current && socketRef.current.connected) {
      console.log('🚀 [Sending message via socket]:', payload);
      socketRef.current.emit('send_message', payload, (response) => {
        if (response && response.success && response.message) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === response.message.id)) return prev;
            return [...prev, response.message];
          });

          setUsers((prev) =>
            prev.map((u) => (u.id === activeUserId ? { ...u, lastMessage: response.message } : u))
          );
        }
      });
    } else {
      console.warn('⚠️ Socket not connected, message send queued.');
    }
  };

  // Typing Start / Stop Handlers
  const handleTypingStart = () => {
    if (activeUserId && socketRef.current && socketRef.current.connected) {
      console.log('✍️ [Emitting typing_start to]', activeUserId);
      socketRef.current.emit('typing_start', {
        sender_id: currentUser.id,
        receiver_id: activeUserId
      });
    }
  };

  const handleTypingStop = () => {
    if (activeUserId && socketRef.current && socketRef.current.connected) {
      console.log('🛑 [Emitting typing_stop to]', activeUserId);
      socketRef.current.emit('typing_stop', {
        sender_id: currentUser.id,
        receiver_id: activeUserId
      });
    }
  };

  // Forward Message
  const handleForwardMessage = (messageId, targetUserIds) => {
    if (!socketRef.current || !socketRef.current.connected) return;

    socketRef.current.emit(
      'forward_message',
      {
        sender_id: currentUser.id,
        message_id: messageId,
        target_user_ids: targetUserIds
      },
      (res) => {
        if (res && res.success) {
          soundFx.playSend();
          fetchUsers();
          if (targetUserIds.includes(activeUserId)) {
            const currentFwd = res.forwardedMessages.find((m) => m.receiver_id === activeUserId);
            if (currentFwd) {
              setMessages((prev) => [...prev, currentFwd]);
            }
          }
        }
      }
    );
  };

  // Emoji Reaction
  const handleToggleReaction = (messageId, emoji) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('toggle_reaction', {
      message_id: messageId,
      emoji,
      user_id: currentUser.id,
      peer_id: activeUserId
    });
  };

  // Delete Message
  const handleDeleteMessage = (messageId, deleteType) => {
    if (!socketRef.current || !socketRef.current.connected) return;
    socketRef.current.emit('delete_message', {
      message_id: messageId,
      delete_type: deleteType,
      user_id: currentUser.id,
      peer_id: activeUserId
    });
  };

  // Update Profile
  const handleUpdateProfile = async (profileData) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setCurrentUser(data.user);
        localStorage.setItem('chat_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Update profile failed:', err);
    }
  };

  // Logout
  const handleLogout = () => {
    cleanupCall();
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    setCurrentUser(null);
    setToken('');
    setActiveUserId(null);
    setMessages([]);
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const handleSwitchAccount = () => {
    handleLogout();
  };

  const activeUser = users.find((u) => u.id === activeUserId);

  if (!currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={(user, tok) => {
          setCurrentUser(user);
          setToken(tok);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-wa-dark overflow-hidden relative select-none">
      {/* 1. Sidebar: visible on desktop, or on mobile when no active chat is selected */}
      <div className={`h-full ${activeUser ? 'hidden md:flex' : 'flex w-full'} md:w-[380px] lg:w-[420px] md:min-w-[320px] md:max-w-[450px] md:border-r md:border-wa-border flex-shrink-0`}>
        <Sidebar
          currentUser={currentUser}
          users={users}
          activeUserId={activeUserId}
          onSelectUser={handleSelectUser}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLogout={handleLogout}
          onSwitchAccount={handleSwitchAccount}
          typingUsersMap={typingUsersMap}
        />
      </div>

      {/* 2. Main Chat Area: visible on desktop, or on mobile when active chat is selected */}
      {activeUser ? (
        <div className={`flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-wa-dark ${!activeUser ? 'hidden md:flex' : 'flex w-full'}`}>
          <ChatArea
            activeUser={activeUser}
            currentUser={currentUser}
            messages={messages}
            isTyping={Boolean(typingUsersMap[activeUser.id])}
            onQuoteReply={(msg) => {
              setReplyingTo({
                id: msg.id,
                text: msg.text,
                media_type: msg.media_type,
                sender_name: msg.sender_id === currentUser.id ? 'You' : activeUser.display_name
              });
            }}
            onOpenForwardModal={(msg) => setForwardMessage(msg)}
            onToggleReaction={handleToggleReaction}
            onDeleteMessage={handleDeleteMessage}
            onMediaClick={(url) => setActiveMediaUrl(url)}
            onStartCall={handleStartCall}
            onBack={() => setActiveUserId(null)}
          />

          <ChatInput
            onSendMessage={handleSendMessage}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            onTypingStart={handleTypingStart}
            onTypingStop={handleTypingStop}
          />
        </div>
      ) : (
        <div className="hidden md:flex flex-1 bg-[#222e35] border-b-[6px] border-wa-green flex-col items-center justify-center p-10 text-center">
          <div className="w-[120px] h-[120px] rounded-full bg-wa-panel flex items-center justify-center mb-7 shadow-2xl border-2 border-wa-green/20">
            <Laptop size={56} className="text-wa-green" />
          </div>

          <h1 className="text-2xl font-normal text-wa-text-primary mb-3">
            WhatsApp Web
          </h1>

          <p className="text-sm text-wa-text-secondary max-w-[460px] leading-relaxed mb-6">
            Send and receive instant messages, media attachments, and make real-time audio and video calls directly from your browser.
          </p>

          <div className="inline-flex items-center gap-2 text-wa-text-secondary text-xs bg-wa-panel px-4 py-2 rounded-full border border-white/5">
            {isConnected ? (
              <>
                <Wifi size={14} className="text-wa-green" />
                <span>Socket Connected • Real-time Active</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-red-500" />
                <span className="text-red-500">Socket Reconnecting...</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. Live WebRTC Call Modal */}
      <CallModal
        callState={callState}
        callType={callType}
        remoteUser={callPartner}
        localStream={localStream}
        remoteStream={remoteStream}
        onAcceptCall={handleAcceptCall}
        onRejectCall={handleRejectCall}
        onEndCall={handleEndCall}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
      />

      {/* 4. Other Modals */}
      <ForwardModal
        isOpen={Boolean(forwardMessage)}
        onClose={() => setForwardMessage(null)}
        messageToForward={forwardMessage}
        users={users}
        currentUserId={currentUser.id}
        onForward={handleForwardMessage}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
      />

      <MediaViewerModal
        mediaUrl={activeMediaUrl}
        onClose={() => setActiveMediaUrl(null)}
      />
    </div>
  );
}
