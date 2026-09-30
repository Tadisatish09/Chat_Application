import React, { useState } from 'react';
import { MessageSquare, ShieldCheck, User, Mail, Lock, Sparkles, ArrowRight, UserCheck } from 'lucide-react';

export default function AuthScreen({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    avatar: '',
    about: 'Hey there! I am using WhatsApp.'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Demo pre-seeded accounts for 1-click test pairing
  const demoAccounts = [
    {
      name: 'Alex Turner',
      username: 'alex_turner',
      role: 'Product Designer',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      password: 'password123'
    },
    {
      name: 'Sarah Connor',
      username: 'sarah_connor',
      role: 'Tech Lead',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      password: 'password123'
    },
    {
      name: 'Michael Scott',
      username: 'michael_scott',
      role: 'Regional Manager',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      password: 'password123'
    },
    {
      name: 'Emma Watson',
      username: 'emma_watson',
      role: 'Developer',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
      password: 'password123'
    }
  ];

  const handleQuickDemoLogin = async (acc) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: acc.username, password: acc.password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to login');
      
      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? {
            username: formData.username.trim().toLowerCase(),
            display_name: formData.display_name.trim() || formData.username,
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            avatar: formData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(formData.username)}`,
            about: formData.about
          }
        : {
            login: formData.username.trim(),
            password: formData.password
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication error');

      localStorage.setItem('chat_token', data.token);
      localStorage.setItem('chat_user', JSON.stringify(data.user));
      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #0c1317 0%, #111b21 50%, #0a1014 100%)',
      padding: '20px',
      position: 'relative'
    }}>
      {/* WhatsApp Header Strip */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '130px',
        backgroundColor: '#00a884',
        zIndex: 0
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: '920px',
        backgroundColor: '#111b21',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        overflow: 'hidden'
      }}>
        {/* Left Column: Fast 1-Click Demo Accounts to test bidirectional chats */}
        <div style={{
          backgroundColor: '#202c33',
          padding: '36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRight: '1px solid rgba(255,255,255,0.06)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                backgroundColor: '#00a884',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(0, 168, 132, 0.4)'
              }}>
                <MessageSquare size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#e9edef', margin: 0 }}>WhatsApp Web</h1>
                <p style={{ fontSize: '13px', color: '#00a884', margin: 0, fontWeight: '500' }}>Socket.IO Real-time Engine</p>
              </div>
            </div>

            <div style={{
              background: 'rgba(0, 168, 132, 0.1)',
              border: '1px solid rgba(0, 168, 132, 0.3)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '24px'
            }}>
              <p style={{ fontSize: '12px', color: '#e9edef', margin: 0, lineHeight: 1.5 }}>
                ⚡ <strong>Bidirectional Sockets Ready:</strong> Open two browser tabs or windows, login with different demo accounts below, and experience live typing, quotes, and instant forwards!
              </p>
            </div>

            <h3 style={{ fontSize: '14px', color: '#8696a0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              Quick Demo Login (Database: chat)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {demoAccounts.map((acc) => (
                <div
                  key={acc.username}
                  onClick={() => !loading && handleQuickDemoLogin(acc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: '#111b21',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00a884'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={acc.avatar}
                      alt={acc.name}
                      style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#e9edef' }}>{acc.name}</div>
                      <div style={{ fontSize: '12px', color: '#8696a0' }}>@{acc.username} • {acc.role}</div>
                    </div>
                  </div>
                  <button
                    disabled={loading}
                    style={{
                      background: 'rgba(0, 168, 132, 0.15)',
                      border: '1px solid #00a884',
                      color: '#00a884',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Enter <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8696a0', fontSize: '12px', marginTop: '20px' }}>
            <ShieldCheck size={16} color="#00a884" />
            <span>End-to-End WebSocket state synced with database <strong>chat</strong></span>
          </div>
        </div>

        {/* Right Column: Custom Registration / Login */}
        <div style={{ padding: '36px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#e9edef', marginBottom: '6px' }}>
              {isRegister ? 'Register New User' : 'Sign in to your Account'}
            </h2>
            <p style={{ fontSize: '13px', color: '#8696a0' }}>
              {isRegister
                ? 'Create a new profile on the chat database'
                : 'Enter your credentials to connect with peers'}
            </p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8696a0', marginBottom: '6px', fontWeight: '500' }}>
                  Full Display Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8696a0' }} />
                  <input
                    type="text"
                    required={isRegister}
                    placeholder="e.g. John Doe"
                    value={formData.display_name}
                    onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: '#202c33',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#e9edef',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8696a0', marginBottom: '6px', fontWeight: '500' }}>
                Username {isRegister ? '' : 'or Email'}
              </label>
              <div style={{ position: 'relative' }}>
                <UserCheck size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8696a0' }} />
                <input
                  type="text"
                  required
                  placeholder={isRegister ? 'unique_username' : 'alex_turner'}
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    backgroundColor: '#202c33',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#e9edef',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {isRegister && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8696a0', marginBottom: '6px', fontWeight: '500' }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8696a0' }} />
                  <input
                    type="email"
                    required={isRegister}
                    placeholder="user@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px 10px 38px',
                      backgroundColor: '#202c33',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#e9edef',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#8696a0', marginBottom: '6px', fontWeight: '500' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#8696a0' }} />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    backgroundColor: '#202c33',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#e9edef',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '10px',
                backgroundColor: '#00a884',
                color: '#111b21',
                border: 'none',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(0, 168, 132, 0.3)',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#06cf9c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#00a884'}
            >
              {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '18px' }}>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#00a884',
                fontSize: '13px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
