const {chromium}=require('C:/Users/asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve('deliverables/noghrex-pages-2026-10-05'),base='http://localhost:3012';
const customer=[['home','خانه'],['shop','فروشگاه'],['product/qa-fine','جزئیات محصول'],['guide','راهنما'],['transparency','شرایط خدمات'],['login','ورود'],['signup','ثبت نام'],['dashboard','دارایی من'],['trade','خرید و فروش نقره'],['wallet','کیف پول'],['favorites','علاقه مندی ها'],['cart','سبد خرید'],['checkout','تکمیل خرید'],['orders','سفارش ها'],['profile','حساب کاربری'],['banks','حساب بانکی'],['addresses','نشانی ها'],['trades','سوابق معاملات'],['deposits','واریزها'],['withdrawals','برداشت ها'],['refunds','بازپرداخت ها']];
const admin=[['dashboard','داشبورد'],['trades','معاملات'],['price-history','قیمت نقره'],['x-history','موجودی آنلاین'],['budget-history','بودجه بازخرید'],['orders','سفارش ها'],['products','محصولات'],['stock-history','گردش موجودی'],['shipping','ارسال'],['deposits','واریزها'],['withdrawals','برداشت ها'],['refunds','بازپرداخت ها'],['payments','پرداخت ها'],['ledger','دفتر حسابداری'],['users','کاربران'],['kyc','احراز هویت'],['banks','حساب های بانکی'],['bank-settings','مدیریت بانک ها'],['city-settings','شهرها'],['audit','گزارش فعالیت'],['alerts','هشدارها'],['settings','تنظیمات']];
(async()=>{
 await fs.mkdir(root,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/asus/AppData/Local/ms-playwright/chromium_headless_shell-1194/chrome-win/headless_shell.exe'});
 const records=[],errors=[];
 try{
 const contexts=await Promise.all([0,1,2].map(()=>browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'})));
 for(const c of contexts)await c.addInitScript(()=>localStorage.setItem('noghrex-motion','paused'));
 const [guest,user,manager]=await Promise.all(contexts.map(c=>c.newPage()));
 for(const p of [guest,user,manager])p.on('pageerror',e=>errors.push(e.message));
 async function login(p,isAdmin){await p.goto(base+(isAdmin?'/admin/#dashboard':'/#/login'));await p.getByRole('textbox',{name:'شماره همراه',exact:true}).fill(isAdmin?'09121119991':'09121119992');await p.getByRole('textbox',{name:'رمز عبور',exact:true}).fill('PreviewOnly!2026');await p.getByRole('button',{name:isAdmin?'ورود به پنل':'ورود به نقرکس',exact:true}).click();await p.waitForTimeout(1200);}
 await login(user,false);await login(manager,true);
 const orderId=await user.evaluate(async()=>{
  const {api}=await import('/ui.js');const products=(await api('/silver/physical/products')).products.items;const p=products[0];
  await api('/account/favorites/'+p._id,{method:'PUT'});
  await api('/silver/physical/cart/items',{method:'POST',body:{productId:p._id,quantity:1}});
  const a=(await api('/account/addresses')).addresses[0],s=(await api('/shipping-methods')).methods[0];
  const {checkout}=await api('/checkout',{method:'POST',body:{addressId:a._id,shippingMethodId:s._id}});
  const {order}=await api('/orders',{method:'POST',body:{checkoutSessionId:checkout._id,paymentMethod:'wallet'}});
  return order._id;
 });
 customer.splice(14,0,['order/'+orderId,'جزئیات سفارش']);
 async function shot(p,route,title,group,index,isAdmin=false){
  await p.goto(base+(isAdmin?'/admin/#':'/#/')+route);await p.waitForLoadState('networkidle');
  await p.evaluate(async()=>{await document.fonts.ready;for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
  await p.waitForTimeout(200);
  const relative=group+'/'+String(index).padStart(2,'0')+'-'+title+'.png';await fs.mkdir(path.join(root,group),{recursive:true});
  await p.screenshot({path:path.join(root,relative),fullPage:true,animations:'disabled'});
  const broken=await p.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.src));
  records.push({title,group,file:relative,route,broken});console.log(group+' '+index+' '+title);
 }
 for(const [size,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  for(const p of [guest,user,manager])await p.setViewportSize({width,height});
  for(let i=0;i<customer.length;i++){const [route,title]=customer[i];await shot(i<7?guest:user,route,title,size+'-customer',i+1);}
  for(let i=0;i<admin.length;i++)await shot(manager,...admin[i],size+'-admin',i+1,true);
 }
 await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({created:new Date(),data:'isolated test database',records,errors},null,2));
 const esc=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 await fs.writeFile(path.join(root,'index.html'),`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>نمایش صفحات نقرکس</title><style>body{font-family:Tahoma;background:#eef4f3;color:#143a3d;margin:32px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}a{color:inherit;text-decoration:none;background:white;border-radius:14px;padding:14px}img{width:100%;height:240px;object-fit:cover;object-position:top;border:1px solid #ddd}small{display:block;color:#678}</style><h1>نقرکس؛ مجموعه تصاویر صفحات</h1><p>نسخه نمایشی — داده‌ها آزمایشی هستند. برای مشاهده کامل هر تصویر روی آن کلیک کنید.</p>${['desktop-customer','mobile-customer','desktop-admin','mobile-admin'].map((g,i)=>`<h2>${['سایت مشتری — دسکتاپ','سایت مشتری — موبایل','پنل مدیریت — دسکتاپ','پنل مدیریت — موبایل'][i]}</h2><div class="grid">${records.filter(r=>r.group===g).map(r=>`<a href="${esc(r.file)}"><img loading="lazy" src="${esc(r.file)}"><h3>${r.title}</h3></a>`).join('')}</div>`).join('')}</html>`);
 console.log(JSON.stringify({count:records.length,errors,broken:records.filter(r=>r.broken.length)}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
