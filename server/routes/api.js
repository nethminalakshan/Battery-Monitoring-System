import express from 'express';
import mongoose from 'mongoose';
import BatteryLog from '../models/BatteryLog.js';
import SystemEvent from '../models/SystemEvent.js';
import { getDbStatus, connectDB } from '../config/db.js';
import { state, getMqttStatus } from '../services/mqttService.js';

const router = express.Router();

// 1. Health & Connection Status
router.get('/health', (req, res) => {
  const now = Date.now();
  const TIMEOUT_MS = 15000;
  const bat1Active = state.bat1.updatedAt ? (now - new Date(state.bat1.updatedAt).getTime() < TIMEOUT_MS) : false;
  const bat2Active = state.bat2.updatedAt ? (now - new Date(state.bat2.updatedAt).getTime() < TIMEOUT_MS) : false;
  const mqttStat = getMqttStatus();
  const lastMsgTime = mqttStat.lastMessageAt ? new Date(mqttStat.lastMessageAt).getTime() : 0;
  const cmOnline = (now - lastMsgTime < TIMEOUT_MS) || state.status.online;

  res.json({
    ok: true,
    timestamp: new Date().toISOString(),
    database: getDbStatus(),
    mqtt: mqttStat,
    telemetry: {
      bat1: state.bat1,
      bat2: state.bat2,
      system: state.system,
      status: {
        ...state.status,
        online: cmOnline,
        ta1: bat1Active || state.status.ta1,
        ta2: bat2Active || state.status.ta2
      }
    }
  });
});

// 2. Real-time Live Snapshot
router.get('/telemetry/live', (req, res) => {
  res.json({
    bat1: state.bat1,
    bat2: state.bat2,
    system: state.system,
    status: state.status,
    recentLogs: state.recentLogs
  });
});

// 3. Historical Logs Portal (Paginated with filters)
router.get('/logs', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      // If DB is offline, return recent in-memory logs with offline flag
      return res.json({
        source: 'memory_fallback',
        isDbConnected: false,
        warning: 'MongoDB Atlas is not connected. Showing in-memory logs only.',
        total: state.recentLogs.length,
        page: 1,
        pages: 1,
        logs: state.recentLogs
      });
    }

    const {
      page = 1,
      limit = 25,
      batteryId,
      level,
      startDate,
      endDate,
      sort = -1
    } = req.query;

    const query = {};

    if (batteryId && (batteryId === '1' || batteryId === '2')) {
      query.batteryId = parseInt(batteryId, 10);
    }

    if (level && ['info', 'warn', 'critical'].includes(level)) {
      query.level = level;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      BatteryLog.find(query)
        .sort({ timestamp: parseInt(sort, 10) })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      BatteryLog.countDocuments(query)
    ]);

    res.json({
      source: 'mongodb_atlas',
      isDbConnected: true,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      limit: limitNum,
      logs
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs: ' + err.message });
  }
});

// 4. Analytics History for Charts
router.get('/stats/history', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        source: 'memory_fallback',
        data: []
      });
    }

    const { timeframe = '24h' } = req.query;

    let timeAgo = 24 * 60 * 60 * 1000;
    if (timeframe === '1h') timeAgo = 1 * 60 * 60 * 1000;
    if (timeframe === '6h') timeAgo = 6 * 60 * 60 * 1000;
    if (timeframe === '7d') timeAgo = 7 * 24 * 60 * 60 * 1000;
    if (timeframe === '30d') timeAgo = 30 * 24 * 60 * 60 * 1000;
    if (timeframe === 'all') timeAgo = 365 * 24 * 60 * 60 * 1000;

    const cutoff = new Date(Date.now() - timeAgo);

    const logs = await BatteryLog.find({ timestamp: { $gte: cutoff } })
      .sort({ timestamp: 1 })
      .limit(1000)
      .lean();

    // Group logs into timestamp buckets for paired charting
    const map = new Map();

    for (const log of logs) {
      // Group to nearest 10-30s depending on timeframe
      const stepMs = timeframe === '1h' ? 5000 : timeframe === '24h' ? 60000 : 300000;
      const roundedTime = new Date(Math.floor(new Date(log.timestamp).getTime() / stepMs) * stepMs).toISOString();

      if (!map.has(roundedTime)) {
        map.set(roundedTime, {
          timestamp: roundedTime,
          bat1Volt: null,
          bat2Volt: null,
          bat1Temp: null,
          bat2Temp: null,
          bat1Ir: null,
          bat2Ir: null,
          current: log.systemCurrent || 0,
          ambientTemp: log.ambientTemperature || 0
        });
      }

      const entry = map.get(roundedTime);
      if (log.batteryId === 1) {
        entry.bat1Volt = log.voltage;
        entry.bat1Temp = log.temperature;
        entry.bat1Ir = log.internalResistance;
      } else if (log.batteryId === 2) {
        entry.bat2Volt = log.voltage;
        entry.bat2Temp = log.temperature;
        entry.bat2Ir = log.internalResistance;
      }
      if (log.systemCurrent) entry.current = log.systemCurrent;
      if (log.ambientTemperature) entry.ambientTemp = log.ambientTemperature;
    }

    const data = Array.from(map.values());
    res.json({ source: 'mongodb_atlas', count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history stats: ' + err.message });
  }
});

