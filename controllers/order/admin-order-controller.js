import * as service from '../../services/order/order-service.js';import {asyncHandler} from '../../utils/async-handler.js';
export const list=asyncHandler(async(req,res)=>{const filter={};if(req.query.status)filter.status=req.query.status;if(req.query.paymentStatus)filter.paymentStatus=req.query.paymentStatus;res.json({status:'success',data:{orders:await service.listAdminOrders(filter,req.query)}})});
export const resolveSupply=asyncHandler(async(req,res)=>res.json({status:'success',data:{order:await service.confirmManualReviewAfterSupply(req.params.id,req.user._id)}}));
export const fulfillment=asyncHandler(async(req,res)=>res.json({status:'success',data:{order:await service.updateFulfillmentStatus(req.params.id,req.body.status,req.user.id,req.body.trackingCode)}}));
