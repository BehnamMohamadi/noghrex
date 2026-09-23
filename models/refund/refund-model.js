import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  reason: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ['requested', 'approved', 'rejected', 'refunded'], default: 'requested' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, reviewedAt: Date,
  rejectionReason: String, stockReturned: { type: Boolean, default: false }, completedAt: Date,
  ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction' }
}, { timestamps: true });
export const Refund = mongoose.model('Refund', schema);
