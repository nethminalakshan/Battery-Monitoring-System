import mongoose from 'mongoose';

const SystemEventSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'error'],
      default: 'info'
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('SystemEvent', SystemEventSchema);
