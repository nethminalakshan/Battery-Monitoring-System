import React, { useState } from 'react';
import { Terminal, Trash2, Pause, Play } from 'lucide-react';

function LiveLogsConsoleComponent({ logs = [], onClear }) {
  const [isPaused, setIsPaused] = useState(false);
  const [frozenLogs, setFrozenLogs] = useState([]);

  const handleTogglePause = () => {
    if (!isPaused) {
      setFrozenLogs(logs);
      setIsPaused(true);
    } else {
      setIsPaused(false);
    }
  };

  const displayedLogs = isPaused ? frozenLogs : logs;

  return (
    <div className="glass-panel" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Terminal size={16} style={{ color: 'var(--cyan-core)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.04em' }}>
            REAL-TIME MQTT TELEMETRY STREAM
          </span>
          {isPaused && (
            <span className="badge badge-warn" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
              STREAM PAUSED
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className={`btn-secondary ${isPaused ? 'btn-active' : ''}`}
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
            onClick={handleTogglePause}
            title={isPaused ? 'Resume live scrolling' : 'Freeze log viewer'}
          >
            {isPaused ? <Play size={11} /> : <Pause size={11} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            className="btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.72rem' }}
            onClick={onClear}
            title="Clear console entries"
          >
            <Trash2 size={11} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="terminal-window">
        {displayedLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', margin: 'auto' }}>
            Listening on HiveMQ WebSocket broker (wss://broker.hivemq.com:8884/mqtt) topics: rms/# ...
          </div>
        ) : (
          displayedLogs.map((item, i) => (
            <div key={item.id || `${item.time}-${i}`} className={`log-row ${item.type || 'info'}`}>
              <span className="log-ts">[{item.time}]</span>
              <span>{item.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(LiveLogsConsoleComponent);
