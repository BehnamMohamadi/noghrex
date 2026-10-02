import Joi from "joi";
const body = Joi.object({
  title: Joi.string().max(80),
  recipientName: Joi.string().max(160).required(),
  phoneNumber: Joi.string().pattern(/^09\d{9}$/).required(),
  province: Joi.string().max(100).required(),
  city: Joi.string().max(100).required(),
  addressLine: Joi.string().max(1000).required(),
  postalCode: Joi.string().pattern(/^\d{10}$/).required(),
  isDefault: Joi.boolean(),
});
export const createAddressSchema = { body };
export const updateAddressSchema = {
  body: body
    .fork(
      ["recipientName", "phoneNumber", "province", "city", "addressLine", "postalCode"],
      (s) => s.optional(),
    )
    .min(1),
};
