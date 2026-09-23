import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  type: { type: String, enum: ['increase', 'decrease'], required: true },
  amountToman: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  beforeToman: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  afterToman: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idempotencyKey: { type: String, required: true, unique: true, maxlength: 120 },
  ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', required: true }
}, { timestamps: true });

export const BuybackAdjustment = mongoose.model('BuybackAdjustment', schema);
