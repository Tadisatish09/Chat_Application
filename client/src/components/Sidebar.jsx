import React, { useState } from 'react';
import {
  Search,
  MessageSquarePlus,
  MoreVertical,
  LogOut,
  User,
  Check,
  CheckCheck,
  ArrowRightLeft,
  CircleDot
} from 'lucide-react';

export default function Sidebar({
  currentUser,
  users,
  activeUserId,
  onSelectUser,
  onOpenProfile,
  onLogout,
  onSwitchAccount,
  typingUsersMap
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'online'
  const [showMenu, setShowMenu] = useState(false);

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.display_name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      (u.lastMessage && u.lastMessage.text && u.lastMessage.text.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (filter === 'unread') return (u.unreadCount || 0) > 0;
    if (filter === 'online') return Boolean(u.online);
    return true;
  });

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{
      width: '380px',
      minWidth: '320px',
      maxWidth: '450px',
      height: '100%',
      backgroundColor: '#111b21',
      borderRight: '1px solid #222d34',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* 1. Header Bar */}
      <div style={{
        height: '60px',
        backgroundColor: '#202c33',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #222d34'
      }}>
        <div
          onClick={onOpenProfile}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          title="Edit Profile"
        >
          <div style={{ position: 'relative' }}>
            <img
              src={currentUser.avatar}
              alt={currentUser.display_name}
              style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
            />
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
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e9edef', lineHeight: 1.2 }}>
              {currentUser.display_name}
            </div>
            <div style={{ fontSize: '11px', color: '#00a884', fontWeight: '500' }}>
              Online • @{currentUser.username}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={onSwitchAccount}
            className="icon-btn"
            title="Switch Account (Test Sockets)"
          >
            <ArrowRightLeft size={18} />
          </button>

          <button
            onClick={() => setShowMenu(!showMenu)}
            className="icon-btn"
            title="Menu"
          >
            <MoreVertical size={19} />
          </button>

          {/* Context Menu Dropdown */}
          {showMenu && (
            <div className="animate-fade-in" style={{
              position: 'absolute',
              top: '55px',
              right: '12px',
              backgroundColor: '#233138',
              borderRadius: '8px',
              boxShadow: 'var(--shadow-dropdown)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '6px 0',
              zIndex: 200,
              minWidth: '170px'
            }}>
              <div
                onClick={() => { setShowMenu(false); onOpenProfile(); }}
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#e9edef',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <User size={16} /> Profile
              </div>

              <div
                onClick={() => { setShowMenu(false); onSwitchAccount(); }}
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#e9edef',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <ArrowRightLeft size={16} /> Switch Account
              </div>

              <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

              <div
                onClick={() => { setShowMenu(false); onLogout(); }}
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#ef4444',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#182229'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut size={16} /> Log Out
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #222d34', backgroundColor: '#111b21' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#202c33',
          borderRadius: '8px',
          padding: '6px 12px',
          gap: '8px'
        }}>
          <Search size={16} color="#8696a0" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          {['all', 'unread', 'online'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                backgroundColor: filter === tab ? '#00a884' : '#202c33',
                color: filter === tab ? '#111b21' : '#8696a0',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Conversations List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredUsers.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8696a0', fontSize: '13px' }}>
            No chats or contacts found
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isActive = activeUserId === user.id;
            const isTyping = Boolean(typingUsersMap[user.id]);
            const lastMsg = user.lastMessage;

            return (
              <div
                key={user.id}
                onClick={() => onSelectUser(user.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#2a3942' : 'transparent',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  transition: 'background-color 0.15s ease',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = '#202c33';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {/* Avatar with live online badge */}
                <div style={{ position: 'relative', marginRight: '14px', flexShrink: 0 }}>
                  <img
                    src={user.avatar}
                    alt={user.display_name}
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  {user.online ? (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#00a884',
                      borderRadius: '50%',
                      border: '2px solid #111b21'
                    }} />
                  ) : null}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#e9edef',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {user.display_name}
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: user.unreadCount > 0 ? '#00a884' : '#8696a0',
                      fontWeight: user.unreadCount > 0 ? '600' : 'normal',
                      flexShrink: 0
                    }}>
                      {lastMsg ? formatTime(lastMsg.created_at) : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* Last message / Typing state */}
                    <div style={{
                      fontSize: '13px',
                      color: isTyping ? '#00a884' : '#8696a0',
                      fontStyle: isTyping ? 'italic' : 'normal',
                      fontWeight: isTyping ? '600' : 'normal',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isTyping ? (
                        <>
                          <div className="typing-dots">
                            <span /><span /><span />
                          </div>
                          <span>typing...</span>
                        </>
                      ) : lastMsg ? (
                        <>
                          {lastMsg.sender_id === currentUser.id && (
                            <span>
                              {lastMsg.is_read === 1 || lastMsg.is_read === true || lastMsg.status === 'read' ? (
                                <CheckCheck size={15} color="#53bdeb" title="Read" />
                              ) : lastMsg.status === 'delivered' ? (
                                <CheckCheck size={15} color="#8696a0" title="Delivered" />
                              ) : (
                                <Check size={15} color="#8696a0" title="Sent" />
                              )}
                            </span>
                          )}
                          <span>
                            {lastMsg.text || (lastMsg.media_type ? `[${lastMsg.media_type}]` : 'Media attachment')}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#667781' }}>{user.about || 'Start conversation'}</span>
                      )}
                    </div>

                    {/* Unread badge */}
                    {user.unreadCount > 0 && (
                      <div style={{
                        backgroundColor: '#00a884',
                        color: '#111b21',
                        fontSize: '11px',
                        fontWeight: '700',
                        borderRadius: '10px',
                        padding: '2px 6px',
                        minWidth: '18px',
                        textAlign: 'center',
                        flexShrink: 0
                      }}>
                        {user.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
