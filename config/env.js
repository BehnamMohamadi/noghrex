import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  authCookieDays: Number(process.env.AUTH_COOKIE_DAYS || 7),
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS || 120),
  otpResendSeconds: Number(process.env.OTP_RESEND_SECONDS || 60),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  corsOrigins: [...new Set([
    ...(process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean),
    ...(process.env.ADMIN_ORIGIN ? [process.env.ADMIN_ORIGIN] : []),
    ...(process.env.NODE_ENV !== 'production' ? [`http://127.0.0.1:${process.env.PORT || 3000}`, `http://localhost:${process.env.PORT || 3000}`] : [])
  ])]
};
