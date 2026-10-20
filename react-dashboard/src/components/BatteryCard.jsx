import React from 'react';
import { BatteryCharging, ShieldCheck, AlertTriangle } from 'lucide-react';

const V_LOW = 11.5;
const V_HIGH = 14.0;

function AnalogMeter({ label, value, unit, min, max, color, decimals = 1, alert = false, warning = false }) {
  const radius = 38;
  const circumference = Math.PI * radius;
  const fraction = Math.min(Math.max((value - min) / (max - min), 0), 1);
  const dashOffset = circumference * (1 - fraction);

  return (
    <div className="analog-meter">
      <div className="analog-meter-label">{label}</div>
      <svg viewBox="0 0 100 62" className="analog-meter-svg" role="img" aria-label={`${label}: ${value.toFixed(decimals)} ${unit}`}>
        <path
          d="M 12 50 A 38 38 0 0 1 88 50"
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 12 50 A 38 38 0 0 1 88 50"
          fill="none"
          stroke={alert ? 'var(--rose-core)' : warning ? 'var(--amber-core)' : color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="50" y="43" textAnchor="middle" className="analog-meter-value">
          {value.toFixed(decimals)}
        </text>
        <text x="50" y="56" textAnchor="middle" className="analog-meter-unit">
          {unit}
        </text>
      </svg>
      <div className="analog-meter-scale">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export default function BatteryCard({
  batteryId,
  data = { volt: 0, temp: 0, ir: 0 },
  activeChip = false
}) {
  const volt = data.volt || 0;
  const temp = data.temp || 0;
  const ir = data.ir || 0;

  const isBat2 = batteryId === 2;
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

      <div className="analog-meter-row">
        <AnalogMeter
          label="Terminal Voltage"
          value={volt}
          unit="V"
          min={0}
          max={15}
          color="var(--cyan-core)"
          decimals={2}
          alert={volt > 0 && volt < V_LOW}
          warning={volt > V_HIGH}
        />
        <AnalogMeter
          label="Cell Temperature"
          value={hasTempSensor ? temp : 0}
          unit="°C"
          min={0}
          max={60}
          color="var(--amber-core)"
          alert={hasTempSensor && temp > 45}
          warning={hasTempSensor && temp > 35}
        />
        <AnalogMeter
          label="Internal Resistance"
          value={ir}
          unit="mΩ"
          min={0}
          max={200}
          color="#a78bfa"
          decimals={1}
          warning={ir > 180}
        />
      </div>
    </div>
  );
}
