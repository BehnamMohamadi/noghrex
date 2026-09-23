import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'noghrex_auth';

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: env.authCookieDays * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

export function clearAuthCookieOptions() {
  const { maxAge, ...options } = authCookieOptions();
  return options;
}
