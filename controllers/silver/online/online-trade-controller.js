import { asyncHandler } from '../../../utils/async-handler.js';
import { createQuote, getUserQuote } from '../../../services/silver/online/quote-service.js';
import { executeTrade, listUserTrades } from '../../../services/silver/online/trade-service.js';

export const createOnlineQuote = asyncHandler(async (req,res)=>res.status(201).json({status:'success',data:{quote:await createQuote(req.user.id,req.body)}}));
export const getOnlineQuote = asyncHandler(async (req,res)=>res.json({status:'success',data:{quote:await getUserQuote(req.user.id,req.params.id)}}));
export const executeOnlineTrade = asyncHandler(async (req,res)=>res.status(201).json({status:'success',data:{trade:await executeTrade(req.user.id,req.body.quoteId)}}));
export const getMyOnlineTrades = asyncHandler(async (req,res)=>res.json({status:'success',data:await listUserTrades(req.user.id,req.query)}));
