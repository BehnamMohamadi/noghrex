import { AppError } from '../errors/app-error.js';
export function integer(value, min = 0) {
  if (!Number.isSafeInteger(value) || value < min) throw new AppError('مبلغ یا تعداد خارج از محدوده مجاز است.', 400, 'INVALID_FINANCIAL_VALUE');
  return value;
}
// Decimal input is converted to integer ratios before any arithmetic; no binary rounding drift.
export function floorProduct(a, b, divisor = 1) {
  function ratio(n) {
    if (!Number.isFinite(n) || n < 0) throw new AppError('مقدار نامعتبر است.', 400, 'INVALID_FINANCIAL_VALUE');
    const [coefficient, exponent = '0'] = String(n).toLowerCase().split('e');
    const [whole, fraction = ''] = coefficient.split('.');
    const scale = fraction.length - Number(exponent);
    return scale >= 0 ? [BigInt(whole + fraction), 10n ** BigInt(scale)] : [BigInt(whole + fraction) * 10n ** BigInt(-scale), 1n];
  }
  const [an, ad] = ratio(a), [bn, bd] = ratio(b), [dn, dd] = ratio(divisor);
  if (dn === 0n) throw new AppError('مقسوم علیه صفر است.', 400, 'INVALID_FINANCIAL_VALUE');
  return integer(Number((an * bn * dd) / (ad * bd * dn)));
}
