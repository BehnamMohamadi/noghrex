import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
export async function ensurePlatformBalance(session = null) {
  let balance = await PlatformBalance.findOne({ key: 'main' }).session(session);
  if (!balance) [balance] = await PlatformBalance.create([{ key: 'main', tomanAvailable: 0 }], { session });
  return balance;
}
