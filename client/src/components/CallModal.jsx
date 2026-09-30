import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Monitor,
  Volume2,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';

export default function CallModal({
  callState, // 'outgoing_ringing' | 'incoming_ringing' | 'connected' | null
  callType, // 'video' | 'audio'
  remoteUser, // User object we are calling / receiving from
  localStream,
  remoteStream,
  onAcceptCall,
  onRejectCall,
  onEndCall,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  isMicMuted,
  isCameraOff,
  isScreenSharing
}) {
  const [callDuration, setCallDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const timerRef = useRef(null);
  const modalContainerRef = useRef(null);

  // Bind video streams to HTML5 <video> elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((e) => console.log('Remote audio autoplay waiting:', e));
    }
  }, [remoteStream, callState]);

  // Call timer when connected
  useEffect(() => {
    if (callState === 'connected') {
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Web Audio Synthesizer for Ringtone
  useEffect(() => {
    let audioCtx = null;
    let intervalId = null;

    if (callState === 'outgoing_ringing' || callState === 'incoming_ringing') {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          audioCtx = new AudioContext();

          const playTone = () => {
            if (!audioCtx || audioCtx.state === 'closed') return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(callState === 'outgoing_ringing' ? 440 : 520, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(
              callState === 'outgoing_ringing' ? 480 : 580,
              audioCtx.currentTime + 0.3
            );

            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(audioCtx.destination);

            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
          };

          playTone();
          intervalId = setInterval(playTone, 1800);
        }
      } catch (e) {
        console.warn('AudioContext error:', e);
      }
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [callState]);

  if (!callState) return null;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={modalContainerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0c1317',
        zIndex: 100000,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
          zIndex: 20
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src={remoteUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            alt={remoteUser?.display_name || 'User'}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#e9edef' }}>
              {remoteUser?.display_name || 'Contact'}
            </div>
            <div style={{ fontSize: '12px', color: '#00a884', fontWeight: '500' }}>
              {callState === 'outgoing_ringing' && 'Ringing...'}
              {callState === 'incoming_ringing' && `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call...`}
              {callState === 'connected' && `End-to-End Encrypted • ${formatTime(callDuration)}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {callState === 'connected' && callType === 'video' && (
            <button
              onClick={toggleFullscreen}
              className="icon-btn"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Stage (Video / Voice Stage) */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#111b21',
          overflow: 'hidden'
        }}
      >
        {/* A. Remote Video (Connected Video Call) */}
        {callState === 'connected' && callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : null}

        {/* B. Voice Call / Ringing Stage */}
        {(callState !== 'connected' || callType === 'audio') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '20px'
            }}
          >
            {/* Pulsing Avatar */}
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  inset: '-16px',
                  borderRadius: '50%',
                  border: '2px solid rgba(0, 168, 132, 0.4)',
                  animation: 'pulseGreen 2s infinite ease-out'
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: '-32px',
                  borderRadius: '50%',
                  border: '1px solid rgba(0, 168, 132, 0.2)',
                  animation: 'pulseGreen 2s infinite ease-out 0.4s'
                }}
              />
              <img
                src={remoteUser?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={remoteUser?.display_name || 'User'}
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '4px solid #00a884',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                  position: 'relative',
                  zIndex: 2
                }}
              />
            </div>

            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#e9edef', marginBottom: '6px' }}>
                {remoteUser?.display_name || 'Contact'}
              </h2>
              <p style={{ fontSize: '14px', color: '#8696a0' }}>
                {callState === 'outgoing_ringing' && 'Connecting audio & video stream...'}
                {callState === 'incoming_ringing' && 'Tap accept to answer'}
                {callState === 'connected' && 'Voice Call in progress ⚡'}
              </p>
            </div>
          </div>
        )}

        {/* C. Local Video PiP Floating Window */}
        {callState === 'connected' && callType === 'video' && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              width: '180px',
              height: '120px',
              backgroundColor: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0,0,0,0.7)',
              border: '2px solid rgba(255,255,255,0.15)',
              zIndex: 30
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)'
              }}
            />
            {isCameraOff && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#182229',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8696a0',
                  fontSize: '11px'
                }}
              >
                Camera Off
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Bottom Controls Toolbar */}
      <div
        style={{
          padding: '24px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, transparent 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          zIndex: 40
        }}
      >
        {/* Incoming Call Buttons: Accept & Decline */}
        {callState === 'incoming_ringing' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
            <button
              onClick={onRejectCall}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
                transition: 'transform 0.15s ease'
              }}
              title="Decline Call"
            >
              <PhoneOff size={26} />
            </button>

            <button
              onClick={onAcceptCall}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#00a884',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(0, 168, 132, 0.5)',
                transition: 'transform 0.15s ease'
              }}
              title="Accept Call"
            >
              <Phone size={26} />
            </button>
          </div>
        ) : (
          /* Active / Outgoing Call Toolbar */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              backgroundColor: 'rgba(32, 44, 51, 0.85)',
              backdropFilter: 'blur(12px)',
              padding: '10px 24px',
              borderRadius: '40px',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 12px 36px rgba(0,0,0,0.5)'
            }}
          >
            {/* Mute Mic */}
            <button
              onClick={onToggleMic}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: isMicMuted ? '#ef4444' : 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            {/* Video Toggle (for video calls) */}
            {callType === 'video' && (
              <button
                onClick={onToggleCamera}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: isCameraOff ? '#ef4444' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
            )}

            {/* Screen Sharing (Desktop / Browser) */}
            {callType === 'video' && (
              <button
                onClick={onToggleScreenShare}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: isScreenSharing ? '#00a884' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: isScreenSharing ? '#111b21' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <Monitor size={20} />
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={onEndCall}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)'
              }}
              title="End Call"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Persistent Audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
    </div>
  );
}
