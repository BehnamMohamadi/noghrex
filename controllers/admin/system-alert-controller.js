import { asyncHandler } from '../../utils/async-handler.js';
import { listOpenAlerts, resolveAlert } from '../../services/system/system-alert-service.js';
export const listAlerts=asyncHandler(async(req,res)=>res.json({status:'success',data:{alerts:await listOpenAlerts(req.query)}}));
export const resolveSystemAlert=asyncHandler(async(req,res)=>res.json({status:'success',data:{alert:await resolveAlert(req.params.id,req.user.id)}}));
