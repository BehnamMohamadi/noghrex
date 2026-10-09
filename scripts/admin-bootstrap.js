import mongoose from 'mongoose';
import { User } from '../models/account/user-model.js';
import { createWalletForUser } from '../services/wallet/wallet-service.js';

export async function createInitialAdmin({ phoneNumber, password, firstname = 'مدیر', lastname = 'نقرکس' }) {
  phoneNumber = String(phoneNumber).trim().replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) - (c >= '۰' ? 1776 : 1632)));
  if (!/^09\d{9}$/.test(phoneNumber)) throw new Error('شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.');
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('رمز باید حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت باشد.');
  }
  let result;
  await mongoose.connection.transaction(async session => {
    const existing = await User.findOne({ phoneNumber }).session(session);
    if (existing) {
      if (existing.role !== 'admin' || existing.accountStatus !== 'active') {
        throw new Error('این شماره متعلق به حساب دیگری یا حساب غیرفعال است؛ هیچ تغییری انجام نشد.');
      }
      await createWalletForUser(existing._id, session);
      result = { created: false, phoneNumber };
      return;
    }
    const [user] = await User.create([{ firstname, lastname, phoneNumber, password, role: 'admin', accountStatus: 'active' }], { session });
    await createWalletForUser(user._id, session);
    result = { created: true, phoneNumber };
  });
  return result;
}
