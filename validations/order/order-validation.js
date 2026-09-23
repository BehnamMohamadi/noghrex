import Joi from 'joi';
export const createOrderSchema={body:Joi.object({checkoutSessionId:Joi.string().hex().length(24).required(),paymentMethod:Joi.string().valid('wallet','gateway').required()})};
