import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { authenticate, rejectIfAuthenticated } from '../../middlewares/auth.js';
import { otpSendLimiter, otpVerifyLimiter, loginLimiter } from '../../middlewares/rate-limit.js';
import * as controller from '../../controllers/auth/auth-controller.js';
import {
  requestSignupOtpSchema,
  verifySignupOtpSchema,
  signupSchema,
  loginSchema
} from '../../validations/auth/auth-validation.js';

const router = Router();

router.post('/signup/otp', rejectIfAuthenticated, otpSendLimiter, validate(requestSignupOtpSchema), controller.requestOtp);
router.post('/signup/otp/verify', rejectIfAuthenticated, otpVerifyLimiter, validate(verifySignupOtpSchema), controller.verifyOtp);
router.post('/signup', rejectIfAuthenticated, validate(signupSchema), controller.signup);
router.post('/login', rejectIfAuthenticated, loginLimiter, validate(loginSchema), controller.login);
router.post('/logout', authenticate, controller.logout);

export default router;
