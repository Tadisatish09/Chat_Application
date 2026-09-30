import React from 'react';
import { X, Download } from 'lucide-react';
import { downloadMediaFile } from '../utils/download';

export default function MediaViewerModal({ mediaUrl, onClose }) {
  if (!mediaUrl) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        gap: '12px',
        zIndex: 10
      }}>
        <button
          onClick={() => downloadMediaFile(mediaUrl, 'media.jpg')}
          className="icon-btn"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', cursor: 'pointer' }}
          title="Download"
        >
          <Download size={20} />
        </button>
        <button
          onClick={onClose}
          className="icon-btn"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      <img
        src={mediaUrl}
        alt="Enlarged media"
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
        }}
      />
    </div>
  );
}
