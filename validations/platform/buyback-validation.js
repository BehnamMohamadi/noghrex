import Joi from 'joi';

export const adjustBuybackBudgetSchema = Joi.object({
  type: Joi.string().valid('increase', 'decrease').required(),
  amountToman: Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).required(),
  reason: Joi.string().trim().min(2).max(1000).required(),
  idempotencyKey: Joi.string().trim().min(8).max(120).required()
});
