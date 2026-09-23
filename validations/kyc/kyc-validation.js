import Joi from 'joi';
import { isValidIranianNationalId } from '../../utils/national-id.js';

export const submitKycSchema = Joi.object({
  nationalId: Joi.string().pattern(/^\d{10}$/).custom((value, helpers) => isValidIranianNationalId(value) ? value : helpers.error('any.invalid')).required(),
  birthDate: Joi.date().iso().max('now').required()
});

export const rejectKycSchema = Joi.object({
  rejectionReason: Joi.string().trim().min(3).max(500).required()
});
