import mongoose from 'mongoose';
import { ASSETS, BALANCE_TYPES, LEDGER_OWNER_TYPES, PLATFORM_ACCOUNT_TYPES } from '../../constants/financial.js';

const ledgerAccountSchema = new mongoose.Schema({
  ownerType: { type: String, enum: Object.values(LEDGER_OWNER_TYPES), required: true, index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: false, default: null, index: true },
  asset: { type: String, enum: Object.values(ASSETS), required: true },
  balanceType: { type: String, enum: [...Object.values(BALANCE_TYPES), ...Object.values(PLATFORM_ACCOUNT_TYPES)], required: true },
  status: { type: String, enum: ['active', 'frozen'], default: 'active', index: true }
}, { timestamps: true });

ledgerAccountSchema.index(
  { ownerType: 1, ownerId: 1, asset: 1, balanceType: 1 },
  { unique: true }
);

export const LedgerAccount = mongoose.model('LedgerAccount', ledgerAccountSchema);
