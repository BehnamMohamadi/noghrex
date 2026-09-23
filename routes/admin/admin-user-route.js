import { Router } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { User } from '../../models/account/user-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { paginate } from '../../utils/pagination.js';
import { transaction } from '../../utils/transaction.js';
import { writeAudit } from '../../services/audit/audit-service.js';
import { AppError } from '../../errors/app-error.js';
const router = Router(); router.use(authenticate, authorize('admin'));
router.get('/', async (req, res) => res.json({ status: 'success', data: await paginate(User, {}, req.query) }));
router.get('/:id/wallet', async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.params.id }).lean();
  if (!wallet) throw new AppError('کیف پول پیدا نشد.', 404, 'WALLET_NOT_FOUND');
  res.json({ status: 'success', data: { wallet } });
});
router.patch('/:id/status', validate(Joi.object({ accountStatus: Joi.string().valid('active', 'suspended', 'deactivated').required(), reason: Joi.string().min(2).max(500).required() })), async (req, res) => {
  const user = await transaction(async session => {
    const target = await User.findById(req.params.id).session(session);
    if (!target) throw new AppError('کاربر پیدا نشد.', 404, 'USER_NOT_FOUND');
    if (target.role === 'admin') throw new AppError('وضعیت مدیر از این مسیر قابل تغییر نیست.', 403, 'ADMIN_STATUS_PROTECTED');
    target.accountStatus = req.body.accountStatus; target.tokenVersion += 1;
    target.deactivatedAt = target.accountStatus === 'active' ? null : new Date();
    target.deactivatedBy = req.user.id; target.deactivationReason = target.accountStatus === 'active' ? null : 'admin_deactivated';
    target.deactivationNote = req.body.reason; await target.save({ session });
    await writeAudit({ actorType: 'admin', actorId: req.user.id, action: 'USER_STATUS_CHANGED', entityType: 'User', entityId: target._id, metadata: req.body }, session);
    return target;
  });
  res.json({ status: 'success', data: { user } });
});
export default router;
