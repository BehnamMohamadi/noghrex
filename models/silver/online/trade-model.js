import mongoose from 'mongoose';

const tradeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', required: true, unique: true, index: true },
  side: { type: String, enum: ['buy', 'sell'], required: true, index: true },
  xAmount: { type: Number, required: true, min: 1 },
  pricePer1000X: { type: Number, required: true, min: 1 },
  grossToman: { type: Number, required: true, min: 0 },
  commissionPercent: { type: Number, required: true, min: 0 },
  commissionToman: { type: Number, required: true, min: 0 },
  finalToman: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'cancelled', 'reversed'], default: 'pending', index: true },
  ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', default: null },
  inventoryTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'XInventoryTransaction', default: null },
  failureCode: { type: String, default: null },
  executedAt: { type: Date, default: null }
}, { timestamps: true });

tradeSchema.index({ userId: 1, createdAt: -1 });
export const Trade = mongoose.model('Trade', tradeSchema);
