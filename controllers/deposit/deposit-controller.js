import { asyncHandler } from '../../utils/async-handler.js';
import * as service from '../../services/deposit/deposit-service.js';
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{deposit:await service.createDepositRequest(req.user.id,req.body)}}));
export const mine=asyncHandler(async(req,res)=>res.json({status:'success',data:{deposits:await service.listUserDeposits(req.user.id,req.query)}}));
export const pending=asyncHandler(async(req,res)=>res.json({status:'success',data:{deposits:await service.listPendingManualDeposits(req.query)}}));
export const approve=asyncHandler(async(req,res)=>res.json({status:'success',data:{deposit:await service.approveManualDeposit(req.params.id,req.user.id,req.ip)}}));
export const reject=asyncHandler(async(req,res)=>res.json({status:'success',data:{deposit:await service.rejectManualDeposit(req.params.id,req.user.id,req.body.reason,req.ip)}}));
