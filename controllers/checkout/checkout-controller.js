import * as service from '../../services/checkout/checkout-service.js';import { asyncHandler } from '../../utils/async-handler.js';
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{checkout:await service.createCheckout(req.user._id,req.body)}}));
export const get=asyncHandler(async(req,res)=>res.json({status:'success',data:{checkout:await service.getCheckout(req.user._id,req.params.id)}}));
