import mongoose from 'mongoose';
import { OnlinePrice } from '../../../models/silver/online/online-price-model.js';
import { OnlinePriceHistory } from '../../../models/silver/online/online-price-history-model.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAudit } from '../../audit/audit-service.js';
import { createSystemAlert } from '../../system/system-alert-service.js';

export async function getCurrentOnlinePrice({ requireActive = true } = {}) {
  const price = await OnlinePrice.findOne({ key: 'current' }).lean();
  if (!price) throw new AppError('قیمت آنلاین X هنوز تعیین نشده است.', 503, 'ONLINE_PRICE_NOT_SET');
  if (requireActive && price.status !== 'active') throw new AppError('قیمت آنلاین X در حال حاضر معتبر نیست.', 503, 'ONLINE_PRICE_UNAVAILABLE');
  return price;
}

export async function setManualOnlinePrice({ adminId, buyPricePer1000X, sellPricePer1000X }) {
  for (const [field, value] of Object.entries({ buyPricePer1000X, sellPricePer1000X })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new AppError(`${field} باید عدد صحیح مثبت باشد.`, 400, 'INVALID_ONLINE_PRICE');
  }
  const session = await mongoose.startSession();
  try {
    let price;
    await session.withTransaction(async () => {
      const now = new Date();
      price = await OnlinePrice.findOneAndUpdate(
        { key: 'current' },
        { $set: { buyPricePer1000X, sellPricePer1000X, source: 'manual', providerName: null, providerReference: null, status: 'active', effectiveAt: now, updatedBy: adminId } },
        { upsert: true, new: true, runValidators: true, session }
      );
      await OnlinePriceHistory.create([{ buyPricePer1000X, sellPricePer1000X, source: 'manual', effectiveAt: now, changedBy: adminId }], { session });
      await writeAudit({ actorType: 'admin', actorId: adminId, action: 'ADMIN_SET_MANUAL_ONLINE_PRICE', entityType: 'OnlinePrice', entityId: price._id, metadata: { buyPricePer1000X, sellPricePer1000X } }, session);
    });
    return price;
  } finally { await session.endSession(); }
}

export async function markOnlinePriceUnavailable({ reason = null } = {}) {
  const price = await OnlinePrice.findOneAndUpdate({ key: 'current' }, { $set: { status: 'unavailable' } }, { new: true });
  await createSystemAlert({ type:'online_price_provider_down', severity:'critical', title:'اختلال سرویس قیمت نقره آنلاین', message: reason || 'قیمت آنلاین معتبر در دسترس نیست؛ تا ثبت قیمت معتبر، Quote جدید صادر نمی‌شود.', metadata:{ lastPriceId: price?._id || null } });
  return price;
}

export async function listOnlinePriceHistory({ page = 1, limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    OnlinePriceHistory.find().sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    OnlinePriceHistory.countDocuments()
  ]);
  return { page: safePage, perPage: safeLimit, total, totalPages: Math.ceil(total / safeLimit), items };
}

export async function setProviderOnlinePrice({ providerName, providerReference = null, buyPricePer1000X, sellPricePer1000X }) {
  for (const [field, value] of Object.entries({ buyPricePer1000X, sellPricePer1000X })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new AppError(`${field} باید عدد صحیح مثبت باشد.`, 400, 'INVALID_ONLINE_PRICE');
  }
  const session = await mongoose.startSession();
  try {
    let price;
    await session.withTransaction(async () => {
      const now = new Date();
      price = await OnlinePrice.findOneAndUpdate({ key:'current' }, { $set:{ buyPricePer1000X, sellPricePer1000X, source:'provider', providerName, providerReference, status:'active', effectiveAt:now, updatedBy:null } }, { upsert:true,new:true,runValidators:true,session });
      await OnlinePriceHistory.create([{ buyPricePer1000X, sellPricePer1000X, source:'provider', providerName, providerReference, effectiveAt:now, changedBy:null }], { session });
    });
    return price;
  } finally { await session.endSession(); }
}
