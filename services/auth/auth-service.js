import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../../models/account/user-model.js';
import { OtpVerification } from '../../models/account/otp-model.js';
import { AppError } from '../../errors/app-error.js';
import { normalizeIranPhone } from '../../utils/phone.js';
import { signAuthToken } from '../../utils/auth-token.js';
import { createWalletForUser } from '../wallet/wallet-service.js';

export async function signup({ signupToken, firstname, lastname, password, email }) {
  const tokenHash = crypto.createHash('sha256').update(signupToken).digest('hex');
  const session = await mongoose.startSession();

  try {
    let createdUser;

    await session.withTransaction(async () => {
      const otp = await OtpVerification.findOne({
        purpose: 'signup',
        signupTokenHash: tokenHash,
        verifiedAt: { $ne: null },
        consumedAt: null,
        expiresAt: { $gt: new Date() }
      }).select('+signupTokenHash').session(session);

      if (!otp) throw new AppError('مجوز ثبت‌نام معتبر نیست یا منقضی شده است.', 400, 'INVALID_SIGNUP_TOKEN');
      if (await User.exists({ phoneNumber: otp.phoneNumber }).session(session)) {
        throw new AppError('این شماره موبایل قبلاً ثبت شده است.', 409, 'PHONE_ALREADY_EXISTS');
      }

      const [user] = await User.create([{
        firstname,
        lastname,
        phoneNumber: otp.phoneNumber,
        phoneVerifiedAt: otp.verifiedAt,
        email: email || null,
        password
      }], { session });

      await createWalletForUser(user._id, session);

      otp.consumedAt = new Date();
      otp.signupTokenHash = null;
      await otp.save({ session });
      createdUser = user;
    });

    return { user: createdUser, token: signAuthToken(createdUser) };
  } finally {
    await session.endSession();
  }
}

export async function login(rawPhoneNumber, password) {
  const phoneNumber = normalizeIranPhone(rawPhoneNumber);
  const user = await User.findOne({ phoneNumber }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('شماره موبایل یا رمز عبور صحیح نیست.', 401, 'INVALID_CREDENTIALS');
  }
  if (user.accountStatus !== 'active') {
    throw new AppError('حساب کاربری فعال نیست.', 403, 'ACCOUNT_NOT_ACTIVE', { accountStatus: user.accountStatus });
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  user.password = undefined;
  return { user, token: signAuthToken(user) };
}

export async function logoutEverywhere(userId) {
  const user = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true });
  if (!user) throw new AppError('حساب کاربری پیدا نشد.', 404, 'USER_NOT_FOUND');
}
