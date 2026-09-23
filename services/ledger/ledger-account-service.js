import { LedgerAccount } from '../../models/ledger/ledger-account-model.js';
import { ASSETS, BALANCE_TYPES, LEDGER_OWNER_TYPES, PLATFORM_ACCOUNT_TYPES } from '../../constants/financial.js';

export async function ensurePlatformFinancialAccount(balanceType, session = null) {
  if (!Object.values(PLATFORM_ACCOUNT_TYPES).includes(balanceType)) throw new Error('Invalid platform financial account');
  const filter = { ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.TOMAN, balanceType };
  await LedgerAccount.updateOne(filter, { $setOnInsert: { ...filter, status: 'active' } }, { upsert: true, session });
  return LedgerAccount.findOne(filter).session(session);
}

export async function ensureUserLedgerAccounts(userId, session = null) {
  const specs = [
    [ASSETS.TOMAN, BALANCE_TYPES.AVAILABLE],
    [ASSETS.TOMAN, BALANCE_TYPES.LOCKED],
    [ASSETS.X, BALANCE_TYPES.AVAILABLE],
    [ASSETS.X, BALANCE_TYPES.LOCKED]
  ];

  for (const [asset, balanceType] of specs) {
    await LedgerAccount.updateOne(
      { ownerType: LEDGER_OWNER_TYPES.USER, ownerId: userId, asset, balanceType },
      { $setOnInsert: { ownerType: LEDGER_OWNER_TYPES.USER, ownerId: userId, asset, balanceType, status: 'active' } },
      { upsert: true, session }
    );
  }
}

export async function ensurePlatformTomanAccount(session = null) {
  await LedgerAccount.updateOne(
    { ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.TOMAN, balanceType: BALANCE_TYPES.AVAILABLE },
    { $setOnInsert: { ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.TOMAN, balanceType: BALANCE_TYPES.AVAILABLE, status: 'active' } },
    { upsert: true, session }
  );
  return LedgerAccount.findOne({ ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.TOMAN, balanceType: BALANCE_TYPES.AVAILABLE }).session(session);
}

export async function getUserLedgerAccount(userId, asset, balanceType, session = null) {
  return LedgerAccount.findOne({ ownerType: LEDGER_OWNER_TYPES.USER, ownerId: userId, asset, balanceType, status: 'active' }).session(session);
}


export async function ensurePlatformXAccount(session = null) {
  await LedgerAccount.updateOne(
    { ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.X, balanceType: BALANCE_TYPES.AVAILABLE },
    { $setOnInsert: { ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.X, balanceType: BALANCE_TYPES.AVAILABLE, status: 'active' } },
    { upsert: true, session }
  );
  return LedgerAccount.findOne({ ownerType: LEDGER_OWNER_TYPES.PLATFORM, ownerId: null, asset: ASSETS.X, balanceType: BALANCE_TYPES.AVAILABLE }).session(session);
}
