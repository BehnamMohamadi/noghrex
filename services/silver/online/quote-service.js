import { Quote } from '../../../models/silver/online/quote-model.js';
import { AppError } from '../../../errors/app-error.js';
import { getCurrentOnlinePrice } from './online-price-service.js';
import { getFinancialSettings } from '../../settings/settings-service.js';
import { floorProduct } from '../../../utils/money.js';

function floor(value) { return Math.floor(value); }
function assertXAmount(xAmount) {
  if (!Number.isSafeInteger(xAmount) || xAmount <= 0) throw new AppError('مقدار X باید عدد صحیح مثبت باشد.', 400, 'INVALID_X_AMOUNT');
}

export async function createQuote(userId, { side, xAmount }) {
  if (!['buy', 'sell'].includes(side)) throw new AppError('نوع معامله نامعتبر است.', 400, 'INVALID_TRADE_SIDE');
  assertXAmount(xAmount);
  const [price, settings] = await Promise.all([getCurrentOnlinePrice(), getFinancialSettings()]);
  const trading = settings.trading || {};
  const min = side === 'buy' ? trading.minBuyX : trading.minSellX;
  const max = side === 'buy' ? trading.maxBuyX : trading.maxSellX;
  if (min && xAmount < min) throw new AppError('مقدار X از حداقل معامله کمتر است.', 400, 'TRADE_BELOW_MINIMUM');
  if (max && xAmount > max) throw new AppError('مقدار X از سقف معامله بیشتر است.', 400, 'TRADE_ABOVE_MAXIMUM');

  // From NOGHREX perspective: user BUY uses platform sell price; user SELL uses platform buy price.
  const pricePer1000X = side === 'buy' ? price.sellPricePer1000X : price.buyPricePer1000X;
  const commissionPercent = side === 'buy' ? trading.buyCommissionPercent : trading.sellCommissionPercent;
  const grossToman = floorProduct(xAmount, pricePer1000X, 1000);
  const commissionToman = floorProduct(grossToman, commissionPercent, 100);
  const finalToman = side === 'buy' ? grossToman + commissionToman : grossToman - commissionToman;
  if (!Number.isSafeInteger(finalToman) || finalToman <= 0) throw new AppError('ارزش نهایی معامله معتبر نیست.', 400, 'INVALID_TRADE_VALUE');

  const ttlSeconds = Number(trading.quoteTtlSeconds) || 120;
  return Quote.create({
    userId, side, xAmount, pricePer1000X, grossToman, commissionPercent, commissionToman, finalToman,
    priceSource: price.source, priceEffectiveAt: price.effectiveAt,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000)
  });
}

export async function getUserQuote(userId, quoteId) {
  const quote = await Quote.findOne({ _id: quoteId, userId }).lean();
  if (!quote) throw new AppError('Quote پیدا نشد.', 404, 'QUOTE_NOT_FOUND');
  return quote;
}
