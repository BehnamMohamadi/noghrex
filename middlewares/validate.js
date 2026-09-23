import { AppError } from '../errors/app-error.js';

export function validate(schema, property = 'body') {
  schema = schema[property] || schema;
  return (req, res, next) => {
    const { value, error } = schema.validate(req[property], { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new AppError('اطلاعات ارسالی معتبر نیست.', 400, 'VALIDATION_ERROR',
        error.details.map(item => ({ message: item.message, path: item.path.join('.') }))));
    }
    if (property === 'query') Object.defineProperty(req, 'query', { value, configurable: true });
    else req[property] = value;
    next();
  };
}
