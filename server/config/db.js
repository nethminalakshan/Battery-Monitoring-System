import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
dotenv.config();

// Fix for Windows / ISP DNS blocking querySrv for MongoDB Atlas
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore if not permitted
}

let connectionStatus = {
  state: 'disconnected', // 'connected', 'connecting', 'disconnected', 'error'
  lastConnected: null,
  error: null,
  uriMasked: ''
};

function maskUri(uri) {
  if (!uri) return '';
  return uri.replace(/\/\/(.*?):(.*?)@/, '//***:***@');
}

export async function connectDB(customUri = null) {
  const uri = customUri || process.env.MONGODB_URI;

  if (!uri || uri.includes('cluster0.example.mongodb.net') || uri.includes('user:pass@')) {
    connectionStatus = {
      state: 'disconnected',
      lastConnected: null,
      error: 'MongoDB Atlas URI not configured or using placeholder credentials. Please set your MongoDB Atlas connection string.',
      uriMasked: maskUri(uri)
    };
    console.warn('[MongoDB] No valid MongoDB Atlas URI found in environment. Please provide your connection string.');
    return false;
  }

  try {
    connectionStatus.state = 'connecting';
    connectionStatus.error = null;
    connectionStatus.uriMasked = maskUri(uri);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    await mongoose.connect(uri, {
      dbName: 'battery_monitoring',
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
    });

    connectionStatus.state = 'connected';
    connectionStatus.lastConnected = new Date().toISOString();
    connectionStatus.error = null;
    console.log(`[MongoDB] Connected successfully to MongoDB Atlas (${connectionStatus.uriMasked})`);
    return true;
  } catch (err) {
    connectionStatus.state = 'error';
    connectionStatus.error = err.message;
    console.error(`[MongoDB] Connection failed: ${err.message}`);
    return false;
  }
}

mongoose.connection.on('disconnected', () => {
  if (connectionStatus.state === 'connected') {
    connectionStatus.state = 'disconnected';
    console.warn('[MongoDB] Disconnected from MongoDB Atlas');
  }
});

mongoose.connection.on('reconnected', () => {
  connectionStatus.state = 'connected';
  connectionStatus.lastConnected = new Date().toISOString();
  console.log('[MongoDB] Reconnected to MongoDB Atlas');
});

export function getDbStatus() {
  return {
    ...connectionStatus,
    readyState: mongoose.connection.readyState // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  };
}
