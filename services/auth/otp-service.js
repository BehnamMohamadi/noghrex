import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { OtpVerification } from '../../models/account/otp-model.js';
import { User } from '../../models/account/user-model.js';
import { AppError } from '../../errors/app-error.js';
import { normalizeIranPhone } from '../../utils/phone.js';
import { env } from '../../config/env.js';
import { sendOtpSms } from './sms-service.js';
export async function requestSignupOtp(rawPhoneNumber) {
  if (env.nodeEnv === 'production') throw new AppError('سرویس پیامک واقعی پیکربندی نشده است.', 503, 'SMS_PROVIDER_NOT_CONFIGURED');
  const phoneNumber = normalizeIranPhone(rawPhoneNumber);
  if (await User.exists({ phoneNumber })) throw new AppError('شماره موبایل ثبت شده است.', 409, 'PHONE_ALREADY_EXISTS');
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = await bcrypt.hash(code, 10);
  try {
    await OtpVerification.findOneAndUpdate({ phoneNumber, purpose: 'signup', createdAt: { $lte: new Date(Date.now() - env.otpResendSeconds * 1000) } },
      { $set: { codeHash, attempts: 0, maxAttempts: env.otpMaxAttempts, createdAt: new Date(),
        expiresAt: new Date(Date.now() + env.otpTtlSeconds * 1000), verifiedAt: null, consumedAt: null, signupTokenHash: null } },
      { upsert: true, new: true, timestamps: false, overwriteImmutable: true });
  } catch (error) {
    if (error.code === 11000) throw new AppError('برای ارسال مجدد کد صبر کنید.', 429, 'OTP_RESEND_TOO_SOON');
    throw error;
  }
  await sendOtpSms(phoneNumber, code);
  return { phoneNumber, expiresInSeconds: env.otpTtlSeconds, resendAfterSeconds: env.otpResendSeconds };
}
export async function verifySignupOtp(rawPhoneNumber, code) {
  const phoneNumber = normalizeIranPhone(rawPhoneNumber);
  const otp = await OtpVerification.findOneAndUpdate({
    phoneNumber, purpose: 'signup', consumedAt: null, verifiedAt: null, expiresAt: { $gt: new Date() },
    $expr: { $lt: ['$attempts', '$maxAttempts'] }
  }, { $inc: { attempts: 1 } }, { new: true }).select('+codeHash');
  if (!otp) throw new AppError('کد منقضی، مصرف‌شده یا تعداد تلاش تمام شده است.', 400, 'OTP_EXPIRED_OR_INVALID');
  if (!await bcrypt.compare(String(code), otp.codeHash)) throw new AppError('کد صحیح نیست.', 400, 'INVALID_OTP');
  const signupToken = crypto.randomBytes(32).toString('hex');
  const updated = await OtpVerification.findOneAndUpdate({
    _id: otp._id, codeHash: otp.codeHash, verifiedAt: null, consumedAt: null, expiresAt: { $gt: new Date() }
  }, { $set: { verifiedAt: new Date(), signupTokenHash: crypto.createHash('sha256').update(signupToken).digest('hex') } });
  if (!updated) throw new AppError('کد قبلاً تأیید شده است.', 409, 'OTP_ALREADY_VERIFIED');
  return { phoneNumber, signupToken };
}
