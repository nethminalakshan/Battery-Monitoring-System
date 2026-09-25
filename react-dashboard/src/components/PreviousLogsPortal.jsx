import React, { useState } from 'react';
import {
  ListFilter,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

export default function PreviousLogsPortal({
  logs = [],
  totalLogs = 0,
  page = 1,
  pages = 1,
  isLoading = false,
  isDbConnected = false,
  onPageChange,
  filters,
  onFilterChange,
  onSeedDemoData,
  isSeeding
}) {
  const [searchTerm, setSearchTerm] = useState('');

  // Handle Export to CSV
  const handleExportCSV = () => {
    if (!logs || logs.length === 0) return;

    const headers = ['Timestamp', 'Battery ID', 'Voltage (V)', 'Temperature (°C)', 'Internal Resistance (mΩ)', 'Current (A)', 'Ambient Temp (°C)', 'Status', 'Level', 'Source'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toISOString(),
      l.batteryId,
      l.voltage,
      l.temperature,
      l.internalResistance,
      l.systemCurrent || 0,
      l.ambientTemperature || 0,
      `"${l.status || 'Normal'}"`,
      l.level || 'info',
      l.source || 'hardware'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `rms_battery_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter logs locally by search term
  const filteredLogs = logs.filter(l => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (l.status && l.status.toLowerCase().includes(term)) ||
      (l.level && l.level.toLowerCase().includes(term)) ||
      (l.batteryId && String(l.batteryId).includes(term)) ||
      (l.voltage && String(l.voltage).includes(term))
    );
  });

  return (
    <div className="logs-portal">
      {/* DB Connection Alert Notice if disconnected */}
      {!isDbConnected && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 20px',
            borderColor: 'rgba(244, 63, 94, 0.4)',
            background: 'rgba(244, 63, 94, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={20} style={{ color: 'var(--rose-core)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fecdd3' }}>
                MongoDB Atlas Not Connected
              </div>
              <div style={{ fontSize: '0.78rem', color: '#fda4af' }}>
                Connect your MongoDB Atlas cloud URI to persist and query unlimited historical battery logs. Currently displaying recent in-memory records.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & Filter Bar */}
      <div className="glass-panel logs-toolbar">
        <div className="filter-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
            <ListFilter size={18} style={{ color: 'var(--cyan-core)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>PREVIOUS LOGS ARCHIVE</span>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: 200 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search status, level..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="text-input"
              style={{ paddingLeft: 30, width: '100%' }}
            />
          </div>

          {/* Battery Filter */}
          <select
            value={filters.batteryId || ''}
            onChange={e => onFilterChange({ ...filters, batteryId: e.target.value })}
            className="select-input"
          >
            <option value="">All Battery Cells</option>
            <option value="1">Cell #1 Only</option>
            <option value="2">Cell #2 Only</option>
          </select>

          {/* Alert Level Filter */}
          <select
            value={filters.level || ''}
            onChange={e => onFilterChange({ ...filters, level: e.target.value })}
            className="select-input"
          >
            <option value="">All Alert Levels</option>
            <option value="info">Normal / Info</option>
            <option value="warn">Warnings Only</option>
            <option value="critical">Critical Faults</option>
          </select>
        </div>

        {/* Action Buttons: Seed Data & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDbConnected && (
            <button
              onClick={onSeedDemoData}
              disabled={isSeeding}
              className="btn-secondary"
              title="Populate 120 realistic historical battery logs into MongoDB Atlas for instant testing"
            >
              <Sparkles size={14} style={{ color: '#fbbf24' }} />
              <span>{isSeeding ? 'Seeding Atlas...' : 'Seed Sample Logs'}</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="btn-primary"
            title="Download logs as CSV"
          >
            <FileSpreadsheet size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Historical Logs Table */}
      <div className="table-responsive">
        <table className="telemetry-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Cell</th>
              <th>Voltage</th>
              <th>Temperature</th>
              <th>Internal Resist.</th>
              <th>System Current</th>
              <th>Status Diagnostic</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ display: 'inline', marginRight: 8 }} />
                  Streaming historical records from MongoDB Atlas...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Database size={32} style={{ color: '#475569' }} />
                    <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>No telemetry records match your filter criteria</span>
                    <span style={{ fontSize: '0.8rem' }}>
                      {isDbConnected
                        ? 'Click "Seed Sample Logs" above to populate realistic data to your MongoDB database.'
                        : 'Check the MongoDB URI in server/.env and restart the backend to persist sensor logs.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, index) => {
                const date = new Date(log.timestamp);
                const timeStr = date.toLocaleString('en-GB', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                const isWarn = log.level === 'warn';
                const isCrit = log.level === 'critical';

                return (
                  <tr key={log._id || index}>
                    <td className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {timeStr}
                    </td>
                    <td>
                      <span
                        className="badge font-mono"
                        style={{
                          background: log.batteryId === 1 ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                          color: log.batteryId === 1 ? '#38bdf8' : '#c084fc',
                          borderColor: log.batteryId === 1 ? 'rgba(6, 182, 212, 0.3)' : 'rgba(139, 92, 246, 0.3)'
                        }}
                      >
                        CELL #{log.batteryId}
                      </span>
                    </td>
                    <td>
                      <span
                        className="font-mono"
                        style={{
                          fontWeight: 700,
                          color: isCrit ? 'var(--rose-core)' : isWarn ? 'var(--amber-core)' : '#38bdf8'
                        }}
                      >
                        {log.voltage?.toFixed(2)} V
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: log.temperature > 40 ? 'var(--amber-core)' : '#cbd5e1' }}>
                        {log.temperature > -50 && log.temperature < 150 ? log.temperature?.toFixed(1) + ' °C' : 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: '#a78bfa' }}>
                        {log.internalResistance?.toFixed(1)} mΩ
                      </span>
                    </td>
                    <td>
                      <span className="font-mono" style={{ color: '#94a3b8' }}>
                        {log.systemCurrent ? log.systemCurrent.toFixed(3) + ' A' : '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          isCrit ? 'badge-alert' : isWarn ? 'badge-warn' : 'badge-ok'
                        }`}
                      >
                        {isCrit ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                        <span>{log.status || 'Normal'}</span>
                      </span>
                    </td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {log.source === 'simulation' ? 'SIMULATED' : 'HARDWARE'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 6px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing <b>{filteredLogs.length}</b> of <b>{totalLogs}</b> recorded entries
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-secondary"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
            style={{ padding: '6px 12px' }}
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
          </button>

          <span className="font-mono" style={{ fontSize: '0.82rem', padding: '0 8px' }}>
            Page {page} / {pages || 1}
          </span>

          <button
            className="btn-secondary"
            disabled={page >= pages || isLoading}
            onClick={() => onPageChange(page + 1)}
            style={{ padding: '6px 12px' }}
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
