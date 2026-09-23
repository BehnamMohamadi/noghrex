import { Wallet } from '../../models/wallet/wallet-model.js';
import { AppError } from '../../errors/app-error.js';
import { ensureUserLedgerAccounts } from '../ledger/ledger-account-service.js';

export async function createWalletForUser(userId, session = null) {
  const existing = await Wallet.findOne({ userId }).session(session);
  if (existing) return existing;

  const [wallet] = await Wallet.create([{ userId }], { session });
  await ensureUserLedgerAccounts(userId, session);
  return wallet;
}

export async function getWalletForUser(userId) {
  const wallet = await Wallet.findOne({ userId }).lean();
  if (!wallet) throw new AppError('کیف پول کاربر پیدا نشد.', 404, 'WALLET_NOT_FOUND');
  return wallet;
}
