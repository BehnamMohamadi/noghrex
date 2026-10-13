import Joi from 'joi';
const nullableLimit=Joi.number().integer().positive().allow(null);
const method=Joi.object({enabled:Joi.boolean().required(),perTransactionLimit:nullableLimit.required(),dailyLimit:nullableLimit.required()});
const baseFinancialSettingsSchema=Joi.object({deposit:Joi.object({gateway:method.required(),card_to_card:method.required(),iban:method.required()}).required(),withdrawal:Joi.object({enabled:Joi.boolean().required(),perTransactionLimit:nullableLimit.required(),dailyLimit:nullableLimit.required(),minimumAmount:nullableLimit.required(),feeAmount:Joi.number().integer().min(0).required()}).required(),account:Joi.object({maxBankAccountsPerUser:Joi.number().integer().min(1).max(20).required()}).required(),trading:Joi.object({minBuyX:Joi.number().integer().min(1).required(),minSellX:Joi.number().integer().min(1).required(),maxBuyX:nullableLimit.required(),maxSellX:nullableLimit.required(),buyCommissionPercent:Joi.number().min(0).max(100).required(),sellCommissionPercent:Joi.number().min(0).max(100).required(),quoteTtlSeconds:Joi.number().integer().min(1).required(),roundingMode:Joi.string().valid('floor').required()}).required()});

export const financialSettingsSchema=baseFinancialSettingsSchema.keys({checkout:Joi.object({ttlSeconds:Joi.number().integer().min(30).max(3600).required(),paymentTtlSeconds:Joi.number().integer().min(30).max(3600).required()}),physical:Joi.object({wageType:Joi.string().valid('fixed','percent').required(),wageValue:Joi.number().min(0).required(),profitPercent:Joi.number().min(0).max(100).required(),taxPercent:Joi.number().min(0).max(100).required()})});

export const silverFeedSettingsSchema = Joi.object({
  enabled: Joi.boolean().required(),
  provider: Joi.string().valid('servix').required(),
  intervalSeconds: Joi.number().integer().min(60).max(86400).required(),
  dailyRequestLimit: Joi.number().integer().min(2).max(100000).required(),
  buybackDiscountPercent: Joi.number().min(0).max(99).default(2),
  expectedRevision: Joi.number().integer().min(0).required()
}).custom((value, helpers) => Math.ceil(86400 / value.intervalSeconds) * 2 > value.dailyRequestLimit
  ? helpers.error('any.custom', { message: 'فاصله دریافت با سقف روزانه API سازگار نیست.' }) : value);
