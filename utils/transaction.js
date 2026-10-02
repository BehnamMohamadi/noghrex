import { startFinancialSession } from './financial-session.js';
import mongoose from 'mongoose';
export async function transaction(work) {
  const session = await startFinancialSession();
  try { let result; await session.withTransaction(async () => { result = await work(session); }); return result; }
  finally { await session.endSession(); }
}
