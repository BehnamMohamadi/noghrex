import Joi from 'joi';
export const adjustOnlineInventorySchema = Joi.object({
  type: Joi.string().valid('increase', 'decrease').required(),
  amountX: Joi.number().integer().min(1).required(),
  reason: Joi.string().trim().min(2).max(1000).required(),
  idempotencyKey: Joi.string().trim().min(8).max(200).required()
});
