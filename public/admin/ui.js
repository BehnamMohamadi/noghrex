export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export const number = (value, digits = 3) => value == null ? '—' : new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(value);
export const money = value => value == null ? 'تعیین نشده' : `${number(value, 0)} <span class="unit">تومان</span>`;
export function date(value, time = false) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? esc(value) : new Intl.DateTimeFormat('fa-IR', { timeZone:'Asia/Tehran', year:'numeric', month:'2-digit', day:'2-digit', ...(time ? { hour:'2-digit', minute:'2-digit' } : {}) }).format(d); }
export const id = value => typeof value === 'object' ? value?._id : value;
export const shortId = value => value ? `<span class="record-id">${esc(String(id(value)).slice(-8).toUpperCase())}</span>` : '—';
export const person = value => value && typeof value === 'object' ? `<span class="cell-title">${esc([value.firstname,value.lastname].filter(Boolean).join(' ') || 'کاربر')}</span><span class="cell-sub ltr">${esc(value.phoneNumber)}</span>` : shortId(value);
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  silver:'m12 3 9 6v9l-9 4-9-4V9z M3 9l9 5 9-5 M12 14v8 M7 6l10 5',
  trend:'m3 17 6-6 4 4 8-10 M15 5h6v6',
  wallet:'M3 6h16v3H3V6Zm0 3v11h18V9H3Zm13 4h5v4h-5z M5 6V4h12v2',
  users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87',
  orders:'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4',
  box:'m12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5',
  bank:'m3 8 9-5 9 5H3z M5 10v8 M10 10v8 M15 10v8 M20 10v8 M3 21h18',
  card:'M3 5h18v14H3z M3 9h18 M6 15h4',
  shield:'m12 3 8 3v6c0 5-8 10-8 10S4 17 4 12V6z m-4 9 3 3 5-6',
  settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8 M10 21h4',
  history:'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l4 2',
  truck:'M1 5h13v12H1z M14 9h4l4 4v4h-8 M5 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6 M18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  refund:'M3 10h12a6 6 0 0 1 0 12 M3 10l5-5 M3 10l5 5',
  search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',
  arrow:'m14 6-6 6 6 6', plus:'M12 5v14 M5 12h14', close:'m6 6 12 12 M6 18 18 6',
  refresh:'M20 7a9 9 0 1 0 1 9 M20 2v5h-5', download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',
  logout:'M9 4H3v16h6 M12 12h10 M18 8l4 4-4 4', menu:'M4 6h16 M4 12h16 M4 18h16',
  check:'m5 12 4 4L19 6', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  list:'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01', coin:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20 M15 7H9v5h6v5H9 M12 5v2 M12 17v2'
};
export const icon = (name, size = 19) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.list}"/></svg>`;
export const labels = {
  active:'فعال',inactive:'غیرفعال',suspended:'معلق',deactivated:'غیرفعال',pending:'در انتظار بررسی',approved:'تأییدشده',processing:'در حال پردازش',completed:'تکمیل‌شده',rejected:'ردشده',failed:'ناموفق',cancelled:'لغوشده',expired:'منقضی',verified:'تأییدشده',requested:'درخواست جدید',refunded:'بازپرداخت‌شده',
  pending_payment:'در انتظار پرداخت',confirmed:'تأیید سفارش',shipped:'ارسال‌شده',delivered:'تحویل‌شده',manual_review:'بررسی دستی',paid:'پرداخت‌شده',unpaid:'پرداخت‌نشده',buy:'فروش نقرکس به کاربر',sell:'خرید نقرکس از کاربر',increase:'افزایش',decrease:'کاهش',trade_buy:'فروش به کاربر',trade_sell:'خرید از کاربر',
  open:'باز',resolved:'رسیدگی‌شده',posted:'ثبت‌شده',reversed:'برگشت‌خورده',gateway:'درگاه',card_to_card:'کارت‌به‌کارت',iban:'شبا',wallet:'کیف پول',manual:'دستی',provider:'سرویس قیمت',mock:'آزمایشی',admin:'مدیر',user:'کاربر',system:'سیستم',standard:'عمومی',custom:'اختصاصی',percent:'درصدی',fixed:'مبلغ ثابت',
  sale:'فروش',return:'مرجوعی',adjustment:'اصلاح موجودی',deposit:'واریز',withdrawal:'برداشت',x_buy:'خرید X',x_sell:'فروش X',order_payment:'پرداخت سفارش',wallet_deposit:'شارژ کیف پول',refund:'بازپرداخت',transfer:'انتقال',stale:'قدیمی',unavailable:'نامعتبر',critical:'بحرانی',warning:'هشدار',info:'اطلاع',debit:'بدهکار',credit:'بستانکار',available:'آزاد',locked:'قفل‌شده',TOMAN:'تومان',X:'X'
};
export const label = value => labels[value] || String(value ?? '—');
export const badge = value => { const color = ['active','completed','verified','approved','paid','confirmed','delivered','resolved','posted'].includes(value) ? 'green' : ['rejected','failed','suspended','cancelled','critical','unavailable'].includes(value) ? 'red' : ['pending','requested','pending_payment','manual_review','open','processing'].includes(value) ? 'amber' : 'blue'; return `<span class="badge ${color}">${esc(label(value))}</span>`; };
export const empty = (title = 'هنوز رکوردی ثبت نشده', description = 'پس از ثبت اطلاعات، آن‌ها را در این بخش می‌بینید.') => `<div class="empty"><div class="empty-icon">${icon('box',26)}</div><h3>${esc(title)}</h3><p>${esc(description)}</p></div>`;
export const btn = (title, action, symbol, css = '', extra = '') => `<button type="button" class="btn ${css}" data-action="${action}" ${extra}>${symbol ? icon(symbol,16) : ''}${esc(title)}</button>`;
export function toast(message, error = false) { const node = document.createElement('div'); node.className = 'toast' + (error ? ' error' : ''); node.innerHTML = `${icon(error?'bell':'check',18)}<span>${esc(message)}</span><button type="button" aria-label="بستن پیام">×</button>`; node.querySelector('button').onclick = () => node.remove(); document.querySelector('#toasts').append(node); setTimeout(() => node.remove(), 6500); }
export function normalizeDigits(value) { return String(value).replace(/[۰-۹٠-٩]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c) >= 0 ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(c) : '٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[,٬]/g,''); }
export async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, { credentials:'same-origin', ...options, headers:{ 'Content-Type':'application/json', 'X-Requested-With':'NOGHREX', ...options.headers }, ...(options.body ? { body:JSON.stringify(options.body) } : {}) }); }
  catch { throw new Error('ارتباط با سرور برقرار نشد. اتصال را بررسی و دوباره تلاش کنید.'); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.message || 'عملیات انجام نشد.'); error.status = response.status; error.code = body.code; error.details = body.details; if (response.status === 401) window.dispatchEvent(new CustomEvent('session-expired')); throw error; }
  return body.data;
}
