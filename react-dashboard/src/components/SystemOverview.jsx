import React from 'react';
import { Gauge, Thermometer, Zap, AlertCircle, Cpu, Wifi } from 'lucide-react';

export default function SystemOverview({
  current = 0,
  ambientTemp = 0,
  statusChips = {}
}) {
  const maxCurrent = 30;
  const currentFraction = Math.min(Math.max(current / maxCurrent, 0), 1);
  const strokeDashoffset = 251.2 - currentFraction * 251.2;

  // Determine Current State: Discharging or Charging or Idle
  let currentMode = 'Idle';
  if (current > 0.3) currentMode = 'Load Discharging';
  else if (current < -0.3) currentMode = 'Charging Input';

  // Ambient temp percentage (0 to 60 deg C)
  const tempPct = Math.min(Math.max((ambientTemp - 0) / 60, 0), 1) * 100;

  return (
    <div className="overview-grid">
      {/* Current Arc Gauge Panel */}
      <div className="glass-panel gauge-panel">
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} style={{ color: 'var(--cyan-core)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
              SYSTEM CURRENT FLOW
            </span>
          </div>
          <span className="badge badge-cyan">
            {currentMode}
          </span>
        </div>

        <div className="gauge-container">
          <svg viewBox="0 0 200 115" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="currentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" />
                <stop offset="60%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <filter id="gaugeGlow">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background Track Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="14"
              strokeLinecap="round"
            />

            {/* Animated Dynamic Value Arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="url(#currentGrad)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="251.2"
              strokeDashoffset={strokeDashoffset}
              filter="url(#gaugeGlow)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />

            {/* Scale Labels */}
            <text x="20" y="115" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">0A</text>
            <text x="60" y="42" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">10A</text>
            <text x="140" y="42" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">20A</text>
            <text x="180" y="115" fill="#64748b" fontSize="8" textAnchor="middle" fontFamily="monospace">30A</text>
          </svg>

          <div className="gauge-readout">
            <div className="gauge-amps">{current > 0 ? current.toFixed(3) : '0.000'}</div>
            <div className="gauge-unit">Total Amperes</div>
          </div>
        </div>
      </div>

      {/* Ambient Thermometer & Subsystem Health Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Thermometer size={18} style={{ color: 'var(--amber-core)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>AMBIENT THERMALS</span>
            </div>
            <span className="badge badge-warn font-mono">
              {ambientTemp > 0 ? ambientTemp.toFixed(1) : '0.0'} °C
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Chamber Temp</span>
              <span>Nominal &lt; 40°C</span>
            </div>
            <div style={{ height: 12, background: 'rgba(15, 23, 42, 0.9)', borderRadius: 6, overflow: 'hidden', padding: 2, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${tempPct}%`,
                  borderRadius: 4,
                  background: 'linear-gradient(90deg, #3b82f6 0%, #f59e0b 60%, #f43f5e 100%)',
                  boxShadow: '0 0 10px rgba(245, 158, 11, 0.4)',
                  transition: 'width 0.5s ease'
                }}
              />
            </div>
          </div>
        </div>

        {/* Subsystem Health Matrix */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
            Subsystem Status Matrix
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="status-chip-card">
              <span className="chip-label">TC Module</span>
              <span className="chip-value">
                <span className={`pulse-dot ${statusChips?.tc_error ? 'err' : 'ok'}`} />
                <span>{statusChips?.tc_error ? 'FAULT' : 'READY'}</span>
              </span>
            </div>

            <div className="status-chip-card">
              <span className="chip-label">RS-485 BUS</span>
              <span className="chip-value">
                <span className="pulse-dot ok" />
                <span>ACTIVE</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
