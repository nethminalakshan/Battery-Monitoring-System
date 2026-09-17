import React, { useState } from 'react';
import { Database, CheckCircle2, AlertCircle, RefreshCw, X, Shield, ExternalLink, Sparkles, Trash2 } from 'lucide-react';

export default function MongoConfigModal({
  isOpen,
  onClose,
  dbStatus,
  onUpdateUri,
  onSeedData,
  onClearData,
  isTesting,
  isSeeding
}) {
  const [inputUri, setInputUri] = useState('');
  const [feedback, setFeedback] = useState(null);

  if (!isOpen) return null;

  const isConnected = dbStatus?.readyState === 1;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputUri.trim()) return;
    setFeedback(null);
    const result = await onUpdateUri(inputUri.trim());
    if (result.success) {
      setFeedback({ type: 'ok', msg: 'Successfully connected to MongoDB Atlas!' });
    } else {
      setFeedback({ type: 'err', msg: result.error || 'Connection failed. Please check credentials and cluster network IP access.' });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--emerald-core)'
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#f8fafc' }}>MongoDB Atlas Cloud Settings</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Configure persistent cloud storage for battery telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Current Status Box */}
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Connection State
            </span>
            <div className={`badge ${isConnected ? 'badge-ok' : 'badge-alert'}`}>
              <span className={`pulse-dot ${isConnected ? 'ok' : 'err'}`} />
              <span>{isConnected ? 'Connected & Active' : 'Disconnected'}</span>
            </div>
          </div>

          {dbStatus?.uriMasked && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              Cluster: {dbStatus.uriMasked}
            </div>
          )}

          {dbStatus?.error && !isConnected && (
            <div style={{ fontSize: '0.75rem', color: 'var(--rose-core)', marginTop: 4 }}>
              Notice: {dbStatus.error}
            </div>
          )}
        </div>

        {/* Enter URI Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Connect to MongoDB Atlas URI:
          </label>
          <input
            type="text"
            placeholder="mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/battery_monitoring"
            value={inputUri}
            onChange={e => setInputUri(e.target.value)}
            className="text-input font-mono"
            style={{ width: '100%', fontSize: '0.8rem', padding: '10px 14px' }}
          />

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit"
              disabled={isTesting || !inputUri.trim()}
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
              <span>{isTesting ? 'Testing Connection...' : 'Connect to MongoDB Atlas'}</span>
            </button>
          </div>
        </form>

        {feedback && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              background: feedback.type === 'ok' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: feedback.type === 'ok' ? '#34d399' : '#fb7185',
              border: `1px solid ${feedback.type === 'ok' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
            }}
          >
            {feedback.msg}
          </div>
        )}

        {/* Setup Guide */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            How to get your MongoDB Atlas URI:
          </div>
          <ol style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingLeft: 18, lineHeight: 1.6 }}>
            <li>Go to <b style={{ color: '#f8fafc' }}>MongoDB Atlas</b> website and log into your dashboard.</li>
            <li>Click on <b style={{ color: '#f8fafc' }}>Database</b> &rarr; click <b style={{ color: '#f8fafc' }}>Connect</b> on your Cluster.</li>
            <li>Select <b style={{ color: '#f8fafc' }}>Drivers</b> (Node.js) &rarr; Copy the connection string.</li>
            <li>Replace <code style={{ color: '#38bdf8' }}>&lt;password&gt;</code> with your database user password and paste it above!</li>
            <li>Ensure Network Access in Atlas has <code style={{ color: '#38bdf8' }}>0.0.0.0/0</code> (Allow Access from Anywhere).</li>
          </ol>
        </div>

        {/* Database Utilities */}
        {isConnected && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onSeedData}
              disabled={isSeeding}
              className="btn-secondary"
              style={{ fontSize: '0.78rem' }}
            >
              <Sparkles size={13} style={{ color: '#fbbf24' }} />
              <span>{isSeeding ? 'Seeding...' : 'Seed 120 Sample Logs'}</span>
            </button>

            <button
              type="button"
              onClick={onClearData}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', color: 'var(--rose-core)' }}
            >
              <Trash2 size={13} />
              <span>Clear Test Logs</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
