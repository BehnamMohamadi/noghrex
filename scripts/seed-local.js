import { startLocalDatabase, LOCAL_URI } from './local-database.js';
import mongoose from 'mongoose';
if (process.env.NODE_ENV === 'production') throw new Error('Local seed is disabled in production');
await startLocalDatabase();
process.env.NODE_ENV = 'development'; process.env.MONGODB_URI = LOCAL_URI;
await import('../app.js');
const { User } = await import('../models/account/user-model.js');
const { createWalletForUser } = await import('../services/wallet/wallet-service.js');
const { ensurePlatformBalance } = await import('../services/platform/platform-balance-service.js');
const { ensureOnlineInventory } = await import('../services/silver/online/online-inventory-service.js');
await mongoose.connect(LOCAL_URI);
try {
  for (const model of Object.values(mongoose.models)) await model.init();
  for (const [phoneNumber, role] of [['09120000001', 'admin'], ['09120000002', 'user']]) {
    let user = await User.findOne({ phoneNumber });
    if (!user) user = await User.create({ firstname: 'تست', lastname: role, phoneNumber, role, password: 'NoghrexLocal!2026', phoneVerifiedAt: new Date() });
    await createWalletForUser(user._id);
  }
  await ensurePlatformBalance(); await ensureOnlineInventory();
  console.log('Local test accounts ready: admin 09120000001, user 09120000002. Password for newly created accounts: NoghrexLocal!2026');
} finally { await mongoose.disconnect(); }
