const {chromium}=require('C:/Users/asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:"C:/Users/asus/AppData/Local/ms-playwright/chromium_headless_shell-1194/chrome-win/headless_shell.exe"});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3012/#/login');
 await page.getByRole('textbox',{name:'شماره همراه',exact:true}).fill('09121119992');
 await page.getByRole('textbox',{name:'رمز عبور',exact:true}).fill('PreviewOnly!2026');
 await page.getByRole('button',{name:'ورود به نقرکس',exact:true}).click();await page.waitForURL('**/#/dashboard');
 await page.goto('http://localhost:3012/#/shop');await page.locator('.product-card').first().waitFor();
 const fav=page.locator('.product-card [data-action=favorite]').first();await fav.click();await page.waitForFunction(()=>document.querySelector('.product-card [data-action=favorite]')?.getAttribute('aria-pressed')==='true');
 assert.equal(await fav.locator('svg').evaluate(e=>getComputedStyle(e).fill),'rgb(17, 122, 118)');
 await page.reload();await page.waitForFunction(()=>document.querySelector('.product-card [data-action=favorite]')?.getAttribute('aria-pressed')==='true');
 await page.locator('.product-card .product-image').first().click();await page.locator('.product-layout').waitFor();
 for(const width of [1366,1024,768,390,320]){
  await page.setViewportSize({width,height:900});
  const layout=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}};return {width:document.documentElement.clientWidth,scroll:document.body.scrollWidth,nav:getComputedStyle(document.querySelector('.member-nav')).display,brand:rect('.site-header>.brand'),actions:rect('.header-actions'),menu:rect('.mobile-menu')}});
  assert.ok(layout.scroll<=layout.width+1,JSON.stringify({width,...layout}));
  if(width<=1100){assert.equal(layout.nav,'none');assert.ok(layout.actions.right<=layout.brand.x+1,JSON.stringify({width,...layout}));}
  await page.screenshot({path:'tmp-product-'+width+'.png',fullPage:true});
 }
 await page.getByRole('button',{name:'افزایش تعداد',exact:true}).click();assert.equal(await page.locator('#add-cart output').textContent(),'۲');
 await page.goto('http://localhost:3012/#/trade');const input=page.getByRole('textbox',{name:'مقدار نقره'});await input.waitFor();assert.equal(await input.inputValue(),'1,000,000');await input.fill('۱۲۳۴۵۶۷');assert.equal(await input.inputValue(),'1,234,567');
 await page.goto('http://localhost:3012/#/home');await page.locator('.jewelry-feature-image img').waitFor();assert.ok((await page.locator('.jewelry-feature-image img').getAttribute('src')).endsWith('jewelry-delicate.png'));assert.equal(await page.locator('.jewelry-motion-toggle, .jewelry-feature-image [data-motion-gif]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: favorite add/persistence, filled heart, five responsive widths, quantity, Persian grouped input, original static jewelry photo, no JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
