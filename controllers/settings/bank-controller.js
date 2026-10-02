import {asyncHandler} from '../../utils/async-handler.js';import * as service from '../../services/settings/bank-service.js';
export const active=asyncHandler(async(_req,res)=>{await service.ensureDefaultBanks();res.json({status:'success',data:{banks:(await service.listActiveBanks()).map(b=>b.name)}})});
export const list=asyncHandler(async(_req,res)=>{await service.ensureDefaultBanks();res.json({status:'success',data:{banks:await service.listBanks()}})});
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{bank:await service.createBank(req.body,req.user.id)}}));
export const update=asyncHandler(async(req,res)=>res.json({status:'success',data:{bank:await service.updateBank(req.params.id,req.body,req.user.id)}}));
