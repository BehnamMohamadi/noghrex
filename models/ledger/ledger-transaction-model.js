import mongoose from 'mongoose';
import { LEDGER_TRANSACTION_STATUSES } from '../../constants/financial.js';

const ledgerTransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['deposit', 'withdrawal', 'x_buy', 'x_sell', 'order_payment', 'refund', 'adjustment', 'transfer'],
    required: true,
    index: true
  },
  referenceType: { type: String, required: true, trim: true, maxlength: 60 },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  status: {
    type: String,
    enum: Object.values(LEDGER_TRANSACTION_STATUSES),
    default: LEDGER_TRANSACTION_STATUSES.PENDING,
    index: true
  },
  idempotencyKey: { type: String, required: true, unique: true, index: true, maxlength: 180 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  postedAt: { type: Date, default: null },
  reversedAt: { type: Date, default: null },
  reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', default: null }
}, { timestamps: true });

export const LedgerTransaction = mongoose.model('LedgerTransaction', ledgerTransactionSchema);
