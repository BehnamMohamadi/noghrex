import mongoose from 'mongoose';
import { ASSETS, LEDGER_DIRECTIONS } from '../../constants/financial.js';

const ledgerEntrySchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerAccount', required: true, index: true },
  asset: { type: String, enum: Object.values(ASSETS), required: true },
  direction: { type: String, enum: Object.values(LEDGER_DIRECTIONS), required: true },
  amount: {
    type: Number,
    required: true,
    min: 1,
    validate: { validator: Number.isSafeInteger, message: 'Ledger amount must be a safe integer.' }
  }
}, { timestamps: { createdAt: true, updatedAt: false } });

ledgerEntrySchema.index({ transactionId: 1, accountId: 1 });

export const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);
