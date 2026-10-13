import { SilverMarketPrice } from '../../../models/silver/online/silver-market-price-model.js';
import { SystemSetting } from '../../../models/settings/system-setting-model.js';
import { AppError } from '../../../errors/app-error.js';
import { PriceFeedState } from '../../../models/silver/online/price-feed-state-model.js';
import { OnlinePrice } from '../../../models/silver/online/online-price-model.js';
import { Quote } from '../../../models/silver/online/quote-model.js';
import { SystemAlert } from '../../../models/system/system-alert-model.js';
import { setProviderOnlinePrice, priceFromBase } from './online-price-service.js';
import { transaction } from '../../../utils/transaction.js';
import { writeAudit } from '../../audit/audit-service.js';

const KEY = 'silver_price_feed';
const OUNCE_GRAMS = 31.1034768;
export const DEFAULT_SILVER_FEED_SETTINGS = Object.freeze({ enabled: false, provider: 'servix', intervalSeconds: 21600, dailyRequestLimit: 50, buybackDiscountPercent:2 });

const tehranParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
}).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
const tehranDay = date => { const p = tehranParts(date); return `${p.year}-${p.month}-${p.day}`; };

export async function getSilverFeedSettingsSnapshot() {
  const doc = await SystemSetting.findOne({ key: KEY }).lean();
  return { settings: { ...DEFAULT_SILVER_FEED_SETTINGS, ...(doc?.value || {}) }, revision: doc?.revision || 0 };
}

export async function updateSilverFeedSettings(value, adminId, expectedRevision) {
  return transaction(async session => {
  const before = await SystemSetting.findOne({ key: KEY }).session(session).lean();
  if (expectedRevision !== (before?.revision || 0)) throw new AppError('تنظیمات قیمت توسط مدیر دیگری تغییر کرده است.', 409, 'SETTINGS_VERSION_CONFLICT');
  const result = await SystemSetting.findOneAndUpdate({ key: KEY, ...(before?{revision:expectedRevision}:{}) }, { $set: { value, updatedBy: adminId, revision: (before?.revision || 0) + 1 } }, { upsert: !before, new: true, runValidators: true, session });
  if(!result) throw new AppError('تنظیمات هم‌زمان تغییر کرده است.',409,'SETTINGS_VERSION_CONFLICT');
  const state=await PriceFeedState.findOne({key:'servix'}).session(session).lean();
  if(state?.lastAttemptAt) await PriceFeedState.updateOne({_id:state._id},{$set:{nextAttemptAt:new Date(+new Date(state.lastAttemptAt)+value.intervalSeconds*1000)}},{session});
  const price = await OnlinePrice.findOne({key:'current'}).session(session).lean();
  if(price?.referencePricePer1000X) await OnlinePrice.updateOne({_id:price._id,effectiveAt:price.effectiveAt},{$set:await priceFromBase(price.referencePricePer1000X,session)},{session});
  await Quote.updateMany({status:'active'},{$set:{status:'cancelled'}},{session});
  await writeAudit({actorType:'admin',actorId:adminId,action:'SILVER_FEED_SETTINGS_CHANGED',entityType:'SystemSetting',entityId:result._id,metadata:{before:before?.value,after:value}},session);
  return result;
  });
}

function marketValue(payload) {
  const body = payload?.data ?? payload;
  const candidates = [body?.sellPrice, body?.midPrice, body?.price, body?.value, body?.last, body?.close];
  const value = candidates.filter(x=>x!=null&&x!=='').map(Number).find(v=>Number.isFinite(v)&&v>0);
  if (!(value > 0)) throw new Error('پاسخ سرویکس فاقد قیمت معتبر است.');
  return value;
}

async function servixAsset(code, apiKey) {
  const response = await fetch(`https://servix.cc/api/v1/assets/${code}`, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`سرویکس با وضعیت ${response.status} پاسخ داد.`);
  return response.json();
}

export async function captureSilverMarketPrice(now = new Date()) {
  const { settings } = await getSilverFeedSettingsSnapshot();
  if (!settings.enabled) return null;
  const apiKey = process.env.SERVIX_API_KEY;
  if (!apiKey) throw new Error('کلید SERVIX_API_KEY تنظیم نشده است.');
  const [silver, usd] = await Promise.all([servixAsset('SILVER_OUNCE_USD', apiKey), servixAsset('USD_RLS', apiKey)]);
  const silverOunceUsd = marketValue(silver), usdRial = marketValue(usd);
  const silverGramToman = Math.round((silverOunceUsd * usdRial / 10) / OUNCE_GRAMS);
  if(!Number.isSafeInteger(silverGramToman)||silverGramToman<=0) throw new Error('قیمت محاسبه‌شده معتبر نیست.');
  const point = await SilverMarketPrice.findOneAndUpdate(
    { provider: 'servix', sampledAt: now },
    { $setOnInsert: { provider: 'servix', sampledAt: now, tehranDay: tehranDay(now), granularity: 'intraday', silverOunceUsd, usdRial, silverGramToman, providerTimestamp: now, providerReferences: ['SILVER_OUNCE_USD', 'USD_RLS'] } },
    { upsert: true, new: true }
  );
  await setProviderOnlinePrice({providerName:'servix',providerReference:String(point._id),basePricePer1000X:silverGramToman});
  await SystemAlert.updateMany({type:'online_price_provider_down',status:'open'},{$set:{status:'resolved',resolvedAt:new Date()}});
  return point;
}

