import {esc,api,toast,normalizeDigits,money,shortId,icon} from './ui.js';
export const field=(name,title,type='text',value='',options={})=>({name,title,type,value,...options});
const numeric=(name,title,value=0,options={})=>field(name,title,'number',value,{min:0,step:1,...options});
const select=(name,title,values,value)=>field(name,title,'select',value,{values});
const bool=(name,title,value=true)=>select(name,title,[['true','بله'],['false','خیر']],String(value));
const reason=()=>field('reason','دلیل و توضیحات','textarea','',{max:500,minlength:2});
const adjustment=()=>[select('type','نوع تغییر',[['increase','افزایش'],['decrease','کاهش']],'increase')];
export function renderField(f){
 const attrs=`name="${esc(f.name)}" id="f-${esc(f.name)}" ${f.optional?'':'required'} ${f.min!==undefined?`min="${f.min}"`:''} ${f.step!==undefined?`step="${f.step}"`:''} ${f.max!==undefined?(f.type==='number'?`max="${f.max}"`:`maxlength="${f.max}"`):''} ${f.minlength?`minlength="${f.minlength}"`:''}`;
 const value=f.value??'';
 const control=f.type==='select'?`<select ${attrs}>${f.values.map(([v,t])=>`<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(t)}</option>`).join('')}</select>`:f.type==='textarea'?`<textarea ${attrs} rows="3">${esc(value)}</textarea>`:`<input ${attrs} type="${f.type}" value="${esc(value)}" ${f.type==='number'?'inputmode="decimal"':''}>`;
 return `<div class="field ${f.type==='textarea'?'wide':''}"><label for="f-${esc(f.name)}">${esc(f.title)}</label>${control}${f.hint?`<span class="hint">${esc(f.hint)}</span>`:''}</div>`;
}
export function readFields(form,fields){const data={};for(const f of fields){let v=form.elements.namedItem(f.name).value;if(f.type==='number'){v=v===''&&f.optional?null:Number(normalizeDigits(v));if(v!==null&&!Number.isFinite(v))throw Error('عدد واردشده معتبر نیست.');}if(f.values?.some(([v])=>v==='true'))v=v==='true';data[f.name]=v;}return data;}
let busy=false;
const dialog=document.querySelector('#form-dialog');
dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
export function openForm({title,fields=[],path,method='POST',transform=v=>v,note='',summary='',confirm='اطلاعات و نتیجه این عملیات را بررسی و تأیید می‌کنم.',onDone,body}){
 if(busy)return;
 document.querySelector('#form-content').innerHTML=`<form id="operation-form"><div class="dialog-head"><div><h2>${esc(title)}</h2><small>مدیریت نقرکس</small></div><button type="button" class="icon-button" data-close aria-label="بستن">${icon('close')}</button></div><div class="dialog-body">${summary}${note?`<p class="page-note">${esc(note)}</p>`:''}<div class="form-grid">${fields.map(renderField).join('')}</div><label class="confirm-box"><input type="checkbox" required><span>${esc(confirm)}</span></label><p class="form-error" role="alert"></p></div><div class="dialog-foot"><button type="submit" class="btn primary">ثبت و تأیید</button><button type="button" class="btn" data-close>انصراف</button></div></form>`;
 dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)dialog.close();});
 if(!dialog.open)dialog.showModal();
 const form=dialog.querySelector('form');
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);form.querySelector('.form-error').textContent='';let saved=false;
 try{await api(path,{method,body:body??transform(readFields(form,fields))});saved=true;dialog.close();toast('عملیات با موفقیت ثبت شد.');}
 catch(error){form.querySelector('.form-error').textContent=error.message;}
 finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
 if(saved)await onDone?.();};
}
export function editor(kind,item={},onDone){
 let title,fields,path,method='POST',note='',transform=v=>v;const productBase='/api/admin/silver/physical/products',key=crypto.randomUUID();
 if(kind==='product'){
 title=item._id?'ویرایش محصول':'محصول جدید';path=productBase+(item._id?'/'+item._id:'');method=item._id?'PATCH':'POST';
 fields=[field('name','نام محصول','text',item.name,{max:160}),field('sku','کد یکتای کالا (SKU)','text',item.sku,{max:80}),field('slug','نامک یکتا','text',item.slug,{max:180}),numeric('weightGrams','وزن نقره (گرم)',item.weightGrams??1,{min:.001,step:.001}),field('category','دسته‌بندی','text',item.category,{optional:true,max:100}),select('pricingMode','قیمت‌گذاری',[['standard','تنظیمات عمومی'],['custom','اختصاصی محصول']],item.pricingMode||'standard'),select('wageType','نوع اجرت',[['percent','درصد'],['fixed','تومان ثابت']],item.wageType||'percent'),numeric('wageValue','اجرت',item.wageValue??0,{step:'any'}),numeric('profitPercent','سود (%)',item.profitPercent??0,{step:'any',max:100}),numeric('taxPercent','مالیات (%)',item.taxPercent??0,{step:'any',max:100}),numeric('accessoriesAmount','متعلقات (تومان)',item.accessoriesAmount??0),bool('active','محصول فعال',item.active??true),field('description','توضیحات','textarea',item.description,{optional:true,max:3000}),field('images','نشانی تصاویر؛ هر خط یک URL','textarea',(item.images||[]).join('\n'),{optional:true})];
 note='در قیمت‌گذاری عمومی، اجرت، سود و مالیات از تنظیمات مالی خوانده می‌شود. موجودی را پس از ساخت از جزئیات محصول تغییر دهید.';transform=v=>({...v,images:v.images.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)});
 }else if(kind==='shipping'){
 title=item._id?'ویرایش روش ارسال':'روش ارسال جدید';path='/api/admin/shipping-methods'+(item._id?'/'+item._id:'');method=item._id?'PATCH':'POST';fields=[field('name','نام روش','text',item.name,{max:120}),numeric('cost','هزینه (تومان)',item.cost??0),numeric('freeAbove','ارسال رایگان از (تومان)',item.freeAbove,{optional:true,hint:'خالی = بدون آستانه ارسال رایگان'}),numeric('sortOrder','ترتیب نمایش',item.sortOrder??0),bool('active','فعال',item.active??true),field('provinceRestrictions','استان‌های مجاز؛ هر خط یک استان','textarea',(item.provinceRestrictions||[]).join('\n'),{optional:true,hint:'خالی = همه استان‌ها'}),field('description','توضیحات','textarea',item.description,{optional:true,max:500})];transform=v=>({...v,provinceRestrictions:v.provinceRestrictions.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)});
 }else if(kind==='online-price'){
 title='قیمت نقره آنلاین';path='/api/admin/silver/online/price/manual';method='PUT';fields=[numeric('buyPricePer1000X','خرید نقرکس از کاربر / گرم (تومان)',item.buyPricePer1000X,{min:1}),numeric('sellPricePer1000X','فروش نقرکس به کاربر / گرم (تومان)',item.sellPricePer1000X,{min:1})];note='هر گرم برابر ۱٬۰۰۰ X است. این مبالغ بدون کمیسیون معامله هستند.';
 }else if(kind==='physical-price'){
 title='قیمت پایه نقره فروشگاهی';path='/api/admin/silver/physical/price';method='PUT';fields=[numeric('pricePerGram','قیمت هر گرم (تومان)',item.pricePerGram,{min:1})];
 }else{
 fields=adjustment();if(kind==='budget'){title='تخصیص بودجه بازخرید';path='/api/admin/buyback-budget/adjustments';fields.push(numeric('amountToman','مبلغ (تومان)',undefined,{min:1}));note='این بودجه مخصوص خرید نقره از کاربران است و مستقل از فروش و واریزهای کیف پول نگهداری می‌شود.';}
 else if(kind==='x-adjust'){title='اصلاح موجودی آنلاین';path='/api/admin/silver/online/inventory/adjustments';fields.push(numeric('amountX','مقدار X',undefined,{min:1}));note='هر ۱٬۰۰۰ X یک گرم است؛ موجودی آنلاین از موجودی محصولات جداست.';}
 else if(kind==='stock'){title='اصلاح موجودی '+(item.name||'محصول');path=productBase+'/'+item._id+'/inventory/adjustments';fields.push(numeric('quantity','تعداد کالا',undefined,{min:1}));}
 else return;fields.push(reason());transform=v=>({...v,idempotencyKey:key});
 }openForm({title,fields,path,method,note,transform,onDone});
}
export function recordActions(resource,item){
 const actions=[],add=(key,title,path,method='PATCH',fields=[],body)=>actions.push({key,title,path,method,fields,body});const base='/api/admin/',rid=item._id,s=item.status;
 if(resource==='products'){actions.push({key:'edit',title:'ویرایش محصول',editor:'product'},{key:'stock',title:'اصلاح موجودی',editor:'stock'});}
 if(resource==='shipping')actions.push({key:'edit',title:'ویرایش روش ارسال',editor:'shipping'});
 if(resource==='deposits'&&s==='pending'&&['iban','card_to_card'].includes(item.method)){add('approve','تأیید واریز',base+'deposits/'+rid+'/approve','PATCH',[],{});add('reject','رد واریز',base+'deposits/'+rid+'/reject','PATCH',[reason()]);}
 if(resource==='withdrawals'){
 if(s==='pending')add('approve','تأیید برداشت',base+'withdrawals/'+rid+'/approve','PATCH',[],{});
 if(s==='approved')add('processing','شروع انتقال بانکی',base+'withdrawals/'+rid+'/processing','PATCH',[],{});
 if(['pending','approved'].includes(s))add('reject','رد برداشت',base+'withdrawals/'+rid+'/reject','PATCH',[reason()]);
 if(s==='processing'){add('complete','ثبت انتقال موفق',base+'withdrawals/'+rid+'/complete','PATCH',[field('bankReference','شماره پیگیری انتقال بانکی','text','',{max:150})]);actions.push({key:'fail',title:'ثبت انتقال ناموفق',path:base+'withdrawals/'+rid+'/fail',method:'POST',fields:[reason()],transform:v=>({...v,bankTransferFailed:true}),confirm:'بانک قطعاً وجه را منتقل نکرده است؛ آزادسازی وجه کاربر را تأیید می‌کنم.'});}}
 if(resource==='refunds'){
 if(s==='requested'){add('approve','تأیید بازپرداخت',base+'refunds/'+rid+'/review','PATCH',[],{decision:'approved'});actions.push({key:'reject',title:'رد بازپرداخت',path:base+'refunds/'+rid+'/review',method:'PATCH',fields:[reason()],transform:v=>({...v,decision:'rejected'})});}
 if(s==='approved')actions.push({key:'complete',title:'واریز بازپرداخت به کیف پول',path:base+'refunds/'+rid+'/complete',method:'POST',fields:[bool('stockReturned','کالای مرجوعی دریافت شده است',false)],note:'کل مبلغ اصلی سفارش به کیف پول تومانی کاربر برمی‌گردد. برای کالای ارسال‌شده، دریافت مرجوعی الزامی است.'});}
 if((resource==='kyc'||resource==='banks')&&s==='pending'&&(resource!=='banks'||item.isActive)){
 const p=base+(resource==='kyc'?'kyc':'bank-accounts')+'/'+rid;add('approve','تأیید اطلاعات',p+(resource==='kyc'?'/approve':'/verify'),'PATCH',[],{});add('reject','رد اطلاعات',p+'/reject','PATCH',[field('rejectionReason','دلیل رد','textarea','',{max:500,minlength:2})]);}
 if(resource==='orders'&&!item.refundPending){if(s==='manual_review')add('supply','تأمین موجودی سفارش',base+'orders/'+rid+'/resolve/supply','POST',[],{});const next={confirmed:'processing',processing:'shipped',shipped:'delivered'}[s];if(next&&item.paymentStatus==='paid'&&item.stockConsumed)actions.push({key:'fulfillment',title:{processing:'شروع آماده‌سازی',shipped:'ثبت ارسال',delivered:'ثبت تحویل'}[next],path:base+'orders/'+rid+'/fulfillment',method:'PATCH',fields:next==='shipped'?[field('trackingCode','کد رهگیری مرسوله','text','',{max:150})]:[],transform:v=>({...v,status:next})});}
 if(resource==='users'&&item.role!=='admin')add('status','تغییر وضعیت حساب','/api/users/'+rid+'/status','PATCH',[select('accountStatus','وضعیت حساب',[['active','فعال'],['suspended','معلق'],['deactivated','غیرفعال']],item.accountStatus),reason()]);
 if(resource==='alerts'&&s==='open')add('resolve','علامت رسیدگی‌شده',base+'system/alerts/'+rid+'/resolve','PATCH',[],{});
 return actions;
}
export function performRecordAction(action,item,onDone){if(action.editor)return editor(action.editor,item,onDone);const amount=item.amount??item.totalAmount;openForm({...action,onDone,summary:`<p class="page-note">شناسه: ${shortId(item._id)}</p>${amount!==undefined?`<div class="detail-amount">مبلغ درخواست <strong>${money(amount)}</strong></div>`:''}`});}

