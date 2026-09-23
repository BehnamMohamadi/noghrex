import mongoose from 'mongoose';
import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
import { BuybackAdjustment } from '../../models/platform/buyback-adjustment-model.js';
import { ensurePlatformFinancialAccount } from '../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../ledger/ledger-service.js';
import { writeAudit } from '../audit/audit-service.js';
import { PLATFORM_ACCOUNT_TYPES as ACCOUNTS } from '../../constants/financial.js';
import { AppError } from '../../errors/app-error.js';
import { adjustBuybackBudgetSchema } from '../../validations/platform/buyback-validation.js';

function checkReplay(existing, adminId, payload) {
  if (String(existing.adminId) !== String(adminId) || existing.type !== payload.type ||
      existing.amountToman !== payload.amountToman || existing.reason !== payload.reason) {
    throw new AppError('کلید تکرار درخواست با اطلاعات دیگری استفاده شده است.', 409, 'IDEMPOTENCY_CONFLICT');
  }
  return existing;
}

export async function adjustBuybackBudget(adminId, input, ip = null) {
  const { value: payload, error } = adjustBuybackBudgetSchema.validate(input);
  if (error) throw new AppError('اطلاعات تخصیص بودجه معتبر نیست.', 400, 'INVALID_BUYBACK_ADJUSTMENT');
  // Initialize only zero balances, outside the allocation transaction, so concurrent
  // first allocations contend on one existing document instead of racing inserts.
  await PlatformBalance.updateOne({ key: 'main' }, { $setOnInsert: { key: 'main' } }, { upsert: true });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existing = await BuybackAdjustment.findOne({ idempotencyKey: payload.idempotencyKey }).session(session);
      if (existing) { result = checkReplay(existing, adminId, payload); return; }
      let balance = await PlatformBalance.findOne({ key: 'main' }).session(session);
      if (!balance) balance = new PlatformBalance({ key: 'main' });
      const beforeToman = balance.buybackAvailableToman ?? 0;
      const afterToman = beforeToman + (payload.type === 'increase' ? payload.amountToman : -payload.amountToman);
      if (afterToman < 0) throw new AppError('بودجه بازخرید کافی نیست.', 409, 'INSUFFICIENT_BUYBACK_BUDGET');
      if (!Number.isSafeInteger(afterToman)) throw new AppError('مبلغ بودجه خارج از محدوده مجاز است.', 400, 'INVALID_BUYBACK_BALANCE');
      balance.buybackAvailableToman = afterToman;
      await balance.save({ session });
      const budget = await ensurePlatformFinancialAccount(ACCOUNTS.BUYBACK_BUDGET, session);
      const treasury = await ensurePlatformFinancialAccount(ACCOUNTS.TREASURY_ALLOCATION, session);
      const adjustmentId = new mongoose.Types.ObjectId();
      const increasing = payload.type === 'increase';
      const ledger = await postLedgerTransaction({
        type: 'adjustment', referenceType: 'buyback_budget', referenceId: adjustmentId,
        idempotencyKey: `BUYBACK:${payload.idempotencyKey}`,
        metadata: { reason: payload.reason, adminId: String(adminId), beforeToman, afterToman },
        entries: [
          { accountId: treasury._id, asset: 'TOMAN', direction: increasing ? 'debit' : 'credit', amount: payload.amountToman },
          { accountId: budget._id, asset: 'TOMAN', direction: increasing ? 'credit' : 'debit', amount: payload.amountToman }
        ]
      }, session);
      [result] = await BuybackAdjustment.create([{
        _id: adjustmentId, ...payload, adminId, beforeToman, afterToman, ledgerTransactionId: ledger._id
      }], { session });
      await writeAudit({ actorType: 'admin', actorId: adminId, action: 'ADMIN_ADJUSTED_BUYBACK_BUDGET',
        entityType: 'BuybackAdjustment', entityId: adjustmentId,
        metadata: { type: payload.type, amountToman: payload.amountToman, reason: payload.reason, beforeToman, afterToman }, ip
      }, session);
    });
    return result;
  } catch (error) {
    // A simultaneous first use of the same key can lose the unique-index race.
    if (error.code === 11000) {
      const existing = await BuybackAdjustment.findOne({ idempotencyKey: payload.idempotencyKey });
      if (existing) return checkReplay(existing, adminId, payload);
    }
    throw error;
  } finally { await session.endSession(); }
}

export async function getBuybackBudget() {
  const balance = await PlatformBalance.findOne({ key: 'main' }).lean();
  return { availableToman: balance?.buybackAvailableToman ?? 0 };
}

export async function listBuybackAdjustments({ page = 1, limit = 50 } = {}) {
  const safePage = Math.max(Math.trunc(Number(page)) || 1, 1);
  const safeLimit = Math.min(Math.max(Math.trunc(Number(limit)) || 50, 1), 100);
  const [items, total] = await Promise.all([
    BuybackAdjustment.find().sort({ createdAt: -1, _id: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    BuybackAdjustment.countDocuments()
  ]);
  return { page: safePage, perPage: safeLimit, total, totalPages: Math.ceil(total / safeLimit), items };
}
