import { env } from '../../config/env.js';
import { AppError } from '../../errors/app-error.js';

export async function sendOtpSms(phoneNumber, code) {
  // Provider adapter point. Replace this branch when the SMS provider is selected.
  if (env.nodeEnv === 'production') {
    throw new AppError('سرویس پیامک هنوز پیکربندی نشده است.', 503, 'SMS_PROVIDER_NOT_CONFIGURED');
  }

  // Development only; never return OTP from an API response.
  console.info(`[DEV OTP] ${phoneNumber}: ${code}`);
}
