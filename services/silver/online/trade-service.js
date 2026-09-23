import mongoose from 'mongoose';
import { Quote } from '../../../models/silver/online/quote-model.js';
import { Trade } from '../../../models/silver/online/trade-model.js';
import { Wallet } from '../../../models/wallet/wallet-model.js';
import { OnlineInventory } from '../../../models/silver/online/online-inventory-model.js';
import { XInventoryTransaction } from '../../../models/silver/online/x-inventory-transaction-model.js';
import { PlatformBalance } from '../../../models/platform/platform-balance-model.js';
import { AppError } from '../../../errors/app-error.js';
import { getUserLedgerAccount, ensurePlatformFinancialAccount, ensurePlatformXAccount } from '../../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../../ledger/ledger-service.js';
import { ASSETS, BALANCE_TYPES, LEDGER_DIRECTIONS, PLATFORM_ACCOUNT_TYPES as ACCOUNTS } from '../../../constants/financial.js';

async function loadAccounts(userId, session) {
  // MongoDB transactions must not run parallel operations on the same session.
  const userToman = await getUserLedgerAccount(userId, ASSETS.TOMAN, BALANCE_TYPES.AVAILABLE, session);
  const userX = await getUserLedgerAccount(userId, ASSETS.X, BALANCE_TYPES.AVAILABLE, session);
  const platformX = await ensurePlatformXAccount(session);
  const accounts = { userToman, userX, platformX };
  for (const [key, type] of Object.entries(ACCOUNTS)) {
    if (key !== 'TREASURY_ALLOCATION') accounts[key] = await ensurePlatformFinancialAccount(type, session);
  }
  return accounts;
}

export async function executeTrade(userId, quoteId) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const quote = await Quote.findOne({ _id: quoteId, userId }).session(session);
      if (!quote) throw new AppError('Quote پیدا نشد.', 404, 'QUOTE_NOT_FOUND');
      const existingTrade = await Trade.findOne({ quoteId: quote._id }).session(session);
      if (existingTrade) { result = existingTrade; return; }
      if (quote.status !== 'active') throw new AppError('این Quote دیگر قابل استفاده نیست.', 409, 'QUOTE_NOT_ACTIVE');
      if (quote.expiresAt <= new Date()) {
        quote.status = 'expired'; await quote.save({ session });
        throw new AppError('اعتبار Quote به پایان رسیده است.', 409, 'QUOTE_EXPIRED');
      }

      const wallet = await Wallet.findOne({ userId }).session(session);
      if (!wallet) throw new AppError('کیف پول پیدا نشد.', 404, 'WALLET_NOT_FOUND');
      const inventory = await OnlineInventory.findOne({ key: 'x' }).session(session);
      if (!inventory) throw new AppError('موجودی X نقرکس راه‌اندازی نشده است.', 503, 'ONLINE_INVENTORY_NOT_READY');
      const platformBalance = quote.side === 'sell'
        ? await PlatformBalance.findOne({ key: 'main' }).session(session) : null;

      const [trade] = await Trade.create([{
        userId, quoteId: quote._id, side: quote.side, xAmount: quote.xAmount,
        pricePer1000X: quote.pricePer1000X, grossToman: quote.grossToman,
        commissionPercent: quote.commissionPercent, commissionToman: quote.commissionToman,
        finalToman: quote.finalToman, status: 'pending'
      }], { session });

      const accounts = await loadAccounts(userId, session);
      let inventoryType;
      let ledgerEntries;
      const beforeX = inventory.availableX;

      if (quote.side === 'buy') {
        if (inventory.availableX < quote.xAmount) throw new AppError('موجودی X نقرکس کافی نیست.', 409, 'INSUFFICIENT_PLATFORM_X');
        if (wallet.toman.available < quote.finalToman) throw new AppError('موجودی تومانی کاربر کافی نیست.', 409, 'INSUFFICIENT_TOMAN_BALANCE');
        wallet.toman.available -= quote.finalToman;
        wallet.x.available += quote.xAmount;
        inventory.availableX -= quote.xAmount;
        // A wallet purchase recognizes revenue; it does not create cash or fund buybacks.
        inventoryType = 'trade_buy';
        ledgerEntries = [
          { accountId: accounts.userToman._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.DEBIT, amount: quote.finalToman },
          { accountId: accounts.SILVER_SALES._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.grossToman },
          { accountId: accounts.platformX._id, asset: ASSETS.X, direction: LEDGER_DIRECTIONS.DEBIT, amount: quote.xAmount },
          { accountId: accounts.userX._id, asset: ASSETS.X, direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.xAmount }
        ];
        if (quote.commissionToman > 0) ledgerEntries.push({
          accountId: accounts.BUY_COMMISSION._id, asset: ASSETS.TOMAN,
          direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.commissionToman
        });
      } else {
        if (wallet.x.available < quote.xAmount) throw new AppError('موجودی X کاربر کافی نیست.', 409, 'INSUFFICIENT_USER_X');
        const budget = platformBalance?.buybackAvailableToman ?? 0;
        if (budget < quote.finalToman) throw new AppError('بودجه مستقل بازخرید نقره کافی نیست.', 409, 'INSUFFICIENT_BUYBACK_BUDGET');
        wallet.x.available -= quote.xAmount;
        wallet.toman.available += quote.finalToman;
        inventory.availableX += quote.xAmount;
        platformBalance.buybackAvailableToman = budget - quote.finalToman;
        // Earmark the net proceeds for the user's wallet withdrawal, once only.
        platformBalance.tomanAvailable += quote.finalToman;
        inventoryType = 'trade_sell';
        ledgerEntries = [
          { accountId: accounts.userX._id, asset: ASSETS.X, direction: LEDGER_DIRECTIONS.DEBIT, amount: quote.xAmount },
          { accountId: accounts.platformX._id, asset: ASSETS.X, direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.xAmount },
          { accountId: accounts.SILVER_PURCHASES._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.DEBIT, amount: quote.grossToman },
          { accountId: accounts.userToman._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.finalToman },
          { accountId: accounts.BUYBACK_BUDGET._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.DEBIT, amount: quote.finalToman },
          { accountId: accounts.BUYBACK_SETTLEMENT._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.finalToman }
        ];
        if (quote.commissionToman > 0) ledgerEntries.push({
          accountId: accounts.SELL_COMMISSION._id, asset: ASSETS.TOMAN,
          direction: LEDGER_DIRECTIONS.CREDIT, amount: quote.commissionToman
        });
      }

      inventory.version += 1;
      await wallet.save({ session });
      await inventory.save({ session });
      if (platformBalance) await platformBalance.save({ session });
      const ledgerTx = await postLedgerTransaction({
        type: quote.side === 'buy' ? 'x_buy' : 'x_sell', referenceType: 'trade', referenceId: trade._id,
        idempotencyKey: `TRADE:${trade._id}`,
        metadata: { quoteId: String(quote._id), accountingVersion: 2, side: quote.side,
          xAmount: quote.xAmount, grossToman: quote.grossToman,
          commissionToman: quote.commissionToman, finalToman: quote.finalToman,
          buybackSpentToman: quote.side === 'sell' ? quote.finalToman : 0 }, entries: ledgerEntries
      }, session);
      const [inventoryTx] = await XInventoryTransaction.create([{
        type: inventoryType, amountX: quote.xAmount, beforeX, afterX: inventory.availableX,
        reason: quote.side === 'buy' ? 'فروش X به کاربر' : 'خرید X از کاربر', actorType: 'system',
        referenceType: 'trade', referenceId: trade._id, idempotencyKey: `TRADE_X:${trade._id}`
      }], { session });

      trade.status = 'completed'; trade.ledgerTransactionId = ledgerTx._id; trade.inventoryTransactionId = inventoryTx._id; trade.executedAt = new Date();
      quote.status = 'used'; quote.usedAt = new Date();
      await trade.save({ session });
      await quote.save({ session });
      result = trade;
    });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Trade.findOne({ userId, quoteId, status: 'completed' });
      if (existing) return existing;
    }
    throw error;
  } finally { await session.endSession(); }
}

