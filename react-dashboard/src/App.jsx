import React, { useState, useEffect, useRef, useCallback } from 'react';
import mqtt from 'mqtt';
import Navbar from './components/Navbar';
import BatteryCard from './components/BatteryCard';
import SystemOverview from './components/SystemOverview';
import AnalyticsCharts from './components/AnalyticsCharts';
import PreviousLogsPortal from './components/PreviousLogsPortal';
import LiveLogsConsole from './components/LiveLogsConsole';
import { Zap, ShieldAlert, Sparkles, Database, RefreshCw } from 'lucide-react';
import './App.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const BROKER_WS = 'wss://broker.hivemq.com:8884/mqtt';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'charts' | 'logs'

  // Live Telemetry State
  const [bat1, setBat1] = useState({ volt: 12.6, temp: 28.4, ir: 18.2 });
  const [bat2, setBat2] = useState({ volt: 12.5, temp: 29.1, ir: 19.4 });
  const [systemCurrent, setSystemCurrent] = useState(3.42);
  const [ambientTemp, setAmbientTemp] = useState(27.5);
  const [statusChips, setStatusChips] = useState({ online: true, ta1: true, ta2: true, tc_error: false });

  // System & Connection State
  const [dbStatus, setDbStatus] = useState({ readyState: 0, state: 'disconnected', uriMasked: '' });
  const [mqttStatus, setMqttStatus] = useState({ connected: false, broker: BROKER_WS });
  const [liveLogs, setLiveLogs] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Analytics & History
  const [timeframe, setTimeframe] = useState('24h');
  const [historicalData, setHistoricalData] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);

  // Previous Logs Portal
  const [portalLogs, setPortalLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [logFilters, setLogFilters] = useState({ batteryId: '', level: '' });
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Actions
  const [isSeeding, setIsSeeding] = useState(false);

  const mqttClientRef = useRef(null);

  // Add a line to live console
  const addLiveLog = useCallback((msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    setLiveLogs(prev => [{ time, msg, type }, ...prev.slice(0, 50)]);
  }, []);

  // -------------------------------------------------------------
  // 1. Fetch Backend Data (Health, Stats, Logs)
  // -------------------------------------------------------------
  const fetchHealthAndStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data.database || {});
        if (data.telemetry?.status) setStatusChips(data.telemetry.status);
      }
    } catch {
      // Backend might be offline or starting up
    }
  };

  const fetchHistoricalAnalytics = async (tf = timeframe) => {
    try {
      const res = await fetch(`${API_BASE}/stats/history?timeframe=${tf}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setHistoricalData(json.data);
        } else {
          // Generate realistic placeholder points if MongoDB is empty yet
          setHistoricalData(generateDefaultHistory());
        }
      } else {
        setHistoricalData(generateDefaultHistory());
      }
    } catch {
      setHistoricalData(generateDefaultHistory());
    }
  };

  const fetchPortalLogs = async (page = currentPage, filters = logFilters) => {
    setIsLogsLoading(true);
    try {
      const query = new URLSearchParams({
        page,
        limit: 25,
        ...(filters.batteryId ? { batteryId: filters.batteryId } : {}),
        ...(filters.level ? { level: filters.level } : {})
      });

      const res = await fetch(`${API_BASE}/logs?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPortalLogs(json.logs || []);
        setTotalLogs(json.total || 0);
        setCurrentPage(json.page || 1);
        setTotalPages(json.pages || 1);
      }
    } catch {
      // If server unreachable
    } finally {
      setIsLogsLoading(false);
    }
  };

  const refreshAll = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchHealthAndStatus(),
      fetchHistoricalAnalytics(timeframe),
      fetchPortalLogs(currentPage, logFilters)
    ]);
    setIsRefreshing(false);
  };

  // Generate sensible synthetic points for charts when DB is initialising
  const generateDefaultHistory = () => {
    const points = [];
    const now = Date.now();
    for (let i = 30; i >= 0; i--) {
      const t = new Date(now - i * 60000);
      const wave = Math.sin(i / 5);
      points.push({
        timestamp: t.toISOString(),
        bat1Volt: +(12.4 + wave * 0.4 + (Math.random() - 0.5) * 0.05).toFixed(2),
        bat2Volt: +(12.3 + wave * 0.38 + (Math.random() - 0.5) * 0.05).toFixed(2),
        bat1Temp: +(28.0 + (1 - wave) * 3).toFixed(1),
        bat2Temp: +(28.5 + (1 - wave) * 3.2).toFixed(1),
        bat1Ir: +(18.2 + (30 - i) * 0.01).toFixed(1),
        bat2Ir: +(19.4 + (30 - i) * 0.012).toFixed(1),
        current: +(3.2 + wave * 2.5).toFixed(3),
        ambientTemp: 27.2
      });
    }
    return points;
  };

  // -------------------------------------------------------------
  // 2. Direct MQTT WebSocket Connection (HiveMQ)
  // -------------------------------------------------------------
  useEffect(() => {
    addLiveLog('Initiating connection to HiveMQ MQTT Broker...', 'info');

    const client = mqtt.connect(BROKER_WS, {
      clientId: 'rms-react-ui-' + Math.random().toString(16).slice(2, 8),
      clean: true,
      reconnectPeriod: 3000
    });

    mqttClientRef.current = client;

    client.on('connect', () => {
      setMqttStatus({ connected: true, broker: BROKER_WS });
      addLiveLog('Connected to HiveMQ MQTT broker! Subscribed to rms/#', 'ok');

      const topics = [
        'rms/battery/1/voltage', 'rms/battery/1/temperature', 'rms/battery/1/ir',
        'rms/battery/2/voltage', 'rms/battery/2/temperature', 'rms/battery/2/ir',
        'rms/system/current', 'rms/system/temperature',
        'rms/status'
      ];
      topics.forEach(t => client.subscribe(t));
    });

    client.on('reconnect', () => {
      setMqttStatus({ connected: false, broker: BROKER_WS });
      addLiveLog('Reconnecting to MQTT broker...', 'warn');
    });

    client.on('error', err => {
      setMqttStatus({ connected: false, broker: BROKER_WS });
      addLiveLog(`MQTT Error: ${err.message}`, 'err');
    });

    client.on('message', (topic, payload) => {
      const valStr = payload.toString().trim();
      const num = parseFloat(valStr);

      switch (topic) {
        case 'rms/battery/1/voltage':
          if (!isNaN(num)) {
            setBat1(prev => ({ ...prev, volt: num }));
            addLiveLog(`[Bat1 Volt] ${num.toFixed(2)} V`, 'info');
          }
          break;
        case 'rms/battery/1/temperature':
          if (!isNaN(num)) setBat1(prev => ({ ...prev, temp: num }));
          break;
        case 'rms/battery/1/ir':
          if (!isNaN(num)) setBat1(prev => ({ ...prev, ir: num }));
          break;

        case 'rms/battery/2/voltage':
          if (!isNaN(num)) {
            setBat2(prev => ({ ...prev, volt: num }));
            addLiveLog(`[Bat2 Volt] ${num.toFixed(2)} V`, 'info');
          }
          break;
        case 'rms/battery/2/temperature':
          if (!isNaN(num)) setBat2(prev => ({ ...prev, temp: num }));
          break;
        case 'rms/battery/2/ir':
          if (!isNaN(num)) setBat2(prev => ({ ...prev, ir: num }));
          break;

        case 'rms/system/current':
          if (!isNaN(num)) setSystemCurrent(num);
          break;
        case 'rms/system/temperature':
          if (!isNaN(num)) setAmbientTemp(num);
          break;

        case 'rms/status':
          try {
            const s = JSON.parse(valStr);
            setStatusChips(s);
            if (s.tc_error) addLiveLog('Alert: TC Module not responding!', 'err');
          } catch {
            // Ignore parse errors
          }
          break;
      }
    });

    return () => {
      if (client) client.end();
    };
  }, [addLiveLog]);

  // Periodic polling for DB and historical data
  useEffect(() => {
    refreshAll();
    const interval = setInterval(() => {
      fetchHealthAndStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // When filters or page change, update logs portal
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchPortalLogs(currentPage, logFilters);
    }
  }, [activeTab, currentPage, logFilters]);

  // When timeframe changes, update charts
  const handleTimeframeChange = (newTf) => {
    setTimeframe(newTf);
    fetchHistoricalAnalytics(newTf);
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/logs/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 120 })
      });
      const data = await res.json();
      if (res.ok) {
        addLiveLog(data.message, 'ok');
        await refreshAll();
      } else {
        alert(data.error || 'Failed to seed');
      }
    } catch (err) {
      alert('Seeding error: ' + err.message);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbStatus={dbStatus}
        mqttStatus={mqttStatus}
        statusChips={statusChips}
        onRefreshData={refreshAll}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Status Quick Bar */}
        <div className="status-ribbon">
          <div className="status-chip-card">
            <span className="chip-label">ESP8266 CM</span>
            <span className="chip-value">
              <span className={`pulse-dot ${statusChips?.online ? 'ok' : 'warn'}`} />
              <span>{statusChips?.online ? 'ONLINE' : 'OFFLINE'}</span>
            </span>
          </div>

          <div className="status-chip-card">
            <span className="chip-label">Sensor TA1 (Bat 1)</span>
            <span className="chip-value">
              <span className={`pulse-dot ${statusChips?.ta1 ? 'ok' : 'warn'}`} />
              <span>{statusChips?.ta1 ? 'STREAMING' : 'IDLE'}</span>
            </span>
          </div>

          <div className="status-chip-card">
            <span className="chip-label">Sensor TA2 (Bat 2)</span>
            <span className="chip-value">
              <span className={`pulse-dot ${statusChips?.ta2 ? 'ok' : 'warn'}`} />
              <span>{statusChips?.ta2 ? 'STREAMING' : 'IDLE'}</span>
            </span>
          </div>

          <div className="status-chip-card">
            <span className="chip-label">Total Logged (DB)</span>
            <span className="chip-value" style={{ color: 'var(--cyan-core)' }}>
              {totalLogs > 0 ? totalLogs.toLocaleString() : 'Ready'}
            </span>
          </div>
        </div>

        {/* Tab 1: Live Monitor */}
        {activeTab === 'overview' && (
          <>
            {/* Battery Cards Grid */}
            <div className="battery-grid">
              <BatteryCard batteryId={1} data={bat1} activeChip={statusChips?.ta1} />
              <BatteryCard batteryId={2} data={bat2} activeChip={statusChips?.ta2} />
            </div>

            {/* System Centerpiece: Current Arc & Ambient Thermometer */}
            <SystemOverview
              current={systemCurrent}
              ambientTemp={ambientTemp}
              statusChips={statusChips}
            />

            {/* Live MQTT Packet Stream */}
            <LiveLogsConsole logs={liveLogs} onClear={() => setLiveLogs([])} />
          </>
        )}

        {/* Tab 2: Analytics & Graphs */}
        {activeTab === 'charts' && (
          <AnalyticsCharts
            historicalData={historicalData}
            timeframe={timeframe}
            onTimeframeChange={handleTimeframeChange}
          />
        )}

        {/* Tab 3: Previous Logs Portal */}
        {activeTab === 'logs' && (
          <PreviousLogsPortal
            logs={portalLogs}
            totalLogs={totalLogs}
            page={currentPage}
            pages={totalPages}
            isLoading={isLogsLoading}
            isDbConnected={dbStatus?.readyState === 1}
            onPageChange={p => setCurrentPage(p)}
            filters={logFilters}
            onFilterChange={f => { setLogFilters(f); setCurrentPage(1); }}
            onSeedDemoData={handleSeedData}
            isSeeding={isSeeding}
          />
        )}
      </main>

    </div>
  );
}
