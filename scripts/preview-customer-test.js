// Disposable UI test server. Uses a temporary replica set; never the project's .env database.
import mongoose from 'mongoose';
import { startIsolatedMongo } from '../tests/helpers/mongo.js';
const mongo=await startIsolatedMongo();
process.env.NODE_ENV='test';process.env.MONGODB_URI=mongo.uri;
process.env.JWT_SECRET='noghrex-disposable-ui-preview-only-secret';process.env.PORT='3012';process.env.CORS_ORIGINS='http://localhost:3012';process.env.PAYMENT_GATEWAY='mock';
const {app}=await import('../app.js');await mongoose.connect(mongo.uri);
for(const model of Object.values(mongoose.models))await model.init();
const m=mongoose.models,{createWalletForUser}=await import('../services/wallet/wallet-service.js'),{signAuthToken}=await import('../utils/auth-token.js');
const admin=await m.User.create({firstname:'مدیر',lastname:'آزمایشی',phoneNumber:'09121119991',password:'PreviewOnly!2026',role:'admin'});
const user=await m.User.create({firstname:'مشتری',lastname:'آزمایشی',phoneNumber:'09121119992',password:'PreviewOnly!2026',role:'user'});
await createWalletForUser(admin._id);await createWalletForUser(user._id);await m.PlatformBalance.create({key:'main'});await m.OnlineInventory.create({key:'x'});
const server=app.listen(3012,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const tokens={admin:signAuthToken(admin),user:signAuthToken(user)};
async function request(path,body,role='admin',method='POST'){const r=await fetch('http://127.0.0.1:3012/api'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tokens[role]},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(JSON.stringify(d));return d.data;}
await request('/admin/silver/online/price/manual',{buyPricePer1000X:95000,sellPricePer1000X:100000},'admin','PUT');
await request('/admin/silver/online/inventory/adjustments',{type:'increase',amountX:1000000,reason:'موجودی موقت تست رابط',idempotencyKey:'ui-preview-stock'});
await request('/admin/buyback-budget/adjustments',{type:'increase',amountToman:10000000,reason:'بودجه موقت تست رابط',idempotencyKey:'ui-preview-budget'});
await request('/admin/silver/physical/price',{pricePerGram:100000},'admin','PUT');
for(const [name,sku,weightGrams,img,category]of [['انگشتر ظریف — آزمایشی','QA-FINE',3,'jewelry-delicate.png','ظریف'],['دستبند جسور — آزمایشی','QA-BOLD',12,'jewelry-bold.png','درشت'],['شمش نقره — آزمایشی','QA-BAR',20,'silver-hero.png','شمش']]){
 const {product}=await request('/admin/silver/physical/products',{name,sku,slug:sku.toLowerCase(),weightGrams,images:['http://localhost:3012/assets/'+img],category,description:'این محصول فقط برای آزمون رابط کاربری در پایگاه داده موقت است.'});
 await request('/admin/silver/physical/products/'+product._id+'/inventory/adjustments',{type:'increase',quantity:10,reason:'موجودی آزمایشی',idempotencyKey:'ui-preview-'+sku});
}
await request('/admin/shipping-methods',{name:'ارسال آزمایشی',cost:50000});
await request('/account/addresses',{recipientName:'مشتری آزمایشی',phoneNumber:'09121119992',province:'تهران',city:'تهران',addressLine:'نشانی ساختگی برای تست رابط',postalCode:'1111111111'},'user');
const {deposit}=await request('/wallet/deposits',{method:'gateway',amount:5000000,idempotencyKey:'ui-preview-deposit'},'user');
const {payment}=await request('/payments',{purpose:'wallet_deposit',entityId:deposit._id},'user');
await request('/payments/'+payment._id+'/mock/verify',{outcome:'success'},'user');
console.log('Disposable preview ready: http://localhost:3012/ | user 09121119992 | password PreviewOnly!2026');
let closing=false;
async function stop(){if(closing)return;closing=true;await new Promise(r=>server.close(r));await mongoose.disconnect();await mongo.stop();process.exit(0);}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