export async function listUserTrades(userId, { page = 1, limit = 50 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1); const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const [items, total] = await Promise.all([
    Trade.find({ userId }).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    Trade.countDocuments({ userId })
  ]);
  return { page: safePage, perPage: safeLimit, total, totalPages: Math.ceil(total / safeLimit), items };
}

export async function listAllTrades({ page = 1, limit = 50, side = null, status = null } = {}) {
  const safePage=Math.max(Number(page)||1,1); const safeLimit=Math.min(Math.max(Number(limit)||50,1),100);
  const filter={}; if(side) filter.side=side; if(status) filter.status=status;
  const [items,total]=await Promise.all([Trade.find(filter).sort({createdAt:-1}).skip((safePage-1)*safeLimit).limit(safeLimit).populate('userId','firstname lastname phoneNumber').lean(),Trade.countDocuments(filter)]);
  return {page:safePage,perPage:safeLimit,total,totalPages:Math.ceil(total/safeLimit),items};
}
export async function getTradeSummary(){
  const rows=await Trade.aggregate([{$match:{status:'completed'}},{$group:{_id:'$side',count:{$sum:1},xAmount:{$sum:'$xAmount'},grossToman:{$sum:'$grossToman'},commissionToman:{$sum:'$commissionToman'},finalToman:{$sum:'$finalToman'}}}]);
  // Keep buy/sell keys in the existing USER perspective and explicitly label the platform side.
  return Object.fromEntries(['buy', 'sell'].map(side => {
    const row = rows.find(r => r._id === side) || { count: 0, xAmount: 0, grossToman: 0, commissionToman: 0, finalToman: 0 };
    return [side, {
      platformSide: side === 'buy' ? 'sale_to_user' : 'purchase_from_user',
      count: row.count, xAmount: row.xAmount, grams: row.xAmount / 1000,
      grossToman: row.grossToman, commissionToman: row.commissionToman, finalToman: row.finalToman
    }];
  }));
}
