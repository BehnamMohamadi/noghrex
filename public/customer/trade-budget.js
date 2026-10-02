// Exact decimal-ratio arithmetic, matching the server's floor rounding.
function floorProduct(a,b,divisor){
 const ratio=n=>{if(!Number.isFinite(n)||n<0)throw Error('invalid');const [coefficient,exp='0']=String(n).toLowerCase().split('e');const [whole,fraction='']=coefficient.split('.');const scale=fraction.length-Number(exp);return scale>=0?[BigInt(whole+fraction),10n**BigInt(scale)]:[BigInt(whole+fraction)*10n**BigInt(-scale),1n];};
 const [an,ad]=ratio(a),[bn,bd]=ratio(b);const result=Number(an*bn/(ad*bd*BigInt(divisor)));if(!Number.isSafeInteger(result))throw Error('overflow');return result;
}
export function estimateTrade(x,price,commission,side='buy'){
 if(!Number.isSafeInteger(x)||x<0||!Number.isFinite(price)||price<=0||!Number.isFinite(commission)||commission<0||commission>100)return null;
 try{const gross=floorProduct(x,price,1000),fee=floorProduct(gross,commission,100),final=side==='buy'?gross+fee:gross-fee;return Number.isSafeInteger(final)?{gross,fee,final}:null;}catch{return null;}
}
export function budgetToX(budget,price,commission){
 if(!Number.isSafeInteger(budget)||budget<1||!estimateTrade(0,price,commission))return 0;
 let low=0,high=Number.MAX_SAFE_INTEGER;
 while(low<high){const mid=low+Math.ceil((high-low)/2),quote=estimateTrade(mid,price,commission);if(quote&&quote.final<=budget)low=mid;else high=mid-1;}
 return estimateTrade(low,price,commission)?.final>0?low:0;
}
