import React from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Trash2 } from 'lucide-react';

const severityClass = {
  critical: 'alert-critical',
  warning: 'alert-warning',
  info: 'alert-info'
};

export default function SystemAlerts({ alerts = [], onClear }) {
  return (
    <section className="alerts-section">
      <div className="alerts-header">
        <div>
          <div className="alerts-title">
            <BellRing size={20} />
            <h2>SYSTEM ALERT ANNOUNCEMENTS</h2>
          </div>
          <p>Abnormal battery and communication events detected from live telemetry.</p>
        </div>
        <button className="btn-secondary" onClick={onClear} disabled={alerts.length === 0}>
          <Trash2 size={14} />
          Clear alerts
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="glass-panel alert-empty">
          <CheckCircle2 size={22} />
          <div>
            <strong>All systems normal</strong>
            <span>No abnormal events have been detected.</span>
          </div>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map(alert => (
            <article key={alert.id} className={`glass-panel alert-card ${severityClass[alert.severity] || 'alert-info'}`}>
              <AlertTriangle size={20} />
              <div className="alert-content">
                <div className="alert-card-heading">
                  <strong>{alert.title}</strong>
                  <span>{alert.time}</span>
                </div>
                <p>{alert.message}</p>
              </div>
              <span className="alert-severity">{alert.severity}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