export async function recordFeedFailure(message='دریافت قیمت معتبر از سرویکس ناموفق بود.') {
  return transaction(async session=>{
    const state=await PriceFeedState.findOneAndUpdate({key:'servix'},{$inc:{consecutiveFailures:1},$set:{lastError:message.slice(0,300)}},{upsert:true,new:true,session});
    if(state.consecutiveFailures>=5){
      state.locked=true; await state.save({session});
      await OnlinePrice.updateOne({key:'current',manualOverride:{$ne:true}},{$set:{status:'unavailable'}},{session});
      const price=await OnlinePrice.findOne({key:'current'}).session(session).lean();
      if(!price?.manualOverride) await Quote.updateMany({status:'active'},{$set:{status:'cancelled'}},{session});
      await SystemAlert.updateOne({type:'online_price_provider_down',status:'open'},{$set:{severity:'critical',title:'اختلال دریافت قیمت نقره',message:'پنج نوبت متوالی قیمت معتبر دریافت نشد. اتصال را بررسی کنید یا قیمت مبنا را دستی ثبت کنید.'}},{upsert:true,session});
    }
    return state;
  });
}

export async function compactFinishedDays(now = new Date()) {
  const today = tehranDay(now);
  const days = await SilverMarketPrice.distinct('tehranDay', { granularity: 'intraday', tehranDay: { $lt: today } });
  for (const day of days) {
    const last = await SilverMarketPrice.findOne({ tehranDay: day, granularity: 'intraday' }).sort({ sampledAt: -1 }).lean();
    if (!last) continue;
    await SilverMarketPrice.updateOne(
      { provider: last.provider, tehranDay: day, granularity: 'daily_close' },
      { $setOnInsert: {
        provider: last.provider, sampledAt: last.sampledAt, tehranDay: day, granularity: 'daily_close',
        silverOunceUsd: last.silverOunceUsd, usdRial: last.usdRial, silverGramToman: last.silverGramToman,
        providerTimestamp: last.providerTimestamp, providerReferences: last.providerReferences
      } },
      { upsert: true }
    );
    await SilverMarketPrice.deleteMany({ tehranDay: day, granularity: 'intraday' });
  }
}

export async function listSilverMarketChart({ range = 'day', source = 'auto' } = {}) {
  if(!['day','week','month','year'].includes(range)) throw new AppError('بازه نمودار معتبر نیست.',400,'INVALID_CHART_RANGE');
  const now=new Date(), days={day:1,week:7,month:31,year:365}[range];
  const demo=source!=='real' && !!(await DemoMarketPrice.exists({}));
  const model=demo?DemoMarketPrice:SilverMarketPrice;
  const filter={sampledAt:{$gte:new Date(+now-days*86400000),$lte:now}};
  if(!demo)filter.provider='servix';
  const points=await model.find(filter).sort({sampledAt:1}).select('sampledAt silverGramToman').lean();
  const selected=range==='day'?points:[...points.reduce((map,p)=>map.set(tehranDay(p.sampledAt),p),new Map()).values()];
  return selected.map(p=>({...p,isDemo:demo}));
}

export async function getSilverFeedStatus() {
  const [{ settings, revision }, latest, state, price] = await Promise.all([
    getSilverFeedSettingsSnapshot(),
    SilverMarketPrice.findOne().sort({ sampledAt: -1 }).lean(),
    PriceFeedState.findOne({key:'servix'}).lean(),
    OnlinePrice.findOne({key:'current'}).lean()
  ]);
  return { settings, revision, latest, state, manualOverride:!!price?.manualOverride, estimatedDailyRequests: Math.ceil(86400 / settings.intervalSeconds) * 2, apiKeyConfigured: Boolean(process.env.SERVIX_API_KEY) };
}

let timer = null, running = false, reschedule = () => {};
export function rescheduleSilverPriceFeed() { reschedule(); }
export function startSilverPriceFeed() {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const {settings}=await getSilverFeedSettingsSnapshot();
      if(settings.enabled){
        await PriceFeedState.updateOne({key:'servix'},{$setOnInsert:{key:'servix'}},{upsert:true});
        const now=new Date();
        const claimed=await PriceFeedState.findOneAndUpdate({key:'servix',$or:[{nextAttemptAt:{$lte:now}},{nextAttemptAt:{$exists:false}}]},{$set:{lastAttemptAt:now,nextAttemptAt:new Date(+now+settings.intervalSeconds*1000)}},{new:true});
        if(claimed){try{await captureSilverMarketPrice(now);}catch{await recordFeedFailure();}}
      }
      await compactFinishedDays();
    }
    catch { console.error('Silver price feed cycle failed.'); }
    finally { running = false; schedule(); }
  };
  const schedule = async () => {
    clearTimeout(timer);
    const { settings } = await getSilverFeedSettingsSnapshot().catch(() => ({ settings: DEFAULT_SILVER_FEED_SETTINGS }));
    timer = setTimeout(tick, 15000); timer.unref();
  };
  reschedule = schedule;
  tick();
  return () => clearTimeout(timer);
}
import { DemoMarketPrice } from '../../../models/silver/online/demo-market-price-model.js';
