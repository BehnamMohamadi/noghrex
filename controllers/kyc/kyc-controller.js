import { asyncHandler } from '../../utils/async-handler.js';
import * as kycService from '../../services/kyc/kyc-service.js';

export const getMyKyc = asyncHandler(async (req, res) => res.json({ status: 'success', data: { kyc: await kycService.getUserKyc(req.user.id) } }));
export const submitMyKyc = asyncHandler(async (req, res) => res.status(201).json({ status: 'success', data: { kyc: await kycService.submitKyc(req.user.id, req.body) } }));
export const getPendingKyc = asyncHandler(async (req, res) => res.json({ status: 'success', data: { requests: await kycService.listPendingKyc(req.query) } }));
export const approve = asyncHandler(async (req, res) => res.json({ status: 'success', data: { kyc: await kycService.approveKyc(req.params.id, req.user.id) } }));
export const reject = asyncHandler(async (req, res) => res.json({ status: 'success', data: { kyc: await kycService.rejectKyc(req.params.id, req.user.id, req.body.rejectionReason) } }));
