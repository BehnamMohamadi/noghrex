import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

// Local-only, additive fixture set. Real balances are never directly edited.
const uri=process.env.MONGODB_URI, target=new URL(uri||'mongodb://invalid');
if(process.env.NODE_ENV==='production'||!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||!['/noghrex_local','/noghrex'].includes(target.pathname))throw Error('Demo seed only supports local noghrex / noghrex_local databases.');
if((process.env.PAYMENT_GATEWAY||'mock')!=='mock')throw Error('Demo seed requires mock payment gateway.');
await import('../app.js');
const walletService=await import('../services/wallet/wallet-service.js');
const priceService=await import('../services/silver/online/online-price-service.js');
const inventoryService=await import('../services/silver/online/online-inventory-service.js');
const budgetService=await import('../services/platform/buyback-budget-service.js');
const physicalPrice=await import('../services/silver/physical/physical-price-service.js');
const productService=await import('../services/silver/physical/physical-product-service.js');
const physicalInventory=await import('../services/silver/physical/physical-inventory-service.js');
const cartService=await import('../services/silver/physical/cart-service.js');
const checkoutService=await import('../services/checkout/checkout-service.js');
const orderService=await import('../services/order/order-service.js');
const refundService=await import('../services/refund/refund-service.js');
const depositService=await import('../services/deposit/deposit-service.js');
const paymentService=await import('../services/payment/payment-service.js');
const withdrawalService=await import('../services/withdrawal/withdrawal-service.js');
const addressService=await import('../services/address/address-service.js');
const bankService=await import('../services/bank-account/bank-account-service.js');
const kycService=await import('../services/kyc/kyc-service.js');
const quoteService=await import('../services/silver/online/quote-service.js');
const tradeService=await import('../services/silver/online/trade-service.js');
const settingsService=await import('../services/settings/settings-service.js');
await mongoose.connect(uri);
const m=mongoose.models, seedKey='demo.seed.v1',owner=randomUUID();let locked=false;
try{
 for(const model of Object.values(m))await model.init();
 await m.SystemSetting.updateOne({key:seedKey},{$setOnInsert:{value:{steps:{}}}},{upsert:true});
 const lock=await m.SystemSetting.findOneAndUpdate({key:seedKey,$or:[{'value.lockUntil':{$exists:false}},{'value.lockUntil':{$lt:new Date()}}]},{$set:{'value.lockUntil':new Date(Date.now()+1800000),'value.lockOwner':owner}},{new:true});
 if(!lock)throw Error('Another demo seed is running. Wait for its lease to finish.');locked=true;
 const steps=lock.value.steps||{};
 async function save(key,value){steps[key]=value;await m.SystemSetting.updateOne({key:seedKey,'value.lockOwner':owner},{$set:{['value.steps.'+key]:value}});return value;}
 async function once(key,work){if(steps[key])return steps[key];return save(key,await work());}
 async function account(phoneNumber,firstname,lastname,role){
  const email='demo.'+phoneNumber+'@example.invalid';let u=await m.User.findOne({phoneNumber});
  if(u&&u.email!==email)throw Error('Reserved demo phone already belongs to a non-demo user: '+phoneNumber);
  if(!u)u=await m.User.create({phoneNumber,firstname,lastname,role,email,password:'NoghrexDemo!2026',phoneVerifiedAt:new Date()});
  await walletService.createWalletForUser(u._id);return u;
 }
 const admin=await account('09129990001','مدیر','نمایشی','admin'),user=await account('09129990002','آرمان','نمونه','user'),second=await account('09129990003','سارا','نمونه','user');
 await once('financialSettings',async()=>{if(!await m.SystemSetting.exists({key:'financial'}))await settingsService.updateFinancialSettings(await settingsService.getFinancialSettings(),admin._id);return true;});
 await once('onlinePrice',async()=>{if(!await m.OnlinePrice.exists({key:'current'}))await priceService.setManualOnlinePrice({adminId:admin._id,buyPricePer1000X:100000,sellPricePer1000X:105000});return true;});
 await once('physicalPrice',async()=>{if(!await m.PhysicalPrice.exists({key:'physical'}))await physicalPrice.setPhysicalPrice(105000,admin._id);return true;});
 await inventoryService.ensureOnlineInventory();
 await once('onlineStock',async()=>{await inventoryService.adjustOnlineInventory({adminId:admin._id,type:'increase',amountX:3000000,reason:'DEMO: موجودی اولیه نمایشی؛ بدون انتقال واقعی نقره',idempotencyKey:'demo-v1-online-stock'});return true;});
 await once('buybackBudget',async()=>{await budgetService.adjustBuybackBudget(admin._id,{type:'increase',amountToman:10000000,reason:'DEMO: بودجه مستقل بازخرید آزمایشی',idempotencyKey:'demo-v1-buyback'});return true;});
 const defs=[
 ['FINE-01','ست نقره مهتاب (نمونه)','زیورآلات ظریف',3.2,'jewelry-delicate.png',18],
 ['FINE-02','ست نقره آوین (نمونه)','زیورآلات ظریف',6.8,'jewelry-delicate.png',8],
 ['BOLD-01','ست نقره آذر (نمونه)','زیورآلات درشت',20,'jewelry-bold.png',12],
 ['BOLD-02','ست نقره هور (نمونه)','زیورآلات درشت',15,'jewelry-bold.png',0],
 ['BAR-01','شمش نقره ۲۵۰ گرمی (نمونه)','شمش نقره',250,'silver-hero.png',7],
 ['BAR-02','شمش نقره یک کیلوگرمی (نمونه)','شمش نقره',1000,'silver-hero.png',3]
 ];
 const products=[];
 for(const [key,name,category,weightGrams,image,qty]of defs){const sku='DEMO-'+key;let p=await m.PhysicalProduct.findOne({sku});if(!p)p=await productService.createProduct({name,slug:'demo-'+key.toLowerCase(),sku,category,weightGrams,pricingMode:'custom',wageType:'percent',wageValue:category==='شمش نقره'?0:8,profitPercent:3,taxPercent:0,accessoriesAmount:0,active:true,images:['http://127.0.0.1:3000/assets/'+image],description:'محصول نمونه برای بررسی رابط و فرایند سفارش نقرکس. تصویر معرفی است؛ وزن، قیمت و مشخصات برای تست درج شده‌اند و پیشنهاد فروش واقعی نیستند.\nجزئیات قیمت شامل ارزش نقره، اجرت، سود و مالیات در همین صفحه نمایش داده می‌شود.'});products.push(p);
  if(qty)await once('stock-'+key,async()=>{await physicalInventory.adjustInventory({productId:p._id,type:'increase',quantity:qty,reason:'DEMO: موجودی قابل تست محصول',actorId:admin._id,idempotencyKey:'demo-v1-stock-'+key});return true;});
 }
 let shipping=await m.ShippingMethod.findOne({name:'ارسال استاندارد (نمونه)'});if(!shipping)shipping=await m.ShippingMethod.create({name:'ارسال استاندارد (نمونه)',cost:65000,freeAbove:2000000,description:'روش ارسال نمایشی؛ سفارش‌ها واقعی ارسال نمی‌شوند.',active:true,sortOrder:1});
 if(!await m.ShippingMethod.exists({name:'پیک تهران (نمونه)'}))await m.ShippingMethod.create({name:'پیک تهران (نمونه)',cost:120000,provinceRestrictions:['تهران'],description:'مخصوص تست محدوده ارسال',active:true,sortOrder:2});
 async function addressFor(u){return await m.Address.findOne({userId:u._id,title:'خانه (نمونه)'})||addressService.createAddress(u._id,{title:'خانه (نمونه)',recipientName:u.firstname+' '+u.lastname,phoneNumber:u.phoneNumber,province:'تهران',city:'تهران',addressLine:'نشانی ساختگی برای تست: خیابان نمونه، پلاک ۱۲، واحد ۳',postalCode:'1111111111',isDefault:true});}
 const address=await addressFor(user);await addressFor(second);
 // Synthetically generated identifiers, visibly tied only to demo accounts.
 for(const [u,nationalId,status]of [[user,'0084575948','verified'],[second,'0013548879','pending']]){
  let k=await m.Kyc.findOne({userId:u._id});if(!k)k=await kycService.submitKyc(u._id,{nationalId,birthDate:'1994-05-12'});
  if(status==='verified')await once('kyc-'+u.phoneNumber,async()=>{if(k.status==='pending')await kycService.approveKyc(k._id,admin._id);return true;});
 }
 let bank=await m.BankAccount.findOne({userId:user._id,bankName:'بانک نمایشی'});if(!bank)bank=await bankService.createBankAccount(user._id,{bankName:'بانک نمایشی',cardNumber:'6037990000000001',iban:'IR000000000000000000000001',isDefault:true});
 await once('verifiedBank',async()=>{if(bank.status==='pending')await bankService.verifyBankAccount(bank._id,admin._id);return true;});
 if(!await m.BankAccount.exists({userId:second._id}))await bankService.createBankAccount(second._id,{bankName:'بانک نمونه در انتظار بررسی',cardNumber:'6037990000000002',iban:'IR000000000000000000000002'});
 async function gatewayDeposit(u,key,amount){await once(key,async()=>{const d=await depositService.createDepositRequest(u._id,{method:'gateway',amount,idempotencyKey:'demo-v1-'+key,userNote:'DEMO: شارژ نمایشی'});const p=await paymentService.initiatePayment(u._id,{purpose:'wallet_deposit',entityId:d._id});await paymentService.verifyMockPayment(u._id,p._id,'success');return String(d._id);});}
 await gatewayDeposit(user,'userDeposit',12000000);await gatewayDeposit(second,'secondDeposit',3000000);
 await once('pendingDeposit',async()=>String((await depositService.createDepositRequest(second._id,{method:'card_to_card',amount:450000,idempotencyKey:'demo-v1-pending-deposit',transferReference:'DEMO-RECEIPT-001',userNote:'رسید نمایشی برای بررسی مدیر'}))._id));
 await once('approvedDeposit',async()=>{const d=await depositService.createDepositRequest(user._id,{method:'iban',amount:500000,idempotencyKey:'demo-v1-approved-deposit',transferReference:'DEMO-RECEIPT-002',userNote:'DEMO'});await depositService.approveManualDeposit(d._id,admin._id);return String(d._id);});
 for(const [key,side,xAmount]of [['buyTrade','buy',50000],['sellTrade','sell',5000]])await once(key,async()=>{
  let q=steps['quote-'+key]?await m.Quote.findById(steps['quote-'+key]):null;
  const existing=q&&await m.Trade.findOne({quoteId:q._id});if(existing)return String(existing._id);
  if(!q||q.expiresAt<new Date()){q=await quoteService.createQuote(user._id,{side,xAmount});await save('quote-'+key,String(q._id));}
  return String((await tradeService.executeTrade(user._id,q._id))._id);
 });
 for(const [key,amount,complete]of [['pendingWithdrawal',150000,false],['completedWithdrawal',250000,true]])await once(key,async()=>{
  let w=await withdrawalService.createWithdrawal(user._id,{amount,bankAccountId:bank._id,idempotencyKey:'demo-v1-'+key});
  if(complete){if(w.status==='pending')w=await withdrawalService.approveWithdrawal(w._id,admin._id);if(w.status==='approved')w=await withdrawalService.markWithdrawalProcessing(w._id,admin._id);if(w.status==='processing')w=await withdrawalService.completeWithdrawal(w._id,admin._id,'DEMO-BANK-001');}return String(w._id);
 });
 async function order(key,index,method){
  if(steps['order-'+key])return m.Order.findById(steps['order-'+key]);
  let c=steps['checkout-'+key]?await m.CheckoutSession.findById(steps['checkout-'+key]):null;
  if(c){const existing=await m.Order.findOne({checkoutSessionId:c._id});if(existing){await save('order-'+key,String(existing._id));return existing;}}
  if(!c||c.expiresAt<new Date()){await cartService.clearCart(user._id);await cartService.addCartItem(user._id,products[index]._id,1);c=await checkoutService.createCheckout(user._id,{addressId:address._id,shippingMethodId:shipping._id});await save('checkout-'+key,String(c._id));}
  const o=await orderService.createOrder(user._id,{checkoutSessionId:c._id,paymentMethod:method});await save('order-'+key,String(o._id));return o;
 }
 async function pay(o){if(o.paymentStatus==='paid'||o.paymentStatus==='refunded')return o;if(o.paymentMethod==='wallet')return orderService.payOrderWithWallet(user._id,o._id);const p=await paymentService.initiatePayment(user._id,{purpose:'order_payment',entityId:o._id});await paymentService.verifyMockPayment(user._id,p._id,'success');return m.Order.findById(o._id);}
 await once('deliveredOrder',async()=>{let o=await pay(await order('delivered',0,'wallet'));if(o.status==='confirmed')o=await orderService.updateFulfillmentStatus(o._id,'processing',admin._id);if(o.status==='processing')o=await orderService.updateFulfillmentStatus(o._id,'shipped',admin._id,'DEMO-POST-001');if(o.status==='shipped')o=await orderService.updateFulfillmentStatus(o._id,'delivered',admin._id);return String(o._id);});
 await once('processingOrder',async()=>{let o=await pay(await order('processing',1,'gateway'));if(o.status==='confirmed')o=await orderService.updateFulfillmentStatus(o._id,'processing',admin._id);return String(o._id);});
 await once('refundedOrder',async()=>{const o=await pay(await order('refunded',0,'gateway'));let r=await refundService.requestRefund(user._id,o._id,'DEMO: درخواست نمایشی مرجوعی');if(r.status==='requested')r=await refundService.reviewRefund(r._id,admin._id,'approved');if(r.status==='approved')r=await refundService.completeRefund(r._id,admin._id,false);return String(o._id);});
 await once('pendingRefundOrder',async()=>{const o=await pay(await order('refund-pending',0,'wallet'));await refundService.requestRefund(user._id,o._id,'DEMO: در انتظار بررسی مدیر');return String(o._id);});
 await once('unpaidOrder',async()=>String((await order('unpaid',1,'wallet'))._id));
 await once('sampleCart',async()=>{await cartService.clearCart(user._id);await cartService.addCartItem(user._id,products[0]._id,2);await cartService.addCartItem(user._id,products[2]._id,1);return true;});
 if(!await m.SystemAlert.exists({type:'DEMO_WELCOME'}))await m.SystemAlert.create({type:'DEMO_WELCOME',severity:'info',title:'محیط نمونه آماده است',message:'این هشدار نمایشی است؛ کاربران و محصولات DEMO صرفاً برای تست هستند.',metadata:{demo:true}});
 // Consumed OTP cannot authenticate or create another user; normal TTL cleanup stays enabled.
 await m.OtpVerification.updateOne({phoneNumber:second.phoneNumber,purpose:'signup'},{$setOnInsert:{codeHash:await bcrypt.hash(randomUUID(),10),verifiedAt:new Date(),consumedAt:new Date(),expiresAt:new Date(Date.now()+86400000),signupTokenHash:null}},{upsert:true});
 const collections=[];for(const model of Object.values(m))collections.push({collection:model.collection.name,count:await model.countDocuments()});
 const report={database:target.pathname.slice(1),createdAt:new Date(),accounts:[{phone:admin.phoneNumber,role:'admin'},{phone:user.phoneNumber,role:'user'},{phone:second.phoneNumber,role:'user'}],collections};
 await mkdir('docs',{recursive:true});await writeFile('docs/demo-data-report.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));console.log('Password for new demo accounts: NoghrexDemo!2026');
}finally{if(locked)await m.SystemSetting.updateOne({key:seedKey,'value.lockOwner':owner},{$unset:{'value.lockUntil':'','value.lockOwner':''}});await mongoose.disconnect();}
