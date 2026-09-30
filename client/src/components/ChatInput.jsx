import React, { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  X,
  Image as ImageIcon,
  FileText,
  Music,
  Square,
  Sparkles
} from 'lucide-react';

const COMMON_EMOJIS = [
  '😀', '😂', '🤣', '😍', '🥰', '😘', '😋', '😎', '🥳', '🤔',
  '👍', '👎', '👏', '🙌', '🙏', '🔥', '✨', '🎉', '💯', '❤️',
  '💔', '👀', '🚀', '⭐', '☕', '💡', '✅', '❌', '🍕', '🍻'
];

export default function ChatInput({
  onSendMessage,
  replyingTo,
  onCancelReply,
  onTypingStart,
  onTypingStop,
  disabled
}) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [stagedAttachment, setStagedAttachment] = useState(null);

  const fileInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const recordIntervalRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto focus input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo, stagedAttachment]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (stagedAttachment && stagedAttachment.previewUrl) {
        URL.revokeObjectURL(stagedAttachment.previewUrl);
      }
    };
  }, [stagedAttachment]);

  // Handle typing debounce
  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);

    if (onTypingStart) {
      onTypingStart();
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (onTypingStop) {
        onTypingStop();
      }
    }, 1500);
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !stagedAttachment) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (onTypingStop) {
      onTypingStop();
    }

    // 1. If an attachment is staged, upload it first then send message with caption
    if (stagedAttachment) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', stagedAttachment.file);

        const token = localStorage.getItem('chat_token');
        const res = await fetch('/api/messages/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        onSendMessage({
          text: trimmed,
          media_url: data.url,
          media_type: data.mediaType,
          reply_to_id: replyingTo ? replyingTo.id : null
        });

        if (stagedAttachment.previewUrl) {
          URL.revokeObjectURL(stagedAttachment.previewUrl);
        }
        setStagedAttachment(null);
        setText('');
        setShowEmojis(false);
        setShowAttachments(false);

        if (replyingTo && onCancelReply) {
          onCancelReply();
        }
      } catch (err) {
        console.error('File upload failed:', err);
        alert('Failed to upload attachment.');
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // 2. Normal text message
    onSendMessage({
      text: trimmed,
      reply_to_id: replyingTo ? replyingTo.id : null
    });

    setText('');
    setShowEmojis(false);
    setShowAttachments(false);

    if (replyingTo && onCancelReply) {
      onCancelReply();
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Stage File Attachment for user to review and add caption
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let mediaType = 'document';
    let previewUrl = null;

    if (file.type.startsWith('image/')) {
      mediaType = 'image';
      previewUrl = URL.createObjectURL(file);
    } else if (file.type.startsWith('audio/')) {
      mediaType = 'audio';
    } else if (file.type.startsWith('video/')) {
      mediaType = 'video';
      previewUrl = URL.createObjectURL(file);
    }

    setStagedAttachment({
      file,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2),
      type: mediaType,
      previewUrl
    });

    setShowAttachments(false);
    e.target.value = '';
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCancelAttachment = () => {
    if (stagedAttachment && stagedAttachment.previewUrl) {
      URL.revokeObjectURL(stagedAttachment.previewUrl);
    }
    setStagedAttachment(null);
  };

  // Voice Note Recording Simulation
  const startRecording = () => {
    setIsRecording(true);
    setRecordDuration(0);
    recordIntervalRef.current = setInterval(() => {
      setRecordDuration(prev => prev + 1);
    }, 1000);
  };

  const stopAndSendRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    setIsRecording(false);

    // Send voice audio note simulation
    const sampleDurationSecs = Math.max(recordDuration, 3);
    onSendMessage({
      text: `🎤 Voice note (${sampleDurationSecs}s)`,
      media_url: 'https://actions.google.com/sounds/v1/water/rain_heavy.ogg',
      media_type: 'audio',
      reply_to_id: replyingTo ? replyingTo.id : null
    });

    if (replyingTo && onCancelReply) {
      onCancelReply();
    }
    setRecordDuration(0);
  };

  const cancelRecording = () => {
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    setIsRecording(false);
    setRecordDuration(0);
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={{
      backgroundColor: '#202c33',
      position: 'relative',
      borderTop: '1px solid #222d34',
      flexShrink: 0,
      zIndex: 10
    }}>
      {/* 1. Quoted Reply Preview Banner */}
      {replyingTo && (
        <div className="animate-slide-down" style={{
          backgroundColor: '#182229',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderLeft: '4px solid #00a884',
          borderBottom: '1px solid #222d34'
        }}>
          <div style={{ overflow: 'hidden', paddingRight: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#00a884', marginBottom: '2px' }}>
              Replying to {replyingTo.sender_name || 'Message'}
            </div>
            <div style={{
              fontSize: '13px',
              color: '#8696a0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {replyingTo.text || (replyingTo.media_type ? `[${replyingTo.media_type}]` : 'Media')}
            </div>
          </div>
          <button
            onClick={onCancelReply}
            className="icon-btn"
            style={{ width: '28px', height: '28px', flexShrink: 0 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 2. Staged Attachment Preview Banner (WhatsApp style) */}
      {stagedAttachment && (
        <div className="animate-slide-down" style={{
          backgroundColor: '#182229',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderLeft: '4px solid #53bdeb',
          borderBottom: '1px solid #222d34'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
            {stagedAttachment.previewUrl && stagedAttachment.type === 'image' ? (
              <img
                src={stagedAttachment.previewUrl}
                alt="Attachment Preview"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '6px',
                  objectFit: 'cover',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              />
            ) : (
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '6px',
                backgroundColor: '#202c33',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#53bdeb'
              }}>
                <FileText size={22} />
              </div>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: '600',
                color: '#e9edef',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {stagedAttachment.name}
              </div>
              <div style={{ fontSize: '11px', color: '#8696a0' }}>
                {stagedAttachment.size} MB • {stagedAttachment.type.toUpperCase()} (Attach caption below)
              </div>
            </div>
          </div>

          <button
            onClick={handleCancelAttachment}
            className="icon-btn"
            style={{ width: '28px', height: '28px', flexShrink: 0, color: '#ef4444' }}
            title="Remove attachment"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 3. Emoji Picker Popover */}
      {showEmojis && (
        <div className="animate-fade-in" style={{
          position: 'absolute',
          bottom: '70px',
          left: '16px',
          backgroundColor: '#202c33',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '14px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 100,
          width: '320px',
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
            textAlign: 'center'
          }}>
            {COMMON_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setText(prev => prev + emoji);
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '22px',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Attachment Popover */}
      {showAttachments && (
        <div className="animate-fade-in" style={{
          position: 'absolute',
          bottom: '70px',
          left: '56px',
          backgroundColor: '#202c33',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          width: '180px'
        }}>
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: '#e9edef',
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#bf59cf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ImageIcon size={16} color="#fff" />
            </div>
            <span>Photos & Videos</span>
          </button>

          <button
            onClick={() => audioInputRef.current && audioInputRef.current.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: '#e9edef',
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#e3516e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Music size={16} color="#fff" />
            </div>
            <span>Audio File</span>
          </button>

          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: '#e9edef',
              fontSize: '13px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#5f66cd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={16} color="#fff" />
            </div>
            <span>Document</span>
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <input
        type="file"
        accept="audio/*"
        ref={audioInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Main Bar */}
      <div style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '8px'
      }}>
        {isRecording ? (
          // Recording View
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            backgroundColor: '#2a3942',
            borderRadius: '10px',
            padding: '8px 16px',
            animation: 'fadeIn 0.2s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                animation: 'pulseGreen 1s infinite'
              }} />
              <span style={{ fontSize: '14px', color: '#e9edef', fontWeight: '600' }}>
                {formatTimer(recordDuration)}
              </span>
              <span style={{ fontSize: '12px', color: '#8696a0' }}>Recording audio note...</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={cancelRecording}
                className="icon-btn"
                style={{ color: '#ef4444' }}
                title="Cancel"
              >
                <X size={20} />
              </button>
              <button
                onClick={stopAndSendRecording}
                style={{
                  backgroundColor: '#00a884',
                  color: '#111b21',
                  border: 'none',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Send Voice Note"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        ) : (
          // Normal Input View
          <>
            <button
              onClick={() => {
                setShowEmojis(!showEmojis);
                setShowAttachments(false);
              }}
              className="icon-btn"
              title="Emoji"
            >
              <Smile size={22} color={showEmojis ? '#00a884' : '#8696a0'} />
            </button>

            <button
              onClick={() => {
                setShowAttachments(!showAttachments);
                setShowEmojis(false);
              }}
              className="icon-btn"
              title="Attach"
            >
              <Paperclip size={20} color={showAttachments || stagedAttachment ? '#00a884' : '#8696a0'} />
            </button>

            <div style={{
              flex: 1,
              backgroundColor: '#2a3942',
              borderRadius: '10px',
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              minHeight: '42px'
            }}>
              <textarea
                ref={textareaRef}
                value={text}
                disabled={disabled || isUploading}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isUploading ? 'Uploading file...' : stagedAttachment ? 'Add a caption to attachment...' : 'Type a message'}
                rows={1}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#e9edef',
                  fontSize: '15px',
                  outline: 'none',
                  resize: 'none',
                  maxHeight: '100px',
                  fontFamily: 'inherit',
                  lineHeight: '1.4'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                }}
              />
            </div>

            {text.trim() || stagedAttachment || isUploading ? (
              <button
                onClick={handleSend}
                disabled={disabled || isUploading}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#00a884',
                  color: '#111b21',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0, 168, 132, 0.4)',
                  transition: 'background-color 0.15s ease'
                }}
                title={stagedAttachment ? 'Send Attachment & Caption' : 'Send'}
              >
                <Send size={18} />
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="icon-btn"
                title="Record voice note"
              >
                <Mic size={22} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
