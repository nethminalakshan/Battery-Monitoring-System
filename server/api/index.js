import { app } from '../server.js';
import { connectDB } from '../config/db.js';

let connectionPromise;

export default async function handler(req, res) {
  if (!connectionPromise) {
    connectionPromise = connectDB();
  }

  const connected = await connectionPromise;
  if (!connected) {
    connectionPromise = undefined;
    return res.status(503).json({
      ok: false,
      error: 'MongoDB connection failed. Check the MONGODB_URI Vercel environment variable and MongoDB Atlas network access.'
    });
  }

  return app(req, res);
}
