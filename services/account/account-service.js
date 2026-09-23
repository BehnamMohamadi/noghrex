import { User } from '../../models/account/user-model.js';
import { AppError } from '../../errors/app-error.js';
import { transaction } from '../../utils/transaction.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { Order } from '../../models/order/order-model.js';
import { writeAudit } from '../audit/audit-service.js';

export async function deactivateAccount(userId) {
  return transaction(async session => {
    const wallet = await Wallet.findOneAndUpdate({ userId }, { $inc: { financialRevision: 1 } }, { new: true, session });
    if (wallet && [wallet.toman.available, wallet.toman.locked, wallet.x.available, wallet.x.locked].some(value => value > 0)) throw new AppError('ابتدا دارایی‌های حساب را تسویه کنید.', 409, 'ACCOUNT_HAS_BALANCE');
    if (await Order.exists({ userId, status: { $nin: ['delivered', 'cancelled', 'refunded'] } }).session(session)) throw new AppError('سفارش باز دارید.', 409, 'ACCOUNT_HAS_OPEN_ORDER');
    const user = await User.findById(userId).session(session);
    if (user.role === 'admin') throw new AppError('حساب مدیر قابل غیرفعال‌سازی نیست.', 403, 'ADMIN_STATUS_PROTECTED');
    user.accountStatus = 'deactivated'; user.deactivationReason = 'user_deactivated'; user.deactivatedAt = new Date(); user.deactivatedBy = userId; user.tokenVersion += 1;
    await user.save({ session });
    await writeAudit({ actorType: 'user', actorId: userId, action: 'ACCOUNT_DEACTIVATED', entityType: 'User', entityId: userId }, session);
    return user;
  });
}

export async function getAccount(userId) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('حساب کاربری پیدا نشد.', 404, 'USER_NOT_FOUND');
  return user;
}

export async function updateAccount(userId, data) {
  const allowed = ['firstname', 'lastname', 'email'];
  const update = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  if (update.email === '') update.email = null;
  const user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true });
  if (!user) throw new AppError('حساب کاربری پیدا نشد.', 404, 'USER_NOT_FOUND');
  return user;
}
