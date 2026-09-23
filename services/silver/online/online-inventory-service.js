import mongoose from 'mongoose';
import { OnlineInventory } from '../../../models/silver/online/online-inventory-model.js';
import { XInventoryTransaction } from '../../../models/silver/online/x-inventory-transaction-model.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAudit } from '../../audit/audit-service.js';

export async function ensureOnlineInventory(session = null) {
  let inventory = await OnlineInventory.findOne({ key: 'x' }).session(session);
  if (!inventory) [inventory] = await OnlineInventory.create([{ key: 'x', availableX: 0 }], { session });
  return inventory;
}

export async function getOnlineInventory() {
  const inventory = await ensureOnlineInventory();
  return { availableX: inventory.availableX, updatedAt: inventory.updatedAt };
}

export async function adjustOnlineInventory({ adminId, type, amountX, reason, idempotencyKey }) {
  if (!Number.isSafeInteger(amountX) || amountX <= 0) throw new AppError('مقدار X باید عدد صحیح مثبت باشد.', 400, 'INVALID_X_AMOUNT');
  if (!['increase', 'decrease'].includes(type)) throw new AppError('نوع سند موجودی نامعتبر است.', 400, 'INVALID_INVENTORY_ADJUSTMENT_TYPE');
  if (!reason?.trim()) throw new AppError('دلیل تغییر موجودی الزامی است.', 400, 'INVENTORY_REASON_REQUIRED');
  if (!idempotencyKey?.trim()) throw new AppError('کلید یکتای سند الزامی است.', 400, 'IDEMPOTENCY_KEY_REQUIRED');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existing = await XInventoryTransaction.findOne({ idempotencyKey: idempotencyKey.trim() }).session(session);
      if (existing) { if(existing.type!==type||existing.amountX!==amountX||existing.reason!==reason.trim()||String(existing.actorId)!==String(adminId))throw new AppError('کلید تکرار متفاوت است.',409,'IDEMPOTENCY_CONFLICT'); result = existing; return; }
      const inventory = await ensureOnlineInventory(session);
      const beforeX = inventory.availableX;
      const afterX = type === 'increase' ? beforeX + amountX : beforeX - amountX;
      if (afterX < 0) throw new AppError('موجودی X نقرکس برای این کاهش کافی نیست.', 409, 'INSUFFICIENT_PLATFORM_X');
      inventory.availableX = afterX;
      inventory.version += 1;
      await inventory.save({ session });
      [result] = await XInventoryTransaction.create([{
        type, amountX, beforeX, afterX, reason: reason.trim(), actorType: 'admin', actorId: adminId,
        referenceType: 'admin_adjustment', idempotencyKey: idempotencyKey.trim()
      }], { session });
      await writeAudit({ actorType: 'admin', actorId: adminId, action: 'ADMIN_ADJUSTED_X_INVENTORY', entityType: 'XInventoryTransaction', entityId: result._id, metadata: { type, amountX, beforeX, afterX, reason: reason.trim() } }, session);
    });
    return result;
  } finally { await session.endSession(); }
}

export async function listInventoryTransactions({ page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    XInventoryTransaction.find().sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    XInventoryTransaction.countDocuments()
  ]);
  return { page: safePage, perPage: safeLimit, total, totalPages: Math.ceil(total / safeLimit), items };
}
