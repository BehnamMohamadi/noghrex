import {api,digits,formModal,toast} from './ui.js';

export async function openBankForm(ctx) {
  const {banks=[]}=await api('/account/bank-accounts/allowed-banks');
  const messages={bankName:'نام بانک را بین ۲ تا ۱۰۰ کاراکتر وارد کن.',cardNumber:'شماره کارت باید دقیقاً ۱۶ رقم باشد.',iban:'شماره شبا باید دقیقاً ۲۴ رقم بعد از IR داشته باشد.'};
  const input=(name,label,extra='')=>`<label class="field"><span>${label}</span>${name==='iban'?'<div class="iban-input" dir="ltr"><span aria-hidden="true">IR</span>':''}<input name="${name}" aria-describedby="${name}-error" ${extra}>${name==='iban'?'</div>':''}<small class="bank-field-error" id="${name}-error" aria-live="polite"></small></label>`;
  const bankSelect=`<label class="field"><span>نام بانک</span><select name="bankName" required><option value="">انتخاب بانک</option>${banks.map(name=>`<option value="${String(name).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}">${String(name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</option>`).join('')}</select><small class="bank-field-error" id="bankName-error" aria-live="polite"></small></label>`;
  formModal('حساب بانکی جدید',bankSelect+input('cardNumber','شماره کارت ۱۶ رقمی','inputmode="numeric" dir="ltr" maxlength="19" placeholder="0000 0000 0000 0000" autocomplete="off"')+input('iban','شماره شبا؛ IR ثابت + ۲۴ رقم','inputmode="numeric" dir="ltr" maxlength="29" placeholder="0000 0000 0000 0000 0000 0000" autocomplete="off"')+'<p class="note">اطلاعات حساب پس از ثبت، توسط مدیر بررسی می‌شود.</p>',async(v,f)=>{
    const cardNumber=digits(v.cardNumber).replace(/\s/g,''),iban='IR'+digits(v.iban).replace(/\s/g,''),bankName=v.bankName.trim();
    const errors=[];
    if(bankName.length<2||bankName.length>100)errors.push('bankName');
    if(!/^\d{16}$/.test(cardNumber))errors.push('cardNumber');
    if(!/^IR\d{24}$/.test(iban))errors.push('iban');
    for(const name of Object.keys(messages))mark(f,name,errors.includes(name)?messages[name]:'');
    if(errors.length){f.elements[errors[0]].focus();throw Error(errors.map(n=>messages[n]).join(' '));}
    try{await api('/account/bank-accounts',{method:'POST',body:{bankName,cardNumber,iban}});}catch(e){
      if(e.code==='VALIDATION_ERROR'&&Array.isArray(e.details)){
        const fields=[...new Set(e.details.map(d=>d.path).filter(n=>messages[n]))];
        if(fields.length){fields.forEach(n=>mark(f,n,messages[n]));f.elements[fields[0]].focus();throw Error(fields.map(n=>messages[n]).join(' '));}
      }
      throw e;
    }
    toast('حساب بانکی ثبت شد.');ctx.refresh();
  });
  const f=document.querySelector('#modal-form');
  for(const name of ['cardNumber','iban']){
    const el=f.elements[name];
    el.addEventListener('input',()=>{
      const raw=digits(el.value),caret=el.selectionStart??raw.length;
      const before=raw.slice(0,caret).replace(/\D/g,'').length;
      const expected=name==='iban'?24:16;
      const clean=raw.replace(/\D/g,'').slice(0,expected);
      el.value=clean.replace(/(.{4})(?=.)/g,'$1 ');
      const pos=Math.min(el.value.length,before+Math.floor(Math.max(0,before-1)/4));
      el.setSelectionRange(pos,pos);
      mark(f,name,'');
    });
    el.addEventListener('blur',()=>{const count=el.value.replace(/\s/g,'').length;mark(f,name,count===(name==='iban'?24:16)?'':messages[name]);});
  }
  f.elements.bankName.addEventListener('change',()=>mark(f,'bankName',''));
}
function mark(form,name,message){form.querySelector('#'+name+'-error').textContent=message;form.elements[name].setAttribute('aria-invalid',String(Boolean(message)));}
