import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';
import { connectDB } from './config/db.js';
import { initMqtt } from './services/mqttService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// API routing
app.use('/api', apiRouter);

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'RMS Battery Monitoring Backend Service',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      liveTelemetry: '/api/telemetry/live',
      logs: '/api/logs',
      historyStats: '/api/stats/history',
      summary: '/api/stats/summary',
      seedLogs: 'POST /api/logs/seed',
      updateMongoUri: 'POST /api/config/mongo-uri'
    }
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`RMS Battery Monitoring Server running on port ${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);

  // Attempt connection to MongoDB Atlas
  await connectDB();

  // Initialize MQTT ingestion
  initMqtt();
});
