import { app } from '../server.js';
import { connectDB } from '../config/db.js';

import mongoose from 'mongoose';

let connectionPromise;

export default async function handler(req, res) {
  if (mongoose.connection.readyState === 0 || !connectionPromise) {
    connectionPromise = connectDB();
  }

  if (connectionPromise) {
    const connected = await connectionPromise;
    if (!connected || mongoose.connection.readyState === 0) {
      connectionPromise = undefined;
    }
  }

  return app(req, res);
}
