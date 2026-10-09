import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetToX,estimateTrade} from '../public/customer/trade-budget.js';

test('budget conversion includes commission and chooses the maximum affordable whole X',()=>{
  for(const price of [95000,100000,105000.37]) for(const commission of [0,0.25,2,100]) for(const budget of [1,100,1000000,50000000]) {
    const x=budgetToX(budget,price,commission);
    if(x){assert.ok(estimateTrade(x,price,commission).final<=budget);assert.ok(estimateTrade(x+1,price,commission).final>budget);}
  }
  assert.deepEqual(estimateTrade(1000,100000,2),{gross:100000,fee:2000,final:102000});
  assert.deepEqual(estimateTrade(1000,100000,2,'sell'),{gross:100000,fee:2000,final:98000});
});
test('invalid budgets, fractional X and overflow cannot produce a payable estimate',()=>{
  for(const budget of [-1,0,NaN,Infinity,1.1])assert.equal(budgetToX(budget,100000,2),0);
  assert.equal(estimateTrade(1.5,100000,2),null);
  assert.equal(estimateTrade(Number.MAX_SAFE_INTEGER,Number.MAX_VALUE,2),null);
});
