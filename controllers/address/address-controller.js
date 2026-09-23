import * as service from '../../services/address/address-service.js';import { asyncHandler } from '../../utils/async-handler.js';
export const list=asyncHandler(async(req,res)=>res.json({status:'success',data:{addresses:await service.listAddresses(req.user._id)}}));
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{address:await service.createAddress(req.user._id,req.body)}}));
export const update=asyncHandler(async(req,res)=>res.json({status:'success',data:{address:await service.updateAddress(req.user._id,req.params.id,req.body)}}));
export const remove=asyncHandler(async(req,res)=>res.json({status:'success',data:{address:await service.deactivateAddress(req.user._id,req.params.id)}}));
