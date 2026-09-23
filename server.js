import { app } from './app.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { ensurePlatformTomanAccount, ensurePlatformXAccount } from './services/ledger/ledger-account-service.js';
import { ensurePlatformBalance } from './services/platform/platform-balance-service.js';
import mongoose from 'mongoose';
import { ensureOnlineInventory } from './services/silver/online/online-inventory-service.js';
import { expirePayments } from './services/payment/payment-service.js';

async function bootstrap() {
  await connectDatabase();
  for (const model of Object.values(mongoose.models)) await model.init();
  await ensurePlatformTomanAccount();
  await ensurePlatformXAccount();
  await ensurePlatformBalance();
  await ensureOnlineInventory();
  const timer = setInterval(() => expirePayments().catch(error => console.error('Payment expiration failed:', error.message)), 15000); timer.unref();
  app.listen(env.port, () => console.log(`NOGHREX API listening on port ${env.port}`));
}

bootstrap().catch(error => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
