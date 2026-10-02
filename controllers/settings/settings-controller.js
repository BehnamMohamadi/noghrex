import { asyncHandler } from '../../utils/async-handler.js';
import { getFinancialSettingsSnapshot, updateFinancialSettings } from '../../services/settings/settings-service.js';
export const getFinancial=asyncHandler(async(req,res)=>res.json({status:'success',data:await getFinancialSettingsSnapshot()}));
export const updateFinancial=asyncHandler(async(req,res)=>{
  const {expectedRevision,...value}=req.body;
  const doc=await updateFinancialSettings(value,req.user.id,expectedRevision);
  res.json({status:'success',data:{settings:doc.value,revision:doc.revision}});
});
