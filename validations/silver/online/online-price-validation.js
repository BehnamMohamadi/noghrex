import Joi from 'joi';
export const setManualOnlinePriceSchema = Joi.object({
  basePricePer1000X: Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER),
  buyPricePer1000X: Joi.number().integer().min(1),
  sellPricePer1000X: Joi.number().integer().min(1)
}).or('basePricePer1000X','sellPricePer1000X').and('buyPricePer1000X','sellPricePer1000X');
