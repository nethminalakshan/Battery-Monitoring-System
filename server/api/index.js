import { app } from '../server.js';
import { connectDB } from '../config/db.js';

let connectionPromise;

export default async function handler(req, res) {
  if (process.env.MONGODB_URI && !connectionPromise) {
    connectionPromise = connectDB();
  }

  if (connectionPromise) {
    const connected = await connectionPromise;
    if (!connected) {
      connectionPromise = undefined;
    }
  }

  return app(req, res);
}
