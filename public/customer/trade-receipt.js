import {api,esc,number,money,date,row,badge,showModal,button,link} from './ui.js';
export async function openTradeReceipt(id){
 const {trade:t}=await api('/silver/online/trades/'+encodeURIComponent(id));
 const rows=[['شناسه پیگیری',esc(t._id)],['وضعیت',badge(t.status)],['نوع معامله',t.side==='buy'?'خرید نقره':'فروش نقره'],['مقدار نقره',number(t.xAmount)+' X'],['معادل وزنی',number(t.xAmount/1000)+' گرم'],['نرخ هر گرم',money(t.pricePer1000X)],['اصل مبلغ',money(t.grossToman)],['کمیسیون ('+number(t.commissionPercent)+'٪)',money(t.commissionToman)],[t.side==='buy'?'مبلغ پرداختی':'مبلغ دریافتی',money(t.finalToman)],['زمان معامله',date(t.executedAt||t.createdAt)]];
 const content=rows.map(([k,v])=>row(k,v)).join('');
 showModal('رسید معامله نقرکس',content+'<p class="note">رسید ثبت معامله در نقرکس؛ این سند فاکتور رسمی مالیاتی نیست.</p>'+button('دانلود رسید HTML','download-trade-receipt','primary')+link('سوابق معاملات','trades','ghost'));
 document.querySelector('[data-action=download-trade-receipt]').onclick=()=>{
 const html='<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رسید نقرکس</title><style>body{font-family:Tahoma,sans-serif;max-width:650px;margin:40px auto;padding:24px;color:#15383d;line-height:2}.summary-row{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ddd;padding:10px}strong{overflow-wrap:anywhere}small{font-size:12px}@media print{body{margin:0}}</style><h1>نقرکس | رسید معامله</h1>'+content+'<p>رسید ثبت معامله؛ فاکتور رسمی مالیاتی نیست.</p></html>';
 const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='noghrex-trade-'+t._id+'.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
}
