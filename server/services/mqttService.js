import mqtt from 'mqtt';
import BatteryLog from '../models/BatteryLog.js';
import SystemEvent from '../models/SystemEvent.js';
import mongoose from 'mongoose';

const V_MIN = 10.5;
const V_LOW = 11.5;
const V_HIGH = 14.0;
const V_MAX = 14.4;

export const state = {
  bat1: { volt: 0, temp: 0, ir: 0, updatedAt: null },
  bat2: { volt: 0, temp: 0, ir: 0, updatedAt: null },
  system: { current: 0, temp: 0, updatedAt: null },
  status: { online: false, ta1: false, ta2: false, tc_error: false },
  recentLogs: []
};

let mqttClient = null;
let mqttStatus = {
  connected: false,
  broker: process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883',
  error: null,
  lastMessageAt: null
};

// Throttle database writes to every 2 seconds per battery unless critical alert
let lastDbWrite = { 1: 0, 2: 0 };
const WRITE_INTERVAL_MS = 2000;

function evaluateStatus(volt, temp) {
  if (volt > 0 && volt < V_LOW) return { status: 'Low Voltage', level: 'warn' };
  if (volt > V_HIGH) return { status: 'High Voltage', level: 'warn' };
  if (temp > 45) return { status: 'Overtemp Alert', level: 'critical' };
  if (temp > 35) return { status: 'Warm', level: 'warn' };
  if (volt === 0) return { status: 'Standby / No Data', level: 'info' };
  return { status: 'Normal', level: 'info' };
}

async function maybeSaveBatteryLog(batNum, force = false) {
  if (mongoose.connection.readyState !== 1) return; // MongoDB not connected

  const now = Date.now();
  if (!force && now - lastDbWrite[batNum] < WRITE_INTERVAL_MS) {
    return;
  }

  const b = batNum === 1 ? state.bat1 : state.bat2;
  if (!b.volt && !b.temp) return; // Ignore uninitialized

  const evalRes = evaluateStatus(b.volt, b.temp);
  lastDbWrite[batNum] = now;

  try {
    const doc = await BatteryLog.create({
      timestamp: new Date(),
      batteryId: batNum,
      voltage: Number(b.volt.toFixed(2)),
      temperature: Number(b.temp.toFixed(1)),
      internalResistance: Number(b.ir.toFixed(1)),
      systemCurrent: Number(state.system.current.toFixed(3)),
      ambientTemperature: Number(state.system.temp.toFixed(1)),
      status: evalRes.status,
      level: evalRes.level,
      source: 'hardware'
    });

    // Keep last 50 in-memory
    state.recentLogs.unshift({
      _id: doc._id,
      timestamp: doc.timestamp,
      batteryId: batNum,
      voltage: doc.voltage,
      temperature: doc.temperature,
      internalResistance: doc.internalResistance,
      systemCurrent: doc.systemCurrent,
      ambientTemperature: doc.ambientTemperature,
      status: doc.status,
      level: doc.level
    });
    if (state.recentLogs.length > 50) state.recentLogs.pop();
  } catch (err) {
    console.error(`[MQTT Service] Error saving log for Bat ${batNum}:`, err.message);
  }
}

export function initMqtt() {
  const broker = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
  const clientId = (process.env.MQTT_CLIENT_ID || 'rms-server-backend') + '-' + Math.random().toString(16).slice(2, 6);

  console.log(`[MQTT] Connecting to ${broker} with client ID: ${clientId}`);
  mqttStatus.broker = broker;

  mqttClient = mqtt.connect(broker, {
    clientId,
    clean: true,
    reconnectPeriod: 3000
  });

  mqttClient.on('connect', () => {
    mqttStatus.connected = true;
    mqttStatus.error = null;
    console.log('[MQTT] Connected to broker successfully!');

    mqttClient.subscribe('rms/#', (err) => {
      if (err) {
        console.error('[MQTT] Subscription error:', err);
      } else {
        console.log('[MQTT] Subscribed to topic "rms/#"');
      }
    });
  });

  mqttClient.on('reconnect', () => {
    mqttStatus.connected = false;
    console.warn('[MQTT] Reconnecting to broker...');
  });

  mqttClient.on('error', (err) => {
    mqttStatus.connected = false;
    mqttStatus.error = err.message;
    console.error('[MQTT] Error:', err.message);
  });

  mqttClient.on('message', async (topic, payload) => {
    mqttStatus.lastMessageAt = new Date().toISOString();
    const str = payload.toString().trim();
    const num = parseFloat(str);

    // Any incoming message from CM marks ESP8266 CM online
    state.status.online = true;

    switch (topic) {
      case 'rms/battery/1/voltage':
        state.bat1.volt = isNaN(num) ? 0 : num;
        state.bat1.updatedAt = new Date().toISOString();
        state.status.ta1 = true;
        maybeSaveBatteryLog(1);
        break;
      case 'rms/battery/1/temperature':
        state.bat1.temp = isNaN(num) ? 0 : num;
        state.bat1.updatedAt = new Date().toISOString();
        state.status.ta1 = true;
        maybeSaveBatteryLog(1);
        break;
      case 'rms/battery/1/ir':
        state.bat1.ir = isNaN(num) ? 0 : num;
        state.bat1.updatedAt = new Date().toISOString();
        state.status.ta1 = true;
        maybeSaveBatteryLog(1);
        break;

      case 'rms/battery/2/voltage':
        state.bat2.volt = isNaN(num) ? 0 : num;
        state.bat2.updatedAt = new Date().toISOString();
        state.status.ta2 = true;
        maybeSaveBatteryLog(2);
        break;
      case 'rms/battery/2/temperature':
        state.bat2.temp = isNaN(num) ? 0 : num;
        state.bat2.updatedAt = new Date().toISOString();
        state.status.ta2 = true;
        maybeSaveBatteryLog(2);
        break;
      case 'rms/battery/2/ir':
        state.bat2.ir = isNaN(num) ? 0 : num;
        state.bat2.updatedAt = new Date().toISOString();
        state.status.ta2 = true;
        maybeSaveBatteryLog(2);
        break;

      case 'rms/system/current':
        state.system.current = isNaN(num) ? 0 : num;
        state.system.updatedAt = new Date().toISOString();
        break;
      case 'rms/system/temperature':
        state.system.temp = isNaN(num) ? 0 : num;
        state.system.updatedAt = new Date().toISOString();
        break;

      case 'rms/status':
        try {
          const parsed = JSON.parse(str);
          state.status = {
            ...state.status,
            online: parsed.online !== undefined ? parsed.online : state.status.online,
            ta1: parsed.ta1 !== undefined ? parsed.ta1 : state.status.ta1,
            ta2: parsed.ta2 !== undefined ? parsed.ta2 : state.status.ta2,
            tc_error: parsed.tc_error !== undefined ? parsed.tc_error : false
          };

          if (parsed.tc_error && mongoose.connection.readyState === 1) {
            SystemEvent.create({
              eventType: 'TC_ERROR',
              message: 'TC Module not responding or communication failed',
              severity: 'error',
              details: parsed
            }).catch(() => {});
          }
        } catch {
          // Ignore JSON parse issues
        }
        break;
    }
  });
}

export function getMqttStatus() {
  return mqttStatus;
}
