import { AppError } from '../errors/app-error.js';

export function notFound(req, res, next) {
  next(new AppError('مسیر موردنظر پیدا نشد.', 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(err, req, res, next) {
  let error = err;
  if (err?.name === 'CastError' || err?.name === 'ValidationError') error = new AppError('اطلاعات ارسالی معتبر نیست.', 400, 'VALIDATION_ERROR');
  if (err?.type === 'entity.parse.failed') error = new AppError('بدنه JSON معتبر نیست.', 400, 'INVALID_JSON');

  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    const map = {
      phoneNumber: ['این شماره موبایل قبلاً ثبت شده است.', 'PHONE_ALREADY_EXISTS'],
      email: ['این ایمیل قبلاً ثبت شده است.', 'EMAIL_ALREADY_EXISTS']
    };
    const [message, code] = map[field] || ['مقدار تکراری است.', 'DUPLICATE_VALUE'];
    error = new AppError(message, 409, code, { field });
  }

  const statusCode = error.statusCode || 500;
  const payload = {
    status: statusCode >= 500 ? 'error' : 'fail',
    code: error.code || 'INTERNAL_ERROR',
    message: error.isOperational ? error.message : 'خطای داخلی سرور.'
  };
  if (error.details) payload.details = error.details;
  if (process.env.NODE_ENV !== 'production' && !error.isOperational) payload.stack = error.stack;

  res.status(statusCode).json(payload);
}
