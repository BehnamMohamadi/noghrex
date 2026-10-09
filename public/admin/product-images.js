import {esc} from './ui.js';
export function imageField(f){return `<section class="field wide product-image-editor"><h3>کاور و گالری محصول</h3><p class="hint">کاور اولین تصویر محصول است. حداکثر ۷ عکس گالری. JPG، PNG یا WebP؛ مربع ۱:۱، ضلع ۵۱۲ تا ۴۰۹۶ پیکسل، حداکثر ۵ مگابایت برای هر عکس.</p><input type="hidden" name="${esc(f.name)}" value="${esc(JSON.stringify(f.value||[]))}"><div class="image-upload-actions"><label class="btn">انتخاب کاور<input type="file" accept="image/jpeg,image/png,image/webp" data-cover></label><label class="btn">افزودن به گالری<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-gallery></label></div><p class="image-upload-status" role="status"></p><div class="image-upload-previews"></div></section>`;}
export function bindImageFields(form){
 const root=form.querySelector('.product-image-editor');if(!root)return;
 const hidden=root.querySelector('input[type=hidden]'),status=root.querySelector('.image-upload-status');let images=JSON.parse(hidden.value),uploading=false;
 const safe=v=>/^\/uploads\/products\/[a-f0-9-]+\.webp$/.test(v)||/^https?:\/\//.test(v);
 const render=()=>{hidden.value=JSON.stringify(images);root.querySelector('.image-upload-previews').innerHTML=images.map((src,i)=>`<figure>${safe(src)?`<img src="${esc(src)}" alt="${i?'گالری':'کاور'}" loading="lazy">`:''}<figcaption>${i?'گالری '+i:'کاور محصول'}</figcaption><div>${i?`<button class="btn small" type="button" data-make-cover="${i}">کاور شود</button>`:''}<button class="btn small" type="button" data-remove="${i}">حذف</button></div></figure>`).join('');};render();
 root.addEventListener('click',e=>{if(uploading)return;const remove=e.target.closest('[data-remove]'),cover=e.target.closest('[data-make-cover]');if(remove)images.splice(Number(remove.dataset.remove),1);if(cover){const [image]=images.splice(Number(cover.dataset.makeCover),1);images.unshift(image);}if(remove||cover)render();});
 root.querySelectorAll('input[type=file]').forEach(input=>input.onchange=async()=>{
  if(uploading)return;const files=[...input.files],cover=input.hasAttribute('data-cover');if(!files.length)return;
  if(!cover&&!images.length){status.textContent='ابتدا یک عکس کاور انتخاب کنید.';input.value='';return;}
  if(!cover&&images.length+files.length>8){status.textContent='حداکثر یک کاور و ۷ عکس گالری مجاز است.';input.value='';return;}
  uploading=true;form.dataset.uploading='true';root.querySelectorAll('button,input[type=file]').forEach(el=>el.disabled=true);status.textContent='در حال بررسی و بارگذاری عکس…';
  try{
   for(const file of files){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('فقط JPG، PNG یا WebP و حداکثر ۵ مگابایت برای هر عکس مجاز است.');
    const bitmap=await createImageBitmap(file);const valid=bitmap.width===bitmap.height&&bitmap.width>=512&&bitmap.width<=4096;bitmap.close();if(!valid)throw Error('عکس باید مربع ۱:۱ و ضلع آن بین ۵۱۲ تا ۴۰۹۶ پیکسل باشد.');
    const response=await fetch('/api/admin/product-images',{method:'POST',credentials:'same-origin',headers:{'Content-Type':file.type,'X-Requested-With':'NOGHREX'},body:file});const result=await response.json();if(!response.ok)throw Error(result.message||'آپلود عکس انجام نشد.');
    if(cover)images[0]=result.data.image.url;else images.push(result.data.image.url);render();
   }
   status.textContent='عکس بارگذاری شد؛ برای ذخیره روی محصول، فرم را ثبت کنید.';
  }catch(error){status.textContent=error.message||'آپلود عکس انجام نشد.';}finally{uploading=false;form.dataset.uploading='false';root.querySelectorAll('button,input[type=file]').forEach(el=>el.disabled=false);input.value='';}
 });
}
