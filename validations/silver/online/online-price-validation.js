import Joi from 'joi';
export const setManualOnlinePriceSchema = Joi.object({
  buyPricePer1000X: Joi.number().integer().min(1).required(),
  sellPricePer1000X: Joi.number().integer().min(1).required()
});
