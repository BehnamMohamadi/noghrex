import {paginate} from '../../utils/pagination.js';
import { Kyc } from '../../models/account/kyc-model.js';
import { User } from '../../models/account/user-model.js';
import { AppError } from '../../errors/app-error.js';
import { transaction } from '../../utils/transaction.js';
import { writeAudit } from '../audit/audit-service.js';
export const getUserKyc = userId => Kyc.findOne({userId});
export async function submitKyc(userId,data){
 return transaction(async session=>{
  await User.updateOne({_id:userId},{$inc:{__v:1}},{session});
  const current=await Kyc.findOne({userId}).session(session);
  if(current?.status==='verified')throw new AppError('احراز هویت قبلاً تأیید شده است.',409,'KYC_ALREADY_VERIFIED');
  return Kyc.findOneAndUpdate({userId},{$set:{...data,status:'pending',verificationMethod:'manual',rejectionReason:null,reviewedBy:null,reviewedAt:null}},{new:true,upsert:true,runValidators:true,session});
 });
}
export const listPendingKyc=query=>paginate(Kyc,{status:'pending'},query);
async function review(id,adminId,status,rejectionReason=null){
 return transaction(async session=>{
  const kyc=await Kyc.findOneAndUpdate({_id:id,status:'pending'},{$set:{status,reviewedBy:adminId,reviewedAt:new Date(),rejectionReason}},{new:true,session});
  if(!kyc)throw new AppError('درخواست قابل بررسی نیست.',409,'KYC_NOT_PENDING');
  await writeAudit({actorType:'admin',actorId:adminId,action:'KYC_'+status.toUpperCase(),entityType:'Kyc',entityId:kyc._id,metadata:{rejectionReason}},session);
  return kyc;
 });
}
export const approveKyc=(id,adminId)=>review(id,adminId,'verified');
export const rejectKyc=(id,adminId,reason)=>review(id,adminId,'rejected',reason);
