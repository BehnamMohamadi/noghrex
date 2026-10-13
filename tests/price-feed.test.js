import {before,beforeEach,after,test} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import {startIsolatedMongo} from './helpers/mongo.js';
import {setProviderOnlinePrice,setManualOnlinePrice,getCurrentOnlinePrice} from '../services/silver/online/online-price-service.js';
import {recordFeedFailure,captureSilverMarketPrice,updateSilverFeedSettings} from '../services/silver/online/silver-price-feed-service.js';
import {createQuote} from '../services/silver/online/quote-service.js';
import {executeTrade,getTradeSummary} from '../services/silver/online/trade-service.js';
import {createWalletForUser} from '../services/wallet/wallet-service.js';
import {Wallet} from '../models/wallet/wallet-model.js';
import {OnlineInventory} from '../models/silver/online/online-inventory-model.js';
import {PlatformBalance} from '../models/platform/platform-balance-model.js';
import {PriceFeedState} from '../models/silver/online/price-feed-state-model.js';
import {SystemSetting} from '../models/settings/system-setting-model.js';
import {SystemAlert} from '../models/system/system-alert-model.js';
import {LedgerAccount} from '../models/ledger/ledger-account-model.js';
import {LedgerEntry} from '../models/ledger/ledger-entry-model.js';
let mongo,userId,adminId;
before(async()=>{process.env.NODE_ENV='test';mongo=await startIsolatedMongo();await mongoose.connect(mongo.uri);for(const m of Object.values(mongoose.models))await m.init();});
after(async()=>{await mongoose.disconnect();await mongo?.stop();});
beforeEach(async()=>{for(const m of Object.values(mongoose.models))await m.deleteMany({});userId=new mongoose.Types.ObjectId();adminId=new mongoose.Types.ObjectId();await createWalletForUser(userId);await Wallet.updateOne({userId},{$set:{'toman.available':1000000,'x.available':2000}});await OnlineInventory.create({key:'x',availableX:10000});await PlatformBalance.create({key:'main',buybackAvailableToman:1000000});await setProviderOnlinePrice({providerName:'servix',basePricePer1000X:100000});});
test('API base, independent spread and commissions settle in balanced separate accounts',async()=>{
 const buy=await createQuote(userId,{side:'buy',xAmount:1000});assert.equal(buy.finalToman,101000);await executeTrade(userId,buy._id);
 const sell=await createQuote(userId,{side:'sell',xAmount:1000});assert.equal(sell.grossToman,98000);assert.equal(sell.spreadToman,2000);assert.equal(sell.commissionToman,980);assert.equal(sell.finalToman,97020);
 const trade=await executeTrade(userId,sell._id);assert.equal(String((await executeTrade(userId,sell._id))._id),String(trade._id));
 const account=await LedgerAccount.findOne({balanceType:'buyback_spread'});const entries=await LedgerEntry.find({accountId:account._id});assert.equal(entries.reduce((n,e)=>n+e.amount,0),2000);
 const summary=await getTradeSummary();assert.equal(summary.sell.spreadToman,2000);assert.equal(summary.sell.commissionToman,980);
});
test('fifth failed cycle blocks both new quotes and settlement; manual fallback survives failures; API recovers',async()=>{
 const quote=await createQuote(userId,{side:'buy',xAmount:1000});
 for(let i=0;i<4;i++)await recordFeedFailure();assert.equal((await getCurrentOnlinePrice()).status,'active');
 await recordFeedFailure();await assert.rejects(()=>getCurrentOnlinePrice(),{code:'ONLINE_PRICE_UNAVAILABLE'});await assert.rejects(()=>executeTrade(userId,quote._id),{code:'ONLINE_PRICE_UNAVAILABLE'});
 await recordFeedFailure();assert.equal(await SystemAlert.countDocuments({status:'open'}),1);
 await setManualOnlinePrice({adminId,basePricePer1000X:200000});await recordFeedFailure();assert.equal((await getCurrentOnlinePrice()).buyPricePer1000X,196000);
 await assert.rejects(()=>executeTrade(userId,quote._id),{code:'QUOTE_NOT_ACTIVE'});
 await setProviderOnlinePrice({providerName:'servix',basePricePer1000X:150000});assert.equal((await getCurrentOnlinePrice()).manualOverride,false);assert.equal((await PriceFeedState.findOne()).consecutiveFailures,0);
});
test('discount settings update prices and reject stale settings revisions',async()=>{
 await updateSilverFeedSettings({enabled:true,provider:'servix',intervalSeconds:21600,dailyRequestLimit:50,buybackDiscountPercent:3},adminId,0);
 assert.equal((await getCurrentOnlinePrice()).buyPricePer1000X,97000);
 await assert.rejects(()=>updateSilverFeedSettings({},adminId,0),{code:'SETTINGS_VERSION_CONFLICT'});
});
test('invalid API data cannot reset a lock or overwrite the last price',async()=>{
 await SystemSetting.create({key:'silver_price_feed',value:{enabled:true}});
 const fetchBefore=globalThis.fetch,keyBefore=process.env.SERVIX_API_KEY;process.env.SERVIX_API_KEY='test-only';
 globalThis.fetch=async()=>({ok:true,json:async()=>({data:{price:0}})});
 try{await assert.rejects(()=>captureSilverMarketPrice());assert.equal((await getCurrentOnlinePrice()).sellPricePer1000X,100000);}finally{globalThis.fetch=fetchBefore;if(keyBefore===undefined)delete process.env.SERVIX_API_KEY;else process.env.SERVIX_API_KEY=keyBefore;}
});
