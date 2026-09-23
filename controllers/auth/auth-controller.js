import { asyncHandler } from '../../utils/async-handler.js';
import { requestSignupOtp, verifySignupOtp } from '../../services/auth/otp-service.js';
import * as authService from '../../services/auth/auth-service.js';
import { AUTH_COOKIE_NAME, authCookieOptions, clearAuthCookieOptions } from '../../utils/cookie.js';

export const requestOtp = asyncHandler(async (req, res) => {
  const data = await requestSignupOtp(req.body.phoneNumber);
  res.status(200).json({ status: 'success', data });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const data = await verifySignupOtp(req.body.phoneNumber, req.body.code);
  res.status(200).json({ status: 'success', data });
});

export const signup = asyncHandler(async (req, res) => {
  const { user, token } = await authService.signup(req.body);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  res.status(201).json({ status: 'success', data: { user } });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(req.body.phoneNumber, req.body.password);
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());
  res.status(200).json({ status: 'success', data: { user } });
});

export const logout = asyncHandler(async (req, res) => {
  await authService.logoutEverywhere(req.user.id);
  res.clearCookie(AUTH_COOKIE_NAME, clearAuthCookieOptions());
  res.status(200).json({ status: 'success', message: 'با موفقیت خارج شدید.' });
});
