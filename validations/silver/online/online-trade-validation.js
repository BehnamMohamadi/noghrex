import Joi from 'joi';
export const createQuoteSchema = Joi.object({ side: Joi.string().valid('buy','sell').required(), xAmount: Joi.number().integer().min(1).required() });
export const executeTradeSchema = Joi.object({ quoteId: Joi.string().hex().length(24).required() });
