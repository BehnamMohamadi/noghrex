export function formatAmount(value){
 const plain=String(value).replace(/[۰-۹٠-٩]/g,c=>String(c.charCodeAt(0)-(c>='۰'?1776:1632))).replace(/[٬,]/g,'').replace(/٫/g,'.');
 if(!/^\d*(\.\d*)?$/.test(plain))return String(value);
 const [whole,fraction]=plain.split('.');
 return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(fraction===undefined?'':'.'+fraction);
}
export function formatAmountField(input){
 const old=input.value,position=input.selectionStart??old.length;
 const count=old.slice(0,position).replace(/[٬,]/g,'').length;
 input.value=formatAmount(old);
 let cursor=0,seen=0;
 while(cursor<input.value.length&&seen<count){if(!/[٬,]/.test(input.value[cursor]))seen++;cursor++;}
 if(document.activeElement===input)input.setSelectionRange(cursor,cursor);
}
