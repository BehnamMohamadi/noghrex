import Joi from 'joi';

export const updateAccountSchema = Joi.object({
  firstname: Joi.string().trim().min(1).max(80),
  lastname: Joi.string().trim().min(1).max(100),
  email: Joi.string().trim().email().allow(null, '')
}).min(1);
