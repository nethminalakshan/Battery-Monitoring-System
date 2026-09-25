import React, { useState } from 'react';
import { Database, RefreshCw, X } from 'lucide-react';

export default function MongoConfigModal({
  isOpen,
  onClose,
  dbStatus,
  onUpdateUri,
  isTesting
}) {
  const [inputUri, setInputUri] = useState('');
  const [feedback, setFeedback] = useState(null);

  if (!isOpen) return null;

  const isConnected = dbStatus?.readyState === 1;

  const handleSubmit = async event => {
    event.preventDefault();
    const uri = inputUri.trim();
    if (!uri) return;

    setFeedback(null);
    const result = await onUpdateUri(uri);
    setFeedback(result.success
      ? { type: 'ok', message: 'Successfully connected to MongoDB Atlas.' }
      : { type: 'error', message: result.error || 'Connection failed.' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Database size={20} />
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>MongoDB Atlas Settings</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Enter a connection string for this backend session
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close settings" style={{ background: 'transparent', border: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ margin: '18px 0', color: isConnected ? '#34d399' : '#fb7185', fontSize: '0.8rem' }}>
          {isConnected ? `Connected: ${dbStatus.uriMasked}` : (dbStatus?.error || 'Disconnected')}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label htmlFor="mongo-uri" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            MongoDB connection string
          </label>
          <input
            id="mongo-uri"
            type="password"
            autoComplete="off"
            value={inputUri}
            onChange={event => setInputUri(event.target.value)}
            placeholder="mongodb+srv://username:password@cluster.mongodb.net/battery_monitoring"
            className="text-input font-mono"
            style={{ width: '100%', fontSize: '0.8rem', padding: '10px 14px' }}
          />
          <button type="submit" disabled={isTesting || !inputUri.trim()} className="btn-primary" style={{ justifyContent: 'center' }}>
            <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
            {isTesting ? 'Testing connection...' : 'Connect to MongoDB'}
          </button>
        </form>

        {feedback && (
          <div style={{ marginTop: 14, color: feedback.type === 'ok' ? '#34d399' : '#fb7185', fontSize: '0.8rem' }}>
            {feedback.message}
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          The URI is sent to the backend and is not stored in browser local storage.
        </p>
      </div>
    </div>
  );
}
