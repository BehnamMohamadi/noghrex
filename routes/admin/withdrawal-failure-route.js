import { Router } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import { rejectWithdrawal } from '../../services/withdrawal/withdrawal-service.js';
const router = Router(); router.use(authenticate, authorize('admin'));
router.post('/:id/fail', validate(Joi.object({ bankTransferFailed: Joi.boolean().valid(true).required(), reason: Joi.string().min(2).max(500).required() })), async (req, res) => {
  res.json({ status: 'success', data: { withdrawal: await rejectWithdrawal(req.params.id, req.user.id, req.body.reason, req.ip, true) } });
});
export default router;
