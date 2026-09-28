import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine
} from 'recharts';
import { BarChart3, Activity, Thermometer, ShieldAlert, Cpu } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'rgba(11, 17, 32, 0.95)',
          border: '1px solid rgba(6, 182, 212, 0.4)',
          borderRadius: 8,
          padding: '10px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(10px)',
          fontSize: '0.78rem'
        }}
      >
        <div style={{ color: '#94a3b8', marginBottom: 6, fontFamily: 'monospace' }}>
          {label}
        </div>
        {payload.map((item, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '3px 0' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: item.color
              }}
            />
            <span style={{ color: '#cbd5e1' }}>{item.name}:</span>
            <span style={{ fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
              {typeof item.value === 'number' ? item.value.toFixed(2) : item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts({
  historicalData = [],
  timeframe = '24h',
  onTimeframeChange
}) {
  const [activeChartTab, setActiveChartTab] = useState('voltage');

  // Format data for chart display
  const chartData = historicalData.map(d => {
    let formattedTime = d.timestamp;
    try {
      const dt = new Date(d.timestamp);
      formattedTime = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      // keep original
    }
    const cleanBat1Temp = d.bat1Temp > -50 && d.bat1Temp < 150 ? d.bat1Temp : null;
    const cleanBat2Temp = d.bat2Temp > -50 && d.bat2Temp < 150 ? d.bat2Temp : null;
    return {
      ...d,
      bat1Temp: cleanBat1Temp,
      bat2Temp: cleanBat2Temp,
      displayTime: formattedTime
    };
  });

  return (
    <div className="charts-section">
      <div className="charts-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(6, 182, 212, 0.1)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-core)'
            }}
          >
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>
              TELEMETRY & ANALYTICS VISUALIZER
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Interactive multi-variable wave graphs streamed from MongoDB Atlas & HiveMQ
            </p>
          </div>
        </div>

        {/* Timeframe Selector Pills */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(15, 23, 42, 0.8)', padding: 4, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          {['1h', '6h', '24h', '7d', '30d', 'all'].map(tf => (
            <button
              key={tf}
              onClick={() => onTimeframeChange && onTimeframeChange(tf)}
              style={{
                background: timeframe === tf ? 'linear-gradient(135deg, #06b6d4, #2563eb)' : 'transparent',
                color: timeframe === tf ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textTransform: 'uppercase'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of 4 Interactive Charts */}
      <div className="charts-grid">
        {/* 1. Terminal Voltage Comparison */}
        <div className="glass-panel chart-card">
          <div className="chart-title-area">
            <div className="chart-title">
              <Activity size={16} style={{ color: 'var(--cyan-core)' }} />
              <span>Cell Voltages Comparison (V)</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem' }}>
              <span style={{ color: '#06b6d4', fontWeight: 600 }}>● Bat 1</span>
              <span style={{ color: '#a855f7', fontWeight: 600 }}>● Bat 2</span>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="volt1Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="volt2Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="displayTime" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis domain={[9.5, 15]} stroke="#475569" tick={{ fontSize: 10 }} unit="V" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={10.5} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '10.5V Min', fill: '#f43f5e', fontSize: 9 }} />
                <ReferenceLine y={14.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '14.0V Warn', fill: '#f59e0b', fontSize: 9 }} />
                <Area type="monotone" dataKey="bat1Volt" name="Battery 1" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#volt1Grad)" />
                <Area type="monotone" dataKey="bat2Volt" name="Battery 2" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#volt2Grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. System Current Flow */}
        <div className="glass-panel chart-card">
          <div className="chart-title-area">
            <div className="chart-title">
              <Activity size={16} style={{ color: '#38bdf8' }} />
              <span>Current Flow Waveform (A)</span>
            </div>
            <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
              Load Current
            </span>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="currentChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="displayTime" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} unit="A" />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="current" name="System Current" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#currentChartGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Thermal Dynamics Trends */}
        <div className="glass-panel chart-card">
          <div className="chart-title-area">
            <div className="chart-title">
              <Thermometer size={16} style={{ color: 'var(--amber-core)' }} />
              <span>Thermal Trends (°C)</span>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.7rem' }}>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>● Bat 1</span>
              <span style={{ color: '#ec4899', fontWeight: 600 }}>● Bat 2</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>● Ambient</span>
            </div>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="displayTime" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} unit="°C" />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={45} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: '45°C Max Limit', fill: '#f43f5e', fontSize: 9 }} />
                <Line type="monotone" dataKey="bat1Temp" name="Bat 1 Temp" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bat2Temp" name="Bat 2 Temp" stroke="#ec4899" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ambientTemp" name="Ambient Temp" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Internal Resistance (Battery Health) */}
        <div className="glass-panel chart-card">
          <div className="chart-title-area">
            <div className="chart-title">
              <Cpu size={16} style={{ color: '#8b5cf6' }} />
              <span>Internal Resistance & Health (mΩ)</span>
            </div>
            <span className="badge badge-ok" style={{ fontSize: '0.68rem' }}>
              Cell Degradation Metric
            </span>
          </div>

          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="displayTime" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} unit="mΩ" />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="bat1Ir" name="Bat 1 IR" stroke="#06b6d4" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="bat2Ir" name="Bat 2 IR" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
