import Joi from 'joi';
export const shippingMethodSchema={body:Joi.object({name:Joi.string().max(120).required(),description:Joi.string().max(500).allow(null,''),cost:Joi.number().integer().min(0).required(),freeAbove:Joi.number().integer().min(0).allow(null),active:Joi.boolean(),sortOrder:Joi.number().integer(),provinceRestrictions:Joi.array().items(Joi.string().max(100))})};
