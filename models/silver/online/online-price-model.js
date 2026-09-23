import mongoose from 'mongoose';

const onlinePriceSchema = new mongoose.Schema({
  key: { type: String, enum: ['current'], default: 'current', unique: true, immutable: true },
  buyPricePer1000X: { type: Number, required: true, min: 1 },
  sellPricePer1000X: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['manual', 'provider'], required: true, default: 'manual', index: true },
  providerName: { type: String, trim: true, default: null },
  providerReference: { type: String, trim: true, default: null },
  status: { type: String, enum: ['active', 'stale', 'unavailable'], default: 'active', index: true },
  effectiveAt: { type: Date, required: true, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export const OnlinePrice = mongoose.model('OnlinePrice', onlinePriceSchema);
