import mongoose from 'mongoose';

const methodLimitSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  perTransactionLimit: { type: Number, default: 15000000, min: 1 },
  dailyLimit: { type: Number, default: null, min: 1 }
}, { _id: false });

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true, trim: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);
export const DEFAULT_FINANCIAL_SETTINGS = Object.freeze({
  deposit: {
    gateway: { enabled: true, perTransactionLimit: 15000000, dailyLimit: null },
    card_to_card: { enabled: true, perTransactionLimit: 15000000, dailyLimit: null },
    iban: { enabled: true, perTransactionLimit: 15000000, dailyLimit: null }
  },
  withdrawal: { enabled: true, perTransactionLimit: 200000000, dailyLimit: 200000000, minimumAmount: 1, feeAmount: 0 },
  account: { maxBankAccountsPerUser: 3 },
  checkout: { ttlSeconds: 600, paymentTtlSeconds: 600 },
  physical: { wageType: 'percent', wageValue: 0, profitPercent: 0, taxPercent: 0 },
  trading: { minBuyX: 1, minSellX: 1, maxBuyX: null, maxSellX: null, buyCommissionPercent: 1, sellCommissionPercent: 1, quoteTtlSeconds: 120, roundingMode: 'floor' }
});
