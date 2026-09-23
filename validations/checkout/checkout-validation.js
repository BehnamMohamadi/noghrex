import Joi from 'joi';
export const createCheckoutSchema={body:Joi.object({addressId:Joi.string().hex().length(24).required(),shippingMethodId:Joi.string().hex().length(24).required()})};
