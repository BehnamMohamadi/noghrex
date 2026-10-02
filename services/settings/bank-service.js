import {Bank} from '../../models/settings/bank-model.js';
import {AppError} from '../../errors/app-error.js';
import {writeAudit} from '../audit/audit-service.js';
export const listActiveBanks=()=>Bank.find({active:true}).sort({sortOrder:1,name:1}).lean();
export const listBanks=()=>Bank.find({}).sort({sortOrder:1,name:1}).lean();
export async function createBank(data,adminId){try{const bank=await Bank.create({...data,createdBy:adminId,updatedBy:adminId});await writeAudit({actorType:'admin',actorId:adminId,action:'BANK_CREATED',entityType:'Bank',entityId:bank._id,metadata:{name:bank.name}});return bank;}catch(e){if(e.code===11000)throw new AppError('این بانک قبلاً ثبت شده است.',409,'BANK_ALREADY_EXISTS');throw e;}}
export async function updateBank(id,data,adminId){const bank=await Bank.findByIdAndUpdate(id,{$set:{...data,updatedBy:adminId}},{new:true,runValidators:true});if(!bank)throw new AppError('بانک پیدا نشد.',404,'BANK_NOT_FOUND');await writeAudit({actorType:'admin',actorId:adminId,action:'BANK_UPDATED',entityType:'Bank',entityId:bank._id,metadata:data});return bank;}
export async function ensureDefaultBanks(){for(const [name,sortOrder] of [['بانک پارسیان',10],['بانک قرض‌الحسنه رسالت',20]])await Bank.updateOne({name},{$setOnInsert:{name,active:true,sortOrder}},{upsert:true});}
