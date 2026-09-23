import { AppError } from '../errors/app-error.js';
import { env } from '../config/env.js';
export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.cookies?.noghrex_auth || req.get('authorization')?.startsWith('Bearer ')) return next();
  if (req.get('X-Requested-With') !== 'NOGHREX') return next(new AppError('هدر درخواست معتبر نیست.', 403, 'CSRF_REJECTED'));
  const origin = req.get('origin');
  if (origin && !env.corsOrigins.includes(origin)) return next(new AppError('مبدأ درخواست معتبر نیست.', 403, 'ORIGIN_REJECTED'));
  next();
}
