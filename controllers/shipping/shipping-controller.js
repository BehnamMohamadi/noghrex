import * as service from '../../services/shipping/shipping-service.js';import { asyncHandler } from '../../utils/async-handler.js';
export const list=asyncHandler(async(req,res)=>res.json({status:'success',data:{methods:await service.listShippingMethods()}}));
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{method:await service.upsertShippingMethod(null,req.body)}}));
export const update=asyncHandler(async(req,res)=>res.json({status:'success',data:{method:await service.upsertShippingMethod(req.params.id,req.body)}}));
