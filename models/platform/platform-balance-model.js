import mongoose from 'mongoose';
const platformBalanceSchema = new mongoose.Schema({
  key: { type: String, enum: ['main'], default: 'main', unique: true },
  // Settlement cash backing wallet withdrawals; never use this as the buyback limit.
  tomanAvailable: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
  // Separately allocated funds. Existing settlement cash is not migrated into this budget.
  buybackAvailableToman: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger }
}, { timestamps: true });
export const PlatformBalance = mongoose.model('PlatformBalance', platformBalanceSchema);
