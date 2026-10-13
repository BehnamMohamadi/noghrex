import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  provider: { type: String, required: true, trim: true, index: true },
  sampledAt: { type: Date, required: true, index: true },
  tehranDay: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
  granularity: { type: String, enum: ['intraday', 'daily_close'], required: true, index: true },
  silverOunceUsd: { type: Number, required: true, min: 0 },
  usdRial: { type: Number, required: true, min: 0 },
  silverGramToman: { type: Number, required: true, min: 1 },
  providerTimestamp: { type: Date, default: null },
  providerReferences: { type: [String], default: [] }
}, { timestamps: true });

schema.index({ provider: 1, sampledAt: 1, granularity: 1 }, { unique: true });
schema.index({ provider: 1, tehranDay: 1, granularity: 1 });

export const SilverMarketPrice = mongoose.model('SilverMarketPrice', schema);
