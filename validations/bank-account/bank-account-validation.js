import Joi from 'joi';
export const createBankAccountSchema = Joi.object({
  cardNumber: Joi.string().replace(/\s|-/g, '').pattern(/^\d{16}$/).required(),
  iban: Joi.string().replace(/\s/g, '').uppercase().pattern(/^IR\d{24}$/).required(),
  bankName: Joi.string().trim().min(2).max(100).required(),
  isDefault: Joi.boolean().default(false)
});
export const rejectBankAccountSchema = Joi.object({ rejectionReason: Joi.string().trim().min(3).max(500).required() });
