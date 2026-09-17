import React from 'react';
import { BatteryCharging, BatteryWarning, Thermometer, Gauge, ShieldCheck, AlertTriangle } from 'lucide-react';

const V_MIN = 10.5;
const V_MAX = 14.4;
const V_LOW = 11.5;
const V_HIGH = 14.0;

export default function BatteryCard({
  batteryId,
  data = { volt: 0, temp: 0, ir: 0 },
  activeChip = false
}) {
  const volt = data.volt || 0;
  const temp = data.temp || 0;
  const ir = data.ir || 0;

  // Calculate percentage based on 12V Lead-Acid nominal operating curve
  const pct = Math.min(Math.max(Math.round(((volt - V_MIN) / (V_MAX - V_MIN)) * 100), 0), 100);

  // Status & Color logic
  let statusText = 'Normal';
  let statusLevel = 'ok';

  const hasTempSensor = temp > -50 && temp < 150;

  if (volt > 0 && volt < V_LOW) {
    statusText = 'Low Voltage';
    statusLevel = 'alert';
  } else if (volt > V_HIGH) {
    statusText = 'High Voltage / Overcharge';
    statusLevel = 'warn';
  } else if (hasTempSensor && temp > 45) {
    statusText = 'Overtemp Alert';
    statusLevel = 'alert';
  } else if (hasTempSensor && temp > 35) {
    statusText = 'Elevated Temp';
    statusLevel = 'warn';
  } else if (volt === 0) {
    statusText = 'Standby / Offline';
    statusLevel = 'warn';
  }

  const isBat2 = batteryId === 2;

  return (
    <div className={`glass-panel battery-card ${isBat2 ? 'bat2' : ''}`}>
      {/* Header */}
      <div className="battery-header">
        <div className="battery-id">
          <div className="battery-icon-wrap">
            <BatteryCharging size={24} />
          </div>
          <div>
            <div className="battery-title">BATTERY CELL #{batteryId}</div>
            <div className="battery-subtext">
              {activeChip ? 'Active Sensor • Module TA' + batteryId : 'Sensors Listening...'}
            </div>
          </div>
        </div>

        <div className={`badge badge-${statusLevel}`}>
          {statusLevel === 'alert' ? (
            <AlertTriangle size={12} />
          ) : (
            <ShieldCheck size={12} />
          )}
          <span>{statusText}</span>
        </div>
      </div>

      {/* Charge Level Bar */}
      <div className="charge-visualizer">
        <div className="charge-info">
          <span style={{ color: 'var(--text-secondary)' }}>State of Charge (SoC)</span>
          <span className="font-mono" style={{ color: 'var(--cyan-core)' }}>
            {pct}%
          </span>
        </div>
        <div className="charge-bar-track">
          <div
            className="charge-bar-fill"
            style={{
              width: `${pct}%`,
              backgroundColor:
                volt < V_LOW
                  ? 'var(--rose-core)'
                  : volt > V_HIGH
                  ? 'var(--amber-core)'
                  : undefined
            }}
          />
        </div>
      </div>

      {/* Metric 3-Column Readout */}
      <div className="metric-row">
        {/* Voltage */}
        <div className="metric-box">
          <span className="metric-label">Terminal Voltage</span>
          <div className="metric-value-wrap">
            <span
              className={`metric-number ${
                volt < V_LOW ? 'alert' : volt > V_HIGH ? 'warn' : 'normal'
              }`}
            >
              {volt > 0 ? volt.toFixed(2) : '0.00'}
            </span>
            <span className="metric-unit">V</span>
          </div>
        </div>

        {/* Temperature */}
        <div className="metric-box">
          <span className="metric-label">Cell Temperature</span>
          <div className="metric-value-wrap">
            <span
              className={`metric-number ${
                hasTempSensor && temp > 45 ? 'alert' : hasTempSensor && temp > 35 ? 'warn' : ''
              }`}
            >
              {hasTempSensor ? temp.toFixed(1) : 'N/A'}
            </span>
            <span className="metric-unit">{hasTempSensor ? '°C' : ''}</span>
          </div>
        </div>

        {/* Internal Resistance */}
        <div className="metric-box">
          <span className="metric-label">Internal Resist.</span>
          <div className="metric-value-wrap">
            <span className="metric-number" style={{ color: '#a78bfa' }}>
              {ir > 0 ? ir.toFixed(1) : '0.0'}
            </span>
            <span className="metric-unit">mΩ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
