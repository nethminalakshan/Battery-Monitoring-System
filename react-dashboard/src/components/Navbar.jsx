import React from 'react';
import { Activity, Radio, Cpu, BarChart3, ListFilter, RefreshCw, Zap, BellRing } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  mqttStatus,
  statusChips,
  onRefreshData,
  isRefreshing,
  alertCount = 0
}) {
  const isMqttConnected = mqttStatus?.connected;

  return (
    <header className="navbar">
      <div className="brand-area">
        <div className="brand-logo-icon">
          <Zap size={22} className="animate-pulse text-cyan-400" />
        </div>
        <div>
          <div className="brand-title">RMS BATTERY INTELLIGENCE</div>
          <div className="brand-subtitle">Telemetry & Health Monitoring Portal</div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={16} />
          <span>Live Monitor</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'charts' ? 'active' : ''}`}
          onClick={() => setActiveTab('charts')}
        >
          <BarChart3 size={16} />
          <span>Analytics & Charts</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <ListFilter size={16} />
          <span>Previous Logs</span>
        </button>

        <button
          className={`nav-tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <BellRing size={16} />
          <span>System Alerts</span>
          {alertCount > 0 && <span className="alert-count">{alertCount}</span>}
        </button>
      </nav>

      <div className="nav-chips">
        {/* MQTT Status */}
        <div
          className={`badge ${isMqttConnected ? 'badge-cyan' : 'badge-warn'}`}
          title={`MQTT Broker: ${mqttStatus?.broker || 'HiveMQ'}`}
        >
          <Radio size={13} />
          <span>{isMqttConnected ? 'HiveMQ MQTT' : 'MQTT Reconnecting'}</span>
          <span className={`pulse-dot ${isMqttConnected ? 'ok' : 'warn'}`} />
        </div>

        {/* NodeMCU CM Module Chip */}
        <div
          className={`badge ${statusChips?.online ? 'badge-ok' : 'badge-warn'}`}
          title="ESP8266 NodeMCU Central Monitor"
        >
          <Cpu size={13} />
          <span>NodeMCU</span>
          <span className={`pulse-dot ${statusChips?.online ? 'ok' : 'warn'}`} />
        </div>

        {/* Refresh button */}
        <button
          className="btn-secondary"
          style={{ padding: '6px 12px' }}
          onClick={onRefreshData}
          title="Refresh Telemetry Data"
          disabled={isRefreshing}
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
        </button>

      </div>
    </header>
  );
}
