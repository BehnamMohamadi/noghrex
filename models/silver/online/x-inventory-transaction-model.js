import mongoose from 'mongoose';

const xInventoryTransactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['increase', 'decrease', 'trade_buy', 'trade_sell', 'reversal'], required: true, index: true },
  amountX: { type: Number, required: true, min: 1 },
  beforeX: { type: Number, required: true, min: 0 },
  afterX: { type: Number, required: true, min: 0 },
  reason: { type: String, trim: true, maxlength: 1000, default: null },
  actorType: { type: String, enum: ['admin', 'system'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referenceType: { type: String, enum: ['admin_adjustment', 'trade', 'reversal'], required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  idempotencyKey: { type: String, required: true, unique: true, index: true }
}, { timestamps: true });

export const XInventoryTransaction = mongoose.model('XInventoryTransaction', xInventoryTransactionSchema);
