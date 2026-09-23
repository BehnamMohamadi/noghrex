import { Router } from 'express';
import Joi from 'joi';
import { authenticate } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as service from '../../services/payment/payment-service.js';
const router = Router(); router.use(authenticate);
router.post('/', validate(Joi.object({ purpose: Joi.string().valid('wallet_deposit', 'order_payment').required(), entityId: Joi.string().hex().length(24).required() })),
  async (req, res) => res.json({ status: 'success', data: { payment: await service.initiatePayment(req.user.id, req.body) } }));
router.get('/:id', async (req, res) => res.json({ status: 'success', data: { payment: await service.getPayment(req.user.id, req.params.id) } }));
router.post('/:id/mock/verify', validate(Joi.object({ outcome: Joi.string().valid('success', 'cancel').required() })),
  async (req, res) => res.json({ status: 'success', data: { payment: await service.verifyMockPayment(req.user.id, req.params.id, req.body.outcome) } }));
export default router;
