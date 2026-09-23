import mongoose from 'mongoose';

const onlinePriceHistorySchema = new mongoose.Schema({
  buyPricePer1000X: { type: Number, required: true, min: 1 },
  sellPricePer1000X: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['manual', 'provider'], required: true },
  providerName: { type: String, trim: true, default: null },
  providerReference: { type: String, trim: true, default: null },
  effectiveAt: { type: Date, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

onlinePriceHistorySchema.index({ createdAt: -1 });
export const OnlinePriceHistory = mongoose.model('OnlinePriceHistory', onlinePriceHistorySchema);
