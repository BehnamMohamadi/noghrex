export const ASSETS = Object.freeze({ TOMAN: 'TOMAN', X: 'X' });
export const BALANCE_TYPES = Object.freeze({ AVAILABLE: 'available', LOCKED: 'locked' });
export const PLATFORM_ACCOUNT_TYPES = Object.freeze({
  GATEWAY_RECEIPTS: 'gateway_receipts',
  SILVER_SALES: 'silver_sales',
  SILVER_PURCHASES: 'silver_purchases',
  BUY_COMMISSION: 'buy_commission',
  SELL_COMMISSION: 'sell_commission',
  BUYBACK_BUDGET: 'buyback_budget',
  BUYBACK_SETTLEMENT: 'buyback_settlement',
  TREASURY_ALLOCATION: 'treasury_allocation'
});
export const LEDGER_OWNER_TYPES = Object.freeze({ USER: 'user', PLATFORM: 'platform' });
export const LEDGER_DIRECTIONS = Object.freeze({ DEBIT: 'debit', CREDIT: 'credit' });
export const LEDGER_TRANSACTION_STATUSES = Object.freeze({ PENDING: 'pending', POSTED: 'posted', REVERSED: 'reversed' });
