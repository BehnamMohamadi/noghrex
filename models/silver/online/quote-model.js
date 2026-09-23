import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  side: { type: String, enum: ['buy', 'sell'], required: true, index: true },
  xAmount: { type: Number, required: true, min: 1 },
  pricePer1000X: { type: Number, required: true, min: 1 },
  grossToman: { type: Number, required: true, min: 0 },
  commissionPercent: { type: Number, required: true, min: 0 },
  commissionToman: { type: Number, required: true, min: 0 },
  finalToman: { type: Number, required: true, min: 0 },
  priceSource: { type: String, enum: ['manual', 'provider'], required: true },
  priceEffectiveAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'used', 'expired', 'cancelled'], default: 'active', index: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date, default: null }
}, { timestamps: true });

quoteSchema.index({ userId: 1, createdAt: -1 });
export const Quote = mongoose.model('Quote', quoteSchema);
