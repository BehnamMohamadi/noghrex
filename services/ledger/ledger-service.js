import mongoose from 'mongoose';
import { LedgerAccount } from '../../models/ledger/ledger-account-model.js';
import { LedgerTransaction } from '../../models/ledger/ledger-transaction-model.js';
import { LedgerEntry } from '../../models/ledger/ledger-entry-model.js';
import { AppError } from '../../errors/app-error.js';
import { LEDGER_DIRECTIONS, LEDGER_TRANSACTION_STATUSES } from '../../constants/financial.js';

function assertSafePositiveInteger(value, field = 'amount') {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new AppError(`${field} باید یک عدد صحیح مثبت باشد.`, 400, 'INVALID_LEDGER_AMOUNT');
  }
}

function validateBalancedEntries(entries) {
  const totals = new Map();
  for (const entry of entries) {
    assertSafePositiveInteger(entry.amount);
    if (![LEDGER_DIRECTIONS.DEBIT, LEDGER_DIRECTIONS.CREDIT].includes(entry.direction)) throw new AppError('جهت سند معتبر نیست.', 400, 'INVALID_LEDGER_DIRECTION');
    const current = totals.get(entry.asset) || { debit: 0n, credit: 0n };
    current[entry.direction] += BigInt(entry.amount);
    totals.set(entry.asset, current);
  }
  for (const [asset, total] of totals) {
    if (total.debit !== total.credit) {
      throw new AppError(`Ledger entries for ${asset} are not balanced.`, 500, 'UNBALANCED_LEDGER_TRANSACTION');
    }
  }
}

export async function postLedgerTransaction({ type, referenceType, referenceId = null, idempotencyKey, metadata = null, entries }, externalSession = null) {
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new AppError('حداقل دو ردیف حسابداری لازم است.', 400, 'INVALID_LEDGER_ENTRIES');
  }
  validateBalancedEntries(entries);

  const ownsSession = !externalSession;
  const session = externalSession || await mongoose.startSession();

  const execute = async () => {
    const existing = await LedgerTransaction.findOne({ idempotencyKey }).session(session);
    if (existing) return existing;

    const accountIds = [...new Set(entries.map(e => String(e.accountId)))];
    const accounts = await LedgerAccount.find({ _id: { $in: accountIds }, status: 'active' }).session(session);
    if (accounts.length !== accountIds.length) {
      throw new AppError('یکی از حساب‌های Ledger معتبر یا فعال نیست.', 409, 'LEDGER_ACCOUNT_UNAVAILABLE');
    }

    const accountMap = new Map(accounts.map(a => [String(a._id), a]));
    for (const entry of entries) {
      const account = accountMap.get(String(entry.accountId));
      if (!account || account.asset !== entry.asset) {
        throw new AppError('دارایی Ledger Entry با حساب مربوطه مطابقت ندارد.', 500, 'LEDGER_ASSET_MISMATCH');
      }
      if (![LEDGER_DIRECTIONS.DEBIT, LEDGER_DIRECTIONS.CREDIT].includes(entry.direction)) {
        throw new AppError('جهت Ledger Entry نامعتبر است.', 400, 'INVALID_LEDGER_DIRECTION');
      }
    }

    const [transaction] = await LedgerTransaction.create([{
      type, referenceType, referenceId, idempotencyKey, metadata,
      status: LEDGER_TRANSACTION_STATUSES.POSTED,
      postedAt: new Date()
    }], { session });

    await LedgerEntry.insertMany(entries.map(entry => ({ ...entry, transactionId: transaction._id })), { session });
    return transaction;
  };

  try {
    if (ownsSession) {
      let result;
      await session.withTransaction(async () => { result = await execute(); });
      return result;
    }
    return execute();
  } finally {
    if (ownsSession) await session.endSession();
  }
}
