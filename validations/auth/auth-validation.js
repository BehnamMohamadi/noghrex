import Joi from 'joi';

const phone = Joi.string().trim().required();

export const requestSignupOtpSchema = Joi.object({
  phoneNumber: phone
});

export const verifySignupOtpSchema = Joi.object({
  phoneNumber: phone,
  code: Joi.string().pattern(/^\d{6}$/).required()
});

export const signupSchema = Joi.object({
  signupToken: Joi.string().hex().length(64).required(),
  firstname: Joi.string().trim().min(1).max(80).required(),
  lastname: Joi.string().trim().min(1).max(100).required(),
  password: Joi.string().min(8).max(72).required(),
  email: Joi.string().trim().email().allow(null, '').optional()
});

export const loginSchema = Joi.object({
  phoneNumber: phone,
  password: Joi.string().min(1).max(72).required()
});
