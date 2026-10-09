import {icon} from './ui.js';
export function syncFavorites(user){
 const ids=new Set((user?.favoriteProductIds||[]).map(String));
 for(const el of document.querySelectorAll('[data-action="favorite"]')){
  const saved=ids.has(el.dataset.id);el.setAttribute('aria-pressed',String(saved));
  el.classList.toggle('is-favorite',saved);el.setAttribute('aria-label',saved?'حذف از علاقه‌مندی‌ها':'افزودن به علاقه‌مندی‌ها');
  el.innerHTML=icon('heart',el.classList.contains('icon-button')?22:17)+(el.classList.contains('icon-button')?'':saved?' ذخیره‌شده':' ذخیره');
 }
}
