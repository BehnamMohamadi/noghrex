import {api,esc,number,money,date,heading,link,button,empty,row} from './ui.js';

const withdrawalStates={
 pending:['در انتظار بررسی','درخواست ثبت شده؛ قدم بعدی بررسی توسط مدیر است. مبلغ درخواست تا تعیین تکلیف قفل می‌ماند.',0],
 approved:['تأییدشده','درخواست تأیید شده؛ قدم بعدی شروع انتقال بانکی است.',1],
 processing:['در حال انتقال بانکی','انتقال در حال رسیدگی است؛ پس از ثبت نتیجه، شماره پیگیری اینجا نمایش داده می‌شود.',2],
 completed:['انتقال ثبت شد','انتقال توسط مدیر ثبت شده است. برای پیگیری بانکی از شماره پیگیری استفاده کن.',3],
 rejected:['درخواست رد شد','وجه درخواست به موجودی قابل استفاده کیف پول برگشته است. دلیل را بررسی کن.',-1],
 failed:['انتقال ناموفق','عدم انتقال بانکی تأیید شده و وجه به موجودی قابل استفاده برگشته است.',-1],
 cancelled:['لغوشده','این درخواست لغو شده است؛ موجودی فعلی را در کیف پول ببین.',-1]
};
function depositState(r,p,unavailable){
 if(r.status==='completed')return ['کیف پول شارژ شد','مبلغ به موجودی تومانی اضافه شده و قابل استفاده است.',2];
 if(['rejected','failed','cancelled'].includes(r.status))return [r.status==='rejected'?'واریز رد شد':r.status==='failed'?'واریز ناموفق':'لغوشده','این درخواست کیف پول را شارژ نکرده است. جزئیات زیر را بررسی کن.',-1];
 if(r.method!=='gateway')return ['در انتظار بررسی رسید','رسید واریز در صف بررسی است؛ پس از تأیید، مبلغ به کیف پول اضافه می‌شود.',1];
 if(unavailable)return ['وضعیت پرداخت دریافت نشد','ارتباط با سرویس پیگیری برقرار نشد. قبل از پرداخت دوباره، وضعیت همین درخواست را به‌روز کن.',0];
 if(p?.status==='verified')return ['در حال به‌روزرسانی','پرداخت تأیید شده؛ صفحه را به‌روز کن تا وضعیت شارژ نمایش داده شود.',1];
 if(['expired','cancelled','failed'].includes(p?.status))return [({expired:'مهلت پرداخت پایان یافته',cancelled:'پرداخت لغوشده',failed:'پرداخت ناموفق'})[p.status],'شارژ این درخواست تکمیل نشده است. اگر وجه از بانک کم شده، پیش از پرداخت دوباره نتیجه همین پرداخت را پیگیری کن.',-1];
 return [p?'در انتظار نتیجه پرداخت':'آماده پرداخت',p?'هنوز تأیید نهایی ثبت نشده است. وضعیت همین پرداخت را پیگیری کن.':'درخواست شارژ ساخته شده؛ برای ادامه، پرداخت همین درخواست را باز کن.',0];
}
export async function walletHistoryView(kind,page=1){
 const withdrawal=kind==='withdrawals',data=await api('/wallet/'+kind+'?page='+page+'&limit=15'),d=data[kind],records=d.items||[];
 const payments=new Map(),unavailable=new Set();
 if(!withdrawal)await Promise.all(records.filter(r=>r.method==='gateway'&&r.paymentId).map(async r=>{const id=String(r.paymentId);try{payments.set(id,(await api('/payments/'+encodeURIComponent(id))).payment);}catch(e){if(e.status===401)throw e;unavailable.add(id);}}));
 const cards=records.map(r=>{
  const p=payments.get(String(r.paymentId)),missing=unavailable.has(String(r.paymentId));
  const [title,next,step]=withdrawal?(withdrawalStates[r.status]||['وضعیت نامشخص','برای دریافت آخرین وضعیت، صفحه را به‌روز کن.',-1]):depositState(r,p,missing);
  const stages=withdrawal?['ثبت درخواست','تأیید مدیر','انتقال بانکی','ثبت نتیجه']:['ثبت درخواست',r.method==='gateway'?'بررسی پرداخت':'بررسی رسید','شارژ کیف پول'];
  const finished=['completed','rejected','failed','cancelled'].includes(r.status)||step<0;
  const reference=withdrawal?r.bankReference:(p?.referenceId||r.transferReference);
  return `<article class="panel tracking-card"><div class="tracking-head"><div><span class="eyebrow">${withdrawal?'برداشت بانکی':r.method==='gateway'?'شارژ از درگاه':'واریز دستی'}</span><h2>${money(withdrawal?r.finalAmount:r.amount)}</h2></div><span class="badge ${r.status==='completed'?'good':step<0?'bad':''}">${esc(title)}</span></div><ol class="tracking-steps" aria-label="مراحل درخواست">${stages.map((label,i)=>`<li class="${step>=i?'reached':''}" ${step===i?'aria-current="step"':''}><span>${number(i+1)}</span>${esc(label)}</li>`).join('')}</ol><p class="note"><strong>${finished?'نتیجه':'قدم بعدی'}: </strong>${esc(next)}</p>${!finished?'<p class="tracking-time">زمان قطعی تکمیل هنوز اعلام نشده است؛ آخرین وضعیت با دکمه به‌روزرسانی دریافت می‌شود.</p>':''}${r.rejectionReason||r.failureReason?`<p class="error">${esc(r.rejectionReason||r.failureReason)}</p>`:''}<details><summary>زمان‌ها و اطلاعات پیگیری</summary>${row('شناسه درخواست',`<bdi>${esc(r._id)}</bdi>`)}${row('زمان ثبت',date(r.requestedAt||r.createdAt))}${r.reviewedAt?row('زمان بررسی',date(r.reviewedAt)):''}${r.completedAt?row('زمان تکمیل',date(r.completedAt)):''}${withdrawal?row('مبلغ درخواست',money(r.amount))+row('کارمزد',money(r.feeAmount))+row('خالص انتقال',money(r.finalAmount)):''}${row('شماره پیگیری بانکی',reference?`<bdi>${esc(reference)}</bdi>`:'هنوز ثبت نشده')}${r.paymentId?row('شناسه پرداخت',`<bdi>${esc(r.paymentId)}</bdi>`):''}</details>${!withdrawal&&r.method==='gateway'&&!missing&&['pending','processing'].includes(r.status)&&(!p||p.status==='pending')?`<div class="button-row">${button(p?'مشاهده همین پرداخت':'ادامه پرداخت','resume-deposit','small',`data-id="${esc(r._id)}"`)}</div>`:''}</article>`;
 }).join('');
 return {html:`<div class="wrap page-main">${heading(withdrawal?'پیگیری برداشت‌ها':'پیگیری واریزها','مبالغ به تومان؛ تاریخ و ساعت به وقت ایران',link('کیف پول','wallet'))}<div class="tracking-toolbar"><span>اطلاعات دریافت‌شده در ${date(new Date())}</span>${button('به‌روزرسانی وضعیت','refresh','small')}</div><div class="tracking-list">${cards||empty(withdrawal?'هنوز برداشت ثبت نکردی':'هنوز واریز ثبت نکردی','درخواست‌های تو همراه با مراحل و نتیجه در این صفحه نمایش داده می‌شوند.',link('رفتن به کیف پول','wallet','primary'))}</div><div class="pagination"><span>صفحه ${number(page)} · ${number(d.total||0)} درخواست</span><div>${page>1?link('قبلی',kind+'/'+(page-1),'small'):''}${page<(d.totalPages||1)?link('بعدی',kind+'/'+(page+1),'small'):''}</div></div></div>`};
}
