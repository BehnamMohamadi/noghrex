import rateLimit from 'express-rate-limit';

function limiter({ windowMs, limit, message, code }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { status: 'fail', code, message }
  });
}

export const otpSendLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  code: 'OTP_SEND_RATE_LIMIT',
  message: 'تعداد درخواست‌های ارسال کد بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.'
});

export const otpVerifyLimiter = limiter({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  code: 'OTP_VERIFY_RATE_LIMIT',
  message: 'تعداد تلاش‌های تأیید کد بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.'
});

export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  code: 'LOGIN_RATE_LIMIT',
  message: 'تعداد تلاش‌های ورود بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.'
});
