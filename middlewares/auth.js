import { User } from '../models/account/user-model.js';
import { AppError } from '../errors/app-error.js';
import { verifyAuthToken } from '../utils/auth-token.js';
import { AUTH_COOKIE_NAME } from '../utils/cookie.js';
import { asyncHandler } from '../utils/async-handler.js';

function readToken(req) {
  if (req.cookies?.[AUTH_COOKIE_NAME]) return req.cookies[AUTH_COOKIE_NAME];
  const header = req.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

export const authenticate = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) throw new AppError('ابتدا وارد حساب کاربری شوید.', 401, 'AUTH_REQUIRED');

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch {
    throw new AppError('نشست کاربری معتبر نیست.', 401, 'INVALID_SESSION');
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw new AppError('نشست کاربری معتبر نیست.', 401, 'INVALID_SESSION');
  }
  if (user.accountStatus !== 'active') {
    throw new AppError('حساب کاربری فعال نیست.', 403, 'ACCOUNT_NOT_ACTIVE', { accountStatus: user.accountStatus });
  }

  req.user = { id: user.id, _id: user._id, role: user.role, accountStatus: user.accountStatus };
  next();
});

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('دسترسی کافی ندارید.', 403, 'FORBIDDEN'));
    }
    next();
  };
}

export const rejectIfAuthenticated = asyncHandler(async (req, res, next) => {
  const token = readToken(req);
  if (!token) return next();

  try {
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub).select('tokenVersion accountStatus');
    if (user && user.accountStatus === 'active' && user.tokenVersion === payload.tokenVersion) {
      throw new AppError('شما در حال حاضر وارد حساب کاربری خود هستید.', 409, 'ALREADY_AUTHENTICATED');
    }
    return next();
  } catch (error) {
    if (error instanceof AppError) throw error;
    return next();
  }
});
