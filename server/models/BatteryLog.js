import mongoose from 'mongoose';

const BatteryLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    batteryId: {
      type: Number,
      enum: [1, 2],
      required: true,
      index: true
    },
    voltage: {
      type: Number,
      required: true
    },
    temperature: {
      type: Number,
      required: true
    },
    internalResistance: {
      type: Number,
      default: 0
    },
    systemCurrent: {
      type: Number,
      default: 0
    },
    ambientTemperature: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      default: 'Normal'
    },
    level: {
      type: String,
      enum: ['info', 'warn', 'critical'],
      default: 'info',
      index: true
    },
    source: {
      type: String,
      enum: ['hardware', 'simulation'],
      default: 'hardware'
    }
  },
  {
    timestamps: true
  }
);

// Compound index for queries by battery and time range
BatteryLogSchema.index({ batteryId: 1, timestamp: -1 });

export default mongoose.model('BatteryLog', BatteryLogSchema);
