import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  MoreVertical,
  Phone,
  Video,
  Check,
  CheckCheck,
  Forward,
  Reply,
  Smile,
  Copy,
  Trash2,
  Star,
  ChevronDown,
  FileText,
  Play,
  Pause,
  Volume2,
  Download,
  ExternalLink,
  Film,
  X,
  ArrowLeft
} from 'lucide-react';
import { downloadMediaFile } from '../utils/download';

const QUICK_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

export default function ChatArea({
  activeUser,
  currentUser,
  messages,
  isTyping,
  onQuoteReply,
  onOpenForwardModal,
  onToggleReaction,
  onDeleteMessage,
  onMediaClick,
  onStartCall,
  onBack
}) {
  const [menuMessageId, setMenuMessageId] = useState(null);
  const [reactionMessageId, setReactionMessageId] = useState(null);
  const [chatSearch, setChatSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState(null);

  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isTyping]);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuMessageId(null);
      setReactionMessageId(null);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const scrollToMessage = (msgId) => {
    const el = messageRefs.current[msgId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight');
      setTimeout(() => {
        el.classList.remove('message-highlight');
      }, 2000);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredMessages = messages.filter(m => {
    if (!chatSearch.trim()) return true;
    return m.text && m.text.toLowerCase().includes(chatSearch.toLowerCase());
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {/* 1. Chat Header */}
      <div style={{
        height: '60px',
        backgroundColor: '#202c33',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #222d34',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mobile Back to Chats Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden flex items-center justify-center w-8 h-8 rounded-full text-wa-text-secondary hover:text-wa-text-primary hover:bg-white/10 active:scale-95 transition-all mr-1 -ml-1"
              title="Back to chats"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div style={{ position: 'relative' }}>
            <img
              src={activeUser.avatar}
              alt={activeUser.display_name}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
            />
            {activeUser.online ? (
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '10px',
                height: '10px',
                backgroundColor: '#00a884',
                borderRadius: '50%',
                border: '2px solid #202c33'
              }} />
            ) : null}
          </div>

          <div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#e9edef' }}>
              {activeUser.display_name}
            </div>
            <div style={{ fontSize: '12px', color: isTyping ? '#00a884' : '#8696a0', fontWeight: isTyping ? '600' : 'normal' }}>
              {isTyping ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="typing-dots"><span /><span /><span /></span>
                  typing...
                </span>
              ) : activeUser.online ? (
                'Online'
              ) : (
                `Last seen ${activeUser.last_seen ? formatMessageTime(activeUser.last_seen) : 'recently'}`
              )}
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="icon-btn"
            title="Search in chat"
          >
            <Search size={18} color={showSearch ? '#00a884' : '#8696a0'} />
          </button>
          <button 
            className="icon-btn" 
            title="Start Video Call"
            onClick={() => onStartCall && onStartCall('video')}
            style={{ color: '#00a884' }}
          >
            <Video size={19} />
          </button>
          <button 
            className="icon-btn" 
            title="Start Voice Call"
            onClick={() => onStartCall && onStartCall('audio')}
            style={{ color: '#00a884' }}
          >
            <Phone size={18} />
          </button>
        </div>
      </div>

      {/* 2. In-Chat Search Bar Drawer */}
      {showSearch && (
        <div className="animate-slide-down" style={{
          backgroundColor: '#182229',
          padding: '10px 16px',
          borderBottom: '1px solid #222d34',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 5
        }}>
          <Search size={16} color="#8696a0" />
          <input
            type="text"
            placeholder="Search messages in this conversation..."
            value={chatSearch}
            onChange={(e) => setChatSearch(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: '#202c33',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#e9edef',
              fontSize: '13px',
              outline: 'none'
            }}
          />
          <button
            onClick={() => { setShowSearch(false); setChatSearch(''); }}
            className="icon-btn"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. Messages Stream */}
      <div
        className="chat-pattern-bg"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {/* End-to-end security badge pill */}
        <div style={{
          alignSelf: 'center',
          backgroundColor: '#182229',
          color: '#e9edef',
          padding: '6px 14px',
          borderRadius: '8px',
          fontSize: '11px',
          textAlign: 'center',
          maxWidth: '420px',
          margin: '10px 0 16px 0',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          🔒 Messages in this chat with <strong>{activeUser.display_name}</strong> are synced with the <strong>chat</strong> DB and delivered real-time via WebSockets.
        </div>

        {filteredMessages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8696a0', fontSize: '13px', marginTop: '40px' }}>
            {chatSearch ? 'No messages match your search.' : 'No messages yet. Say hello! 👋'}
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isOutgoing = msg.sender_id === currentUser.id;
            const hasReactions = msg.reactions && msg.reactions.length > 0;
            const isMenuOpen = menuMessageId === msg.id;
            const isReactionOpen = reactionMessageId === msg.id;

            return (
              <div
                key={msg.id}
                ref={(el) => (messageRefs.current[msg.id] = el)}
                style={{
                  display: 'flex',
                  justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
                  position: 'relative',
                  marginBottom: hasReactions ? '10px' : '3px'
                }}
                onMouseEnter={() => {}}
              >
                {/* Bubble Container */}
                <div
                  className={isOutgoing ? 'message-bubble-out' : 'message-bubble-in'}
                  style={{
                    maxWidth: '65%',
                    minWidth: '120px',
                    padding: '6px 9px 8px 9px',
                    position: 'relative',
                    color: '#e9edef',
                    fontSize: '14.2px',
                    lineHeight: '19px',
                    borderRadius: '8px'
                  }}
                >
                  {/* Hover Actions Trigger */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      opacity: isMenuOpen || isReactionOpen ? 1 : 0,
                      transition: 'opacity 0.15s ease',
                      zIndex: 3
                    }}
                    className="bubble-action-trigger"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setMenuMessageId(isMenuOpen ? null : msg.id)}
                      style={{
                        background: isOutgoing ? 'rgba(0, 92, 75, 0.8)' : 'rgba(32, 44, 51, 0.8)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#8696a0'
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Context Menu Dropdown */}
                  {isMenuOpen && (
                    <div
                      className="animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: '28px',
                        right: isOutgoing ? '0' : 'auto',
                        left: isOutgoing ? 'auto' : '0',
                        backgroundColor: '#233138',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-dropdown)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        padding: '6px 0',
                        zIndex: 100,
                        minWidth: '180px'
                      }}
                    >
                      {/* 1. Reply */}
                      <div
                        onClick={() => {
                          setMenuMessageId(null);
                          onQuoteReply(msg);
                        }}
                        style={{
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '13px',
                          color: '#e9edef',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Reply size={15} color="#00a884" /> Reply
                      </div>

                      {/* 2. Forward */}
                      <div
                        onClick={() => {
                          setMenuMessageId(null);
                          onOpenForwardModal(msg);
                        }}
                        style={{
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '13px',
                          color: '#e9edef',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Forward size={15} color="#53bdeb" /> Forward
                      </div>

                      {/* 3. React */}
                      <div
                        onClick={() => {
                          setMenuMessageId(null);
                          setReactionMessageId(msg.id);
                        }}
                        style={{
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '13px',
                          color: '#e9edef',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Smile size={15} color="#f59e0b" /> React
                      </div>

                      {/* 4. Copy */}
                      {msg.text && (
                        <div
                          onClick={() => {
                            setMenuMessageId(null);
                            copyToClipboard(msg.text);
                          }}
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            color: '#e9edef',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Copy size={15} /> Copy Text
                        </div>
                      )}

                      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                      {/* 5. Delete Options */}
                      <div
                        onClick={() => {
                          setMenuMessageId(null);
                          onDeleteMessage(msg.id, 'me');
                        }}
                        style={{
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '13px',
                          color: '#ef4444',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Trash2 size={15} /> Delete for me
                      </div>

                      {isOutgoing && !msg.deleted_for_everyone && (
                        <div
                          onClick={() => {
                            setMenuMessageId(null);
                            onDeleteMessage(msg.id, 'everyone');
                          }}
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontWeight: '600'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={15} /> Delete for everyone
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reaction Selector Popover */}
                  {isReactionOpen && (
                    <div
                      className="animate-fade-in"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: '-42px',
                        left: isOutgoing ? 'auto' : '0',
                        right: isOutgoing ? '0' : 'auto',
                        backgroundColor: '#202c33',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '24px',
                        padding: '4px 10px',
                        display: 'flex',
                        gap: '6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        zIndex: 100
                      }}
                    >
                      {QUICK_REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            setReactionMessageId(null);
                            onToggleReaction(msg.id, emoji);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            transition: 'transform 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* A. Forwarded Tag */}
                  {msg.is_forwarded && (
                    <div className="forward-badge">
                      <Forward size={13} color="#8696a0" />
                      <span>Forwarded</span>
                    </div>
                  )}

                  {/* B. Quoted Reply Bubble Preview */}
                  {msg.reply_to && (
                    <div
                      onClick={() => scrollToMessage(msg.reply_to.id)}
                      className={isOutgoing ? 'reply-quote-box-out' : 'reply-quote-box-in'}
                      style={{
                        padding: '6px 10px',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      <div style={{
                        fontWeight: '600',
                        color: isOutgoing ? '#06cf9c' : '#53bdeb',
                        marginBottom: '2px'
                      }}>
                        {msg.reply_to.sender_name}
                      </div>
                      <div style={{
                        color: '#8696a0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {msg.reply_to.text || (msg.reply_to.media_type ? `[${msg.reply_to.media_type}]` : 'Media attachment')}
                      </div>
                    </div>
                  )}

                  {/* C. Media: Image Attachment */}
                  {msg.media_url && msg.media_type === 'image' && (
                    <div style={{ position: 'relative', marginBottom: '6px', borderRadius: '6px', overflow: 'hidden', maxWidth: '380px' }}>
                      <img
                        src={msg.media_url}
                        alt="Shared attachment"
                        loading="lazy"
                        decoding="async"
                        crossOrigin="anonymous"
                        onClick={() => onMediaClick(msg.media_url)}
                        style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', display: 'block' }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadMediaFile(msg.media_url, 'image.jpg');
                        }}
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Download Image"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  )}

                  {/* D. Media: Video Attachment */}
                  {msg.media_url && msg.media_type === 'video' && (
                    <div style={{ marginBottom: '6px', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#000' }}>
                      <video
                        src={msg.media_url}
                        controls
                        style={{ width: '100%', maxHeight: '280px', borderRadius: '6px' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 6px' }}>
                        <button
                          type="button"
                          onClick={() => downloadMediaFile(msg.media_url, 'video.mp4')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#00a884',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Download size={13} /> Download Video
                        </button>
                      </div>
                    </div>
                  )}

                  {/* E. Media: Audio Note */}
                  {msg.media_url && msg.media_type === 'audio' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 8px',
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      borderRadius: '8px',
                      marginBottom: '6px',
                      minWidth: '220px'
                    }}>
                      <button
                        onClick={() => {
                          if (playingAudioId === msg.id) {
                            setPlayingAudioId(null);
                          } else {
                            setPlayingAudioId(msg.id);
                          }
                        }}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '50%',
                          backgroundColor: '#00a884',
                          border: 'none',
                          color: '#111b21',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        {playingAudioId === msg.id ? <Pause size={16} /> : <Play size={16} />}
                      </button>

                      <div style={{ flex: 1 }}>
                        <div style={{
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}>
                          {[12, 18, 24, 14, 20, 26, 16, 22, 10, 20, 24, 18, 14, 22, 12].map((h, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '3px',
                                height: `${h * 0.5}px`,
                                backgroundColor: playingAudioId === msg.id ? '#00a884' : '#8696a0',
                                borderRadius: '1px'
                              }}
                            />
                          ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '11px', color: '#8696a0' }}>Audio file</span>
                          <button
                            type="button"
                            onClick={() => downloadMediaFile(msg.media_url, 'audio.mp3')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#00a884',
                              fontSize: '11px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              cursor: 'pointer'
                            }}
                            title="Download Audio"
                          >
                            <Download size={12} /> Download
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* F. Media: Document / File Attachment */}
                  {msg.media_url && msg.media_type === 'document' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                      marginBottom: '6px',
                      minWidth: '200px'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        backgroundColor: '#202c33',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#53bdeb'
                      }}>
                        <FileText size={20} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#e9edef', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.media_url.split('/').pop().split('?')[0] || 'Attachment File'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#8696a0' }}>
                          Document
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadMediaFile(msg.media_url, 'document.pdf')}
                        style={{
                          backgroundColor: '#00a884',
                          color: '#111b21',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Download Document"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  )}

                  {/* E. Text Content */}
                  <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    {msg.deleted_for_everyone ? (
                      <span style={{ fontStyle: 'italic', color: '#8696a0' }}>
                        🚫 This message was deleted
                      </span>
                    ) : (
                      msg.text
                    )}
                  </div>

                  {/* F. Message Timestamp & Delivery Checkmarks */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px',
                    marginTop: '2px',
                    float: 'right',
                    marginLeft: '12px',
                    fontSize: '11px',
                    color: '#8696a0'
                  }}>
                    <span>{formatMessageTime(msg.created_at)}</span>
                    {isOutgoing && !msg.deleted_for_everyone && (
                      <span>
                        {msg.is_read === 1 || msg.is_read === true || msg.status === 'read' ? (
                          <CheckCheck size={15} color="#53bdeb" title="Read" />
                        ) : msg.status === 'delivered' ? (
                          <CheckCheck size={15} color="#8696a0" title="Delivered" />
                        ) : (
                          <Check size={15} color="#8696a0" title="Sent" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* G. Reaction Pill List at bottom of bubble */}
                  {hasReactions && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-10px',
                      left: isOutgoing ? 'auto' : '8px',
                      right: isOutgoing ? '8px' : 'auto',
                      display: 'flex',
                      gap: '4px',
                      zIndex: 2
                    }}>
                      {msg.reactions.map((r, idx) => (
                        <div
                          key={idx}
                          className="reaction-pill"
                          onClick={() => onToggleReaction(msg.id, r.emoji)}
                        >
                          <span>{r.emoji}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      <style>{`
        .message-bubble-out:hover .bubble-action-trigger,
        .message-bubble-in:hover .bubble-action-trigger {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
