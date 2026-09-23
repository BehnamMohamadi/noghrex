import * as service from '../../services/order/order-service.js';import { asyncHandler } from '../../utils/async-handler.js';
export const create=asyncHandler(async(req,res)=>res.status(201).json({status:'success',data:{order:await service.createOrder(req.user._id,req.body)}}));
export const payWallet=asyncHandler(async(req,res)=>res.json({status:'success',data:{order:await service.payOrderWithWallet(req.user._id,req.params.id)}}));
export const list=asyncHandler(async(req,res)=>res.json({status:'success',data:{orders:await service.listOrders(req.user.id,req.query)}}));
export const get=asyncHandler(async(req,res)=>res.json({status:'success',data:{order:await service.getOrder(req.user._id,req.params.id)}}));

export const cancel=asyncHandler(async(req,res)=>res.json({status:'success',data:{order:await service.cancelOrder(req.user.id,req.params.id)}}));
