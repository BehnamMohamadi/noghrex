import {paginate} from '../../utils/pagination.js';
import { SystemAlert } from '../../models/system/system-alert-model.js';
import { AppError } from '../../errors/app-error.js';
export async function createSystemAlert(payload, session=null){ const [doc]=await SystemAlert.create([payload],{session}); return doc; }
export async function listOpenAlerts(query){return paginate(SystemAlert,{status:'open'},query);}
export async function resolveAlert(id,adminId){ const doc=await SystemAlert.findOneAndUpdate({_id:id,status:'open'},{$set:{status:'resolved',resolvedBy:adminId,resolvedAt:new Date()}},{new:true}); if(!doc) throw new AppError('هشدار باز پیدا نشد.',404,'ALERT_NOT_FOUND'); return doc; }