export function settingsFields(s){
 const groups=[];for(const [key,title]of [['gateway','واریز از درگاه'],['card_to_card','واریز کارت‌به‌کارت'],['iban','واریز شبا']]){const v=s.deposit[key];groups.push({title,fields:[bool('deposit.'+key+'.enabled','فعال',v.enabled),numeric('deposit.'+key+'.perTransactionLimit','سقف هر تراکنش (تومان)',v.perTransactionLimit,{optional:true,min:1,hint:'خالی = بدون سقف'}),numeric('deposit.'+key+'.dailyLimit','سقف روزانه (تومان)',v.dailyLimit,{optional:true,min:1})]});}
 const group=(key,title,defs)=>groups.push({title,fields:defs.map(([name,text,type,opts={}])=>type==='bool'?bool(key+'.'+name,text,s[key][name]):type==='select'?select(key+'.'+name,text,opts.values,s[key][name]):numeric(key+'.'+name,text,s[key][name],opts))});
 group('withdrawal','برداشت بانکی',[['enabled','فعال','bool'],['perTransactionLimit','سقف هر برداشت (تومان)','number',{optional:true,min:1}],['dailyLimit','سقف روزانه (تومان)','number',{optional:true,min:1}],['minimumAmount','حداقل برداشت (تومان)','number',{optional:true,min:1}],['feeAmount','کارمزد (تومان)','number']]);
 group('trading','معاملات نقره آنلاین',[['minBuyX','حداقل خرید کاربر (X)','number',{min:1}],['minSellX','حداقل فروش کاربر (X)','number',{min:1}],['maxBuyX','حداکثر خرید کاربر (X)','number',{optional:true,min:1}],['maxSellX','حداکثر فروش کاربر (X)','number',{optional:true,min:1}],['buyCommissionPercent','کمیسیون خرید کاربر (%)','number',{max:100,step:'any'}],['sellCommissionPercent','کمیسیون فروش کاربر (%)','number',{max:100,step:'any'}],['quoteTtlSeconds','اعتبار پیش‌فاکتور (ثانیه)','number',{min:1}]]);
 group('physical','قیمت‌گذاری عمومی محصولات',[['wageType','نوع اجرت','select',{values:[['percent','درصد'],['fixed','تومان ثابت']]}],['wageValue','مقدار اجرت','number',{step:'any'}],['profitPercent','سود (%)','number',{max:100,step:'any'}],['taxPercent','مالیات (%)','number',{max:100,step:'any'}]]);
 group('checkout','مهلت پرداخت فروشگاه',[['ttlSeconds','اعتبار سبد پرداخت (ثانیه)','number',{min:30,max:3600}],['paymentTtlSeconds','اعتبار پرداخت (ثانیه)','number',{min:30,max:3600}]]);
 group('account','حساب کاربری',[['maxBankAccountsPerUser','حداکثر حساب بانکی هر کاربر','number',{min:1,max:20}]]);return groups;
}
