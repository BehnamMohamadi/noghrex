import { Router } from 'express';
import Joi from 'joi';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { validate } from '../../middlewares/validate.js';
import * as service from '../../services/refund/refund-service.js';
export const refundRoutes = Router(); refundRoutes.use(authenticate);
refundRoutes.get('/', async (req, res) => res.json({ status: 'success', data: await service.listRefunds(req.user.id, req.query) }));
refundRoutes.post('/', validate(Joi.object({ orderId: Joi.string().hex().length(24).required(), reason: Joi.string().trim().min(2).max(1000).required() })),
  async (req, res) => res.status(201).json({ status: 'success', data: { refund: await service.requestRefund(req.user.id, req.body.orderId, req.body.reason) } }));
export const adminRefundRoutes = Router(); adminRefundRoutes.use(authenticate, authorize('admin'));
adminRefundRoutes.get('/', async (req, res) => res.json({ status: 'success', data: await service.listRefunds(null, req.query) }));
adminRefundRoutes.patch('/:id/review', validate(Joi.object({ decision: Joi.string().valid('approved', 'rejected').required(), reason: Joi.string().trim().min(2).max(1000).when('decision', { is: 'rejected', then: Joi.required() }) })),
  async (req, res) => res.json({ status: 'success', data: { refund: await service.reviewRefund(req.params.id, req.user.id, req.body.decision, req.body.reason) } }));
adminRefundRoutes.post('/:id/complete', validate(Joi.object({ stockReturned: Joi.boolean().default(false) })),
  async (req, res) => res.json({ status: 'success', data: { refund: await service.completeRefund(req.params.id, req.user.id, req.body.stockReturned) } }));
