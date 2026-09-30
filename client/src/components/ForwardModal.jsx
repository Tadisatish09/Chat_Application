import React, { useState } from 'react';
import { Search, X, Check, Send, Forward, User } from 'lucide-react';

export default function ForwardModal({
  isOpen,
  onClose,
  messageToForward,
  users,
  currentUserId,
  onForward
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !messageToForward) return null;

  const availableUsers = users.filter(u => u.id !== currentUserId);
  const filteredUsers = availableUsers.filter(u =>
    u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUser = (userId) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleSendForward = async () => {
    if (selectedUserIds.length === 0) return;
    setIsSending(true);
    try {
      await onForward(messageToForward.id, selectedUserIds);
      setSelectedUserIds([]);
      onClose();
    } catch (err) {
      console.error('Forward failed', err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        backgroundColor: '#202c33',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 16px 40px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '85vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #222d34',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#111b21'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Forward size={20} color="#00a884" />
            <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#e9edef', margin: 0 }}>
              Forward message to...
            </h2>
          </div>
          <button
            onClick={onClose}
            className="icon-btn"
            style={{ width: '32px', height: '32px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Preview being forwarded */}
        <div style={{
          padding: '12px 20px',
          backgroundColor: '#182229',
          borderBottom: '1px solid #222d34',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#8696a0',
            borderLeft: '3px solid #00a884',
            paddingLeft: '10px',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            <span style={{ color: '#00a884', fontWeight: '600', marginRight: '6px' }}>Forwarding:</span>
            {messageToForward.text || (messageToForward.media_type ? `[${messageToForward.media_type}]` : 'Media attachment')}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '12px 20px', backgroundColor: '#111b21', borderBottom: '1px solid #222d34' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#202c33',
            borderRadius: '8px',
            padding: '8px 12px',
            gap: '8px'
          }}>
            <Search size={16} color="#8696a0" />
            <input
              type="text"
              placeholder="Search registered contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#e9edef',
                fontSize: '14px',
                width: '100%',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Selected Chips */}
        {selectedUserIds.length > 0 && (
          <div style={{
            padding: '8px 20px',
            backgroundColor: '#111b21',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            borderBottom: '1px solid #222d34',
            maxHeight: '75px',
            overflowY: 'auto'
          }}>
            {selectedUserIds.map(id => {
              const u = users.find(x => x.id === id);
              if (!u) return null;
              return (
                <div
                  key={id}
                  style={{
                    backgroundColor: '#202c33',
                    border: '1px solid rgba(0, 168, 132, 0.4)',
                    borderRadius: '16px',
                    padding: '3px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: '#e9edef'
                  }}
                >
                  <img src={u.avatar} alt="" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
                  <span>{u.display_name}</span>
                  <X
                    size={13}
                    style={{ cursor: 'pointer', color: '#8696a0' }}
                    onClick={() => toggleUser(id)}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Contacts List */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
          {filteredUsers.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#8696a0', fontSize: '14px' }}>
              No contacts found
            </div>
          ) : (
            filteredUsers.map(u => {
              const isSelected = selectedUserIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleUser(u.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(0, 168, 132, 0.12)' : 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={u.avatar}
                        alt={u.display_name}
                        style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                      {u.online ? (
                        <div style={{
                          position: 'absolute',
                          bottom: 0,
                          right: 0,
                          width: '12px',
                          height: '12px',
                          backgroundColor: '#00a884',
                          borderRadius: '50%',
                          border: '2px solid #202c33'
                        }} />
                      ) : null}
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#e9edef' }}>
                        {u.display_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8696a0' }}>
                        {u.about || `@${u.username}`}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    border: isSelected ? 'none' : '2px solid #8696a0',
                    backgroundColor: isSelected ? '#00a884' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}>
                    {isSelected && <Check size={14} color="#111b21" strokeWidth={3} />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Instant Send button */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: '#111b21',
          borderTop: '1px solid #222d34',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ fontSize: '13px', color: '#8696a0' }}>
            {selectedUserIds.length > 0
              ? `${selectedUserIds.length} contact${selectedUserIds.length > 1 ? 's' : ''} selected`
              : 'Select one or more chats'}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #8696a0',
                color: '#e9edef',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              disabled={selectedUserIds.length === 0 || isSending}
              onClick={handleSendForward}
              style={{
                backgroundColor: selectedUserIds.length > 0 ? '#00a884' : '#2a3942',
                color: selectedUserIds.length > 0 ? '#111b21' : '#667781',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: selectedUserIds.length > 0 && !isSending ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Send size={15} />
              {isSending ? 'Forwarding...' : 'Forward'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
