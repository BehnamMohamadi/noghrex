import { asyncHandler } from '../../utils/async-handler.js';
import { getFinancialSettings, updateFinancialSettings } from '../../services/settings/settings-service.js';
export const getFinancial=asyncHandler(async(req,res)=>res.json({status:'success',data:{settings:await getFinancialSettings()}}));
export const updateFinancial=asyncHandler(async(req,res)=>res.json({status:'success',data:{settings:await updateFinancialSettings(req.body,req.user.id)}}));
