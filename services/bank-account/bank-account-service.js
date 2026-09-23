import {paginate} from '../../utils/pagination.js';
import { BankAccount } from '../../models/account/bank-account-model.js';
import { User } from '../../models/account/user-model.js';
import { AppError } from '../../errors/app-error.js';
import { getFinancialSettings } from '../settings/settings-service.js';
import { transaction } from '../../utils/transaction.js';
import { writeAudit } from '../audit/audit-service.js';
export const listUserBankAccounts=userId=>BankAccount.find({userId,isActive:true}).sort({isDefault:-1,createdAt:-1});
async function lock(userId,session){await User.updateOne({_id:userId},{$inc:{__v:1}},{session});}
export async function createBankAccount(userId,data){
 const settings=await getFinancialSettings();
 return transaction(async session=>{
  await lock(userId,session);
  const count=await BankAccount.countDocuments({userId,isActive:true}).session(session);
  if(count>=(settings.account.maxBankAccountsPerUser||3))throw new AppError('سقف حساب‌های بانکی پر شده است.',409,'BANK_ACCOUNT_LIMIT_REACHED');
  if(data.isDefault)await BankAccount.updateMany({userId,isDefault:true},{$set:{isDefault:false}},{session});
  const [account]=await BankAccount.create([{...data,userId,status:'pending',isDefault:data.isDefault||count===0}],{session});
  return account;
 });
}
export async function setDefaultBankAccount(userId,id){
 return transaction(async session=>{
  await lock(userId,session);
  const account=await BankAccount.findOne({_id:id,userId,isActive:true}).session(session);
  if(!account)throw new AppError('حساب بانکی پیدا نشد.',404,'BANK_ACCOUNT_NOT_FOUND');
  await BankAccount.updateMany({userId,isDefault:true},{$set:{isDefault:false}},{session});
  account.isDefault=true;await account.save({session});return account;
 });
}
export async function deactivateBankAccount(userId,id){
 return transaction(async session=>{
  await lock(userId,session);
  const account=await BankAccount.findOneAndUpdate({_id:id,userId,isActive:true},{$set:{isActive:false,isDefault:false}},{new:true,session});
  if(!account)throw new AppError('حساب بانکی پیدا نشد.',404,'BANK_ACCOUNT_NOT_FOUND');
  if(!await BankAccount.exists({userId,isActive:true,isDefault:true}).session(session))await BankAccount.findOneAndUpdate({userId,isActive:true},{$set:{isDefault:true}},{session});
  return account;
 });
}
export const listPendingBankAccounts=query=>paginate(BankAccount,{status:'pending',isActive:true},query);
async function review(id,adminId,status,rejectionReason=null){
 return transaction(async session=>{
  const account=await BankAccount.findOneAndUpdate({_id:id,status:'pending',isActive:true},{$set:{status,verifiedBy:adminId,verifiedAt:new Date(),rejectionReason}},{new:true,session});
  if(!account)throw new AppError('حساب بانکی قابل بررسی نیست.',409,'BANK_ACCOUNT_NOT_PENDING');
  await writeAudit({actorType:'admin',actorId:adminId,action:'BANK_ACCOUNT_'+status.toUpperCase(),entityType:'BankAccount',entityId:account._id,metadata:{rejectionReason}},session);
  return account;
 });
}
export const verifyBankAccount=(id,adminId)=>review(id,adminId,'verified');
export const rejectBankAccount=(id,adminId,reason)=>review(id,adminId,'rejected',reason);
