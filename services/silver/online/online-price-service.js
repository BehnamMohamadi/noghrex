import { startFinancialSession } from '../../../utils/financial-session.js';
import mongoose from 'mongoose';
import { OnlinePrice } from '../../../models/silver/online/online-price-model.js';
import { OnlinePriceHistory } from '../../../models/silver/online/online-price-history-model.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAudit } from '../../audit/audit-service.js';
import { createSystemAlert } from '../../system/system-alert-service.js';
import { SystemSetting } from '../../../models/settings/system-setting-model.js';
import { PriceFeedState } from '../../../models/silver/online/price-feed-state-model.js';
import { floorProduct } from '../../../utils/money.js';
import { Quote } from '../../../models/silver/online/quote-model.js';
import { SystemAlert } from '../../../models/system/system-alert-model.js';

export async function priceFromBase(basePricePer1000X, session = null) {
  if (!Number.isSafeInteger(basePricePer1000X) || basePricePer1000X <= 0) throw new AppError('قیمت مبنا معتبر نیست.',400,'INVALID_ONLINE_PRICE');
  const config = await SystemSetting.findOne({key:'silver_price_feed'}).session(session).lean();
  const buybackDiscountPercent = config?.value?.buybackDiscountPercent ?? 2;
  return { referencePricePer1000X:basePricePer1000X, sellPricePer1000X:basePricePer1000X,
    buyPricePer1000X:basePricePer1000X-floorProduct(basePricePer1000X,buybackDiscountPercent,100), buybackDiscountPercent };
}

export async function assertTradingPrice(session = null) {
  const state = await PriceFeedState.findOne({key:'servix'}).session(session).lean();
  const price = await OnlinePrice.findOne({key:'current'}).session(session).lean();
  if ((state?.locked && !price?.manualOverride) || (price && price.status !== 'active'))
    throw new AppError('معاملات به علت اختلال دریافت قیمت متوقف است؛ منتظر ثبت قیمت معتبر توسط مدیر باشید.',503,'ONLINE_PRICE_UNAVAILABLE');
  // Writes fence a concurrent lock/manual-price change against settlement.
  if(session){
    if(state) await PriceFeedState.updateOne({_id:state._id},{$inc:{guard:1}},{session});
    if(price) await OnlinePrice.updateOne({_id:price._id},{$inc:{guard:1}},{session});
  }
}

export async function getCurrentOnlinePrice({ requireActive = true } = {}) {
  if(requireActive) await assertTradingPrice();
  const price = await OnlinePrice.findOne({ key: 'current' }).lean();
  if (!price) throw new AppError('قیمت آنلاین X هنوز تعیین نشده است.', 503, 'ONLINE_PRICE_NOT_SET');
  if (requireActive && price.status !== 'active') throw new AppError('قیمت آنلاین X در حال حاضر معتبر نیست.', 503, 'ONLINE_PRICE_UNAVAILABLE');
  return price;
}

export async function setManualOnlinePrice({ adminId, basePricePer1000X, buyPricePer1000X, sellPricePer1000X }) {
  const feed = await SystemSetting.findOne({key:'silver_price_feed'}).lean();
  const calculated = (basePricePer1000X != null || feed?.value?.enabled)
    ? await priceFromBase(basePricePer1000X ?? sellPricePer1000X) : {};
  buyPricePer1000X = calculated.buyPricePer1000X ?? buyPricePer1000X;
  sellPricePer1000X = calculated.sellPricePer1000X ?? sellPricePer1000X;
  for (const [field, value] of Object.entries({ buyPricePer1000X, sellPricePer1000X })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new AppError(`${field} باید عدد صحیح مثبت باشد.`, 400, 'INVALID_ONLINE_PRICE');
  }
  const session = await startFinancialSession();
  try {
    let price;
    await session.withTransaction(async () => {
      const now = new Date();
      price = await OnlinePrice.findOneAndUpdate(
        { key: 'current' },
        { $set: { ...calculated, buyPricePer1000X, sellPricePer1000X, manualOverride:true, source: 'manual', providerName: null, providerReference: null, status: 'active', effectiveAt: now, updatedBy: adminId } },
        { upsert: true, new: true, runValidators: true, session }
      );
      await OnlinePriceHistory.create([{ buyPricePer1000X, sellPricePer1000X, source: 'manual', effectiveAt: now, changedBy: adminId }], { session });
      await Quote.updateMany({status:'active'},{$set:{status:'cancelled'}},{session});
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

export async function setProviderOnlinePrice({ providerName, providerReference = null, basePricePer1000X, buyPricePer1000X, sellPricePer1000X }) {
  const calculated = basePricePer1000X != null ? await priceFromBase(basePricePer1000X) : {};
  buyPricePer1000X = calculated.buyPricePer1000X ?? buyPricePer1000X;
  sellPricePer1000X = calculated.sellPricePer1000X ?? sellPricePer1000X;
  for (const [field, value] of Object.entries({ buyPricePer1000X, sellPricePer1000X })) {
    if (!Number.isSafeInteger(value) || value <= 0) throw new AppError(`${field} باید عدد صحیح مثبت باشد.`, 400, 'INVALID_ONLINE_PRICE');
  }
  const session = await startFinancialSession();
  try {
    let price;
    await session.withTransaction(async () => {
      const now = new Date();
      price = await OnlinePrice.findOneAndUpdate({ key:'current' }, { $set:{ ...calculated, manualOverride:false, buyPricePer1000X, sellPricePer1000X, source:'provider', providerName, providerReference, status:'active', effectiveAt:now, updatedBy:null } }, { upsert:true,new:true,runValidators:true,session });
      await PriceFeedState.updateOne({key:'servix'},{$set:{locked:false,consecutiveFailures:0,lastError:null,lastSuccessAt:now}},{upsert:true,session});
      await SystemAlert.updateMany({type:'online_price_provider_down',status:'open'},{$set:{status:'resolved',resolvedAt:now}},{session});
      await OnlinePriceHistory.create([{ buyPricePer1000X, sellPricePer1000X, source:'provider', providerName, providerReference, effectiveAt:now, changedBy:null }], { session });
    });
    return price;
  } finally { await session.endSession(); }
}