// 5. Summary KPI Stats
router.get('/stats/summary', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({
        isDbConnected: false,
        totalLogs: 0,
        bat1: { minV: 0, maxV: 0, avgV: 0, avgTemp: 0 },
        bat2: { minV: 0, maxV: 0, avgV: 0, avgTemp: 0 },
        criticalCount: 0
      });
    }

    const [totalLogs, bat1Stats, bat2Stats, criticalCount] = await Promise.all([
      BatteryLog.countDocuments(),
      BatteryLog.aggregate([
        { $match: { batteryId: 1 } },
        {
          $group: {
            _id: null,
            minV: { $min: '$voltage' },
            maxV: { $max: '$voltage' },
            avgV: { $avg: '$voltage' },
            avgTemp: { $avg: '$temperature' },
            maxTemp: { $max: '$temperature' }
          }
        }
      ]),
      BatteryLog.aggregate([
        { $match: { batteryId: 2 } },
        {
          $group: {
            _id: null,
            minV: { $min: '$voltage' },
            maxV: { $max: '$voltage' },
            avgV: { $avg: '$voltage' },
            avgTemp: { $avg: '$temperature' },
            maxTemp: { $max: '$temperature' }
          }
        }
      ]),
      BatteryLog.countDocuments({ level: { $in: ['warn', 'critical'] } })
    ]);

    res.json({
      isDbConnected: true,
      totalLogs,
      criticalCount,
      bat1: bat1Stats[0] || { minV: 0, maxV: 0, avgV: 0, avgTemp: 0, maxTemp: 0 },
      bat2: bat2Stats[0] || { minV: 0, maxV: 0, avgV: 0, avgTemp: 0, maxTemp: 0 }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch summary: ' + err.message });
  }
});

// 6. Seed Realistic Historical Logs into MongoDB Atlas
router.post('/logs/seed', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(400).json({
        error: 'Cannot seed data: MongoDB Atlas is not currently connected. Please connect your MongoDB Atlas cluster first.'
      });
    }

    const count = Math.min(300, Math.max(20, parseInt(req.body.count || 120, 10)));
    const now = Date.now();
    const stepMs = (24 * 60 * 60 * 1000) / (count / 2); // Spread across past 24 hours

    const docs = [];
    let b1V = 12.6, b2V = 12.5;
    let b1T = 28.5, b2T = 29.1;
    let b1Ir = 18.2, b2Ir = 19.5;
    let current = 2.4;

    for (let i = count; i >= 0; i--) {
      const timestamp = new Date(now - i * stepMs);

      // Simulate slight sinusoidal battery discharge & slight noise
      const cycleProgress = Math.sin((count - i) / 15);
      b1V = +(12.2 + cycleProgress * 0.7 + (Math.random() - 0.5) * 0.1).toFixed(2);
      b2V = +(12.1 + cycleProgress * 0.65 + (Math.random() - 0.5) * 0.1).toFixed(2);
      b1T = +(28 + (1 - cycleProgress) * 5 + (Math.random() - 0.5) * 0.8).toFixed(1);
      b2T = +(28.5 + (1 - cycleProgress) * 5.2 + (Math.random() - 0.5) * 0.8).toFixed(1);
      b1Ir = +(18.0 + (count - i) * 0.005 + (Math.random() - 0.5) * 0.2).toFixed(1);
      b2Ir = +(19.2 + (count - i) * 0.006 + (Math.random() - 0.5) * 0.2).toFixed(1);
      current = +(3.5 + cycleProgress * 4.0 + (Math.random() - 0.5) * 0.5).toFixed(3);
      const ambTemp = +(27.0 + Math.sin(i / 10) * 3).toFixed(1);

      // Bat 1 doc
      let status1 = 'Normal';
      let level1 = 'info';
      if (b1V < 11.5) { status1 = 'Low Voltage'; level1 = 'warn'; }
      if (b1T > 40) { status1 = 'Warm Warning'; level1 = 'warn'; }

      docs.push({
        timestamp,
        batteryId: 1,
        voltage: b1V,
        temperature: b1T,
        internalResistance: b1Ir,
        systemCurrent: current,
        ambientTemperature: ambTemp,
        status: status1,
        level: level1,
        source: 'simulation'
      });

      // Bat 2 doc
      let status2 = 'Normal';
      let level2 = 'info';
      if (b2V < 11.5) { status2 = 'Low Voltage'; level2 = 'warn'; }
      if (b2T > 40) { status2 = 'Warm Warning'; level2 = 'warn'; }

      docs.push({
        timestamp,
        batteryId: 2,
        voltage: b2V,
        temperature: b2T,
        internalResistance: b2Ir,
        systemCurrent: current,
        ambientTemperature: ambTemp,
        status: status2,
        level: level2,
        source: 'simulation'
      });
    }

    const inserted = await BatteryLog.insertMany(docs);
    res.json({
      success: true,
      message: `Successfully seeded ${inserted.length} realistic telemetry logs into MongoDB Atlas!`,
      insertedCount: inserted.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to seed logs: ' + err.message });
  }
});

// 7. Update MongoDB Atlas URI Dynamically
router.post('/config/mongo-uri', async (req, res) => {
  const { uri } = req.body;
  if (!uri || typeof uri !== 'string') {
    return res.status(400).json({ error: 'URI string is required' });
  }

  const success = await connectDB(uri.trim());
  const status = getDbStatus();

  if (success) {
    res.json({
      success: true,
      message: 'Connected to MongoDB Atlas successfully!',
      status
    });
  } else {
    res.status(400).json({
      success: false,
      message: 'Failed to connect to MongoDB Atlas with the provided URI.',
      status
    });
  }
});

// 8. Clear Telemetry Logs
router.delete('/logs/clear', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      state.recentLogs = [];
      return res.json({ success: true, message: 'Cleared in-memory logs.' });
    }
    const result = await BatteryLog.deleteMany({});
    state.recentLogs = [];
    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} records from MongoDB Atlas.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear logs: ' + err.message });
  }
});

export default router;
