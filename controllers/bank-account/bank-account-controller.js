import { asyncHandler } from '../../utils/async-handler.js';
import * as service from '../../services/bank-account/bank-account-service.js';
export const listMine = asyncHandler(async (req,res)=>res.json({status:'success',data:{bankAccounts:await service.listUserBankAccounts(req.user.id)}}));
export const createMine = asyncHandler(async (req,res)=>res.status(201).json({status:'success',data:{bankAccount:await service.createBankAccount(req.user.id,req.body)}}));
export const setDefault = asyncHandler(async (req,res)=>res.json({status:'success',data:{bankAccount:await service.setDefaultBankAccount(req.user.id,req.params.id)}}));
export const deactivate = asyncHandler(async (req,res)=>res.json({status:'success',data:{bankAccount:await service.deactivateBankAccount(req.user.id,req.params.id)}}));
export const pending = asyncHandler(async (req,res)=>res.json({status:'success',data:{bankAccounts:await service.listPendingBankAccounts(req.query)}}));
export const verify = asyncHandler(async (req,res)=>res.json({status:'success',data:{bankAccount:await service.verifyBankAccount(req.params.id,req.user.id)}}));
export const reject = asyncHandler(async (req,res)=>res.json({status:'success',data:{bankAccount:await service.rejectBankAccount(req.params.id,req.user.id,req.body.rejectionReason)}}));
