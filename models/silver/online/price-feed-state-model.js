import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  key: { type: String, default: 'servix', unique: true },
  consecutiveFailures: { type: Number, default: 0 },
  lastAttemptAt: Date,
  lastSuccessAt: Date,
  nextAttemptAt: Date,
  lastError: { type: String, default: null },
  locked: { type: Boolean, default: false },
  guard: { type: Number, default: 0 }
}, { timestamps: true });
export const PriceFeedState = mongoose.model('PriceFeedState', schema);
