import React from 'react';
import { Activity, Database, Radio, Cpu, BarChart3, ListFilter, Settings, RefreshCw, Zap } from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  dbStatus,
  mqttStatus,
  statusChips,
  onOpenMongoModal,
  onRefreshData,
  isRefreshing
}) {
  const isMongoConnected = dbStatus?.readyState === 1;
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
      </nav>

      <div className="nav-chips">
        {/* MongoDB Atlas Status */}
        <button
          onClick={onOpenMongoModal}
          className={`badge cursor-pointer transition-all ${
            isMongoConnected ? 'badge-ok' : 'badge-alert'
          }`}
          title="Configure MongoDB connection"
        >
          <Database size={13} />
          <span>{isMongoConnected ? 'MongoDB Atlas' : 'DB Disconnected'}</span>
          <span className={`pulse-dot ${isMongoConnected ? 'ok' : 'err'}`} />
        </button>

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

        <button
          className="btn-secondary"
          style={{ padding: '6px 12px' }}
          onClick={onOpenMongoModal}
          title="Database & Connection Settings"
        >
          <Settings size={14} />
        </button>

      </div>
    </header>
  );
}
