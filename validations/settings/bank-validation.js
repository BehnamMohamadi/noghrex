import Joi from 'joi';
export const createBankSchema=Joi.object({name:Joi.string().trim().min(2).max(100).required(),active:Joi.boolean().default(true),sortOrder:Joi.number().integer().min(0).max(10000).default(0)});
export const updateBankSchema=Joi.object({name:Joi.string().trim().min(2).max(100),active:Joi.boolean(),sortOrder:Joi.number().integer().min(0).max(10000)}).min(1);
