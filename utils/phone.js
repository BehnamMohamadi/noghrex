import { AppError } from '../errors/app-error.js';

export function normalizeIranPhone(input) {
  const value = String(input || '').replace(/[\s-]/g, '');
  let normalized = value;
  if (/^\+98\d{10}$/.test(value)) normalized = `0${value.slice(3)}`;
  else if (/^98\d{10}$/.test(value)) normalized = `0${value.slice(2)}`;
  if (!/^09\d{9}$/.test(normalized)) {
    throw new AppError('شماره موبایل معتبر نیست.', 400, 'INVALID_PHONE_NUMBER');
  }
  return normalized;
}
