import { asyncHandler } from '../../utils/async-handler.js';
import * as service from '../../services/withdrawal/withdrawal-service.js';
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{withdrawal:await service.createWithdrawal(req.user.id,req.body)}}));
export const mine=asyncHandler(async(req,res)=>res.json({status:'success',data:{withdrawals:await service.listUserWithdrawals(req.user.id,req.query)}}));
export const pending=asyncHandler(async(req,res)=>res.json({status:'success',data:{withdrawals:await service.listPendingWithdrawals(req.query)}}));
export const approve=asyncHandler(async(req,res)=>res.json({status:'success',data:{withdrawal:await service.approveWithdrawal(req.params.id,req.user.id,req.ip)}}));
export const processing=asyncHandler(async(req,res)=>res.json({status:'success',data:{withdrawal:await service.markWithdrawalProcessing(req.params.id,req.user.id,req.ip)}}));
export const complete=asyncHandler(async(req,res)=>res.json({status:'success',data:{withdrawal:await service.completeWithdrawal(req.params.id,req.user.id,req.body.bankReference,req.ip)}}));
export const reject=asyncHandler(async(req,res)=>res.json({status:'success',data:{withdrawal:await service.rejectWithdrawal(req.params.id,req.user.id,req.body.reason,req.ip)}}));
