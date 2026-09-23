import Joi from 'joi';
export const createWithdrawalSchema=Joi.object({idempotencyKey:Joi.string().trim().min(8).max(120).required(),amount:Joi.number().integer().positive().required(),bankAccountId:Joi.string().hex().length(24).required()});
export const rejectWithdrawalSchema=Joi.object({reason:Joi.string().trim().min(2).max(500).required()});
export const completeWithdrawalSchema=Joi.object({bankReference:Joi.string().trim().min(1).max(150).required()});
