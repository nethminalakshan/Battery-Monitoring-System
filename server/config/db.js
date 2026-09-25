import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
dotenv.config();

// Fallback DNS resolvers to prevent ECONNREFUSED with SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // Ignore if not permitted
}

// Default MongoDB Atlas connection string directly integrated for instant automatic connection & deployment
export const DEFAULT_MONGODB_URI = 'mongodb+srv://nethminalakshan2018_db_user:H6JotOZGXL5EfCRs@cluster0.d4so7rl.mongodb.net/battery_monitoring?retryWrites=true&w=majority';

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
  const uri = customUri || process.env.MONGODB_URI || DEFAULT_MONGODB_URI;

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

    // If already connected, no need to reconnect
    if (mongoose.connection.readyState === 1) {
      connectionStatus.state = 'connected';
      connectionStatus.error = null;
      return true;
    }

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
    // If SRV DNS failure occurred, re-try with explicit Google DNS
    if (err.message && err.message.includes('querySrv')) {
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await mongoose.connect(uri, {
          dbName: 'battery_monitoring',
          serverSelectionTimeoutMS: 8000,
          connectTimeoutMS: 10000,
        });
        connectionStatus.state = 'connected';
        connectionStatus.lastConnected = new Date().toISOString();
        connectionStatus.error = null;
        console.log(`[MongoDB] Connected successfully to MongoDB Atlas after DNS retry (${connectionStatus.uriMasked})`);
        return true;
      } catch (retryErr) {
        connectionStatus.state = 'error';
        connectionStatus.error = retryErr.message;
        console.error(`[MongoDB] Connection failed: ${retryErr.message}`);
        return false;
      }
    }

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
  const readyState = mongoose.connection.readyState;
  return {
    ...connectionStatus,
    state: readyState === 1 ? 'connected' : (connectionStatus.state === 'connected' ? 'disconnected' : connectionStatus.state),
    readyState
  };
}
