import { Address } from '../../models/address/address-model.js';
import { User } from '../../models/account/user-model.js';
import { AppError } from '../../errors/app-error.js';
import { transaction } from '../../utils/transaction.js';
export const listAddresses=userId=>Address.find({userId,active:true}).sort({isDefault:-1,createdAt:-1}).lean();
async function lock(userId,session){await User.updateOne({_id:userId},{$inc:{__v:1}},{session});}
export async function createAddress(userId,data){
 return transaction(async session=>{
  await lock(userId,session);
  const count=await Address.countDocuments({userId,active:true}).session(session);
  if(count>=20)throw new AppError('سقف آدرس‌ها پر شده است.',409,'ADDRESS_LIMIT_REACHED');
  if(data.isDefault)await Address.updateMany({userId},{$set:{isDefault:false}},{session});
  const [address]=await Address.create([{...data,userId,isDefault:data.isDefault||count===0}],{session});return address;
 });
}
export async function updateAddress(userId,id,data){
 return transaction(async session=>{
  await lock(userId,session);
  const address=await Address.findOne({_id:id,userId,active:true}).session(session);
  if(!address)throw new AppError('آدرس پیدا نشد.',404,'ADDRESS_NOT_FOUND');
  if(data.isDefault)await Address.updateMany({userId,_id:{$ne:id}},{$set:{isDefault:false}},{session});
  if(address.isDefault&&data.isDefault===false)delete data.isDefault;
  Object.assign(address,data);await address.save({session});return address;
 });
}
export async function deactivateAddress(userId,id){
 return transaction(async session=>{
  await lock(userId,session);
  const address=await Address.findOneAndUpdate({_id:id,userId,active:true},{$set:{active:false,isDefault:false}},{new:true,session});
  if(!address)throw new AppError('آدرس پیدا نشد.',404,'ADDRESS_NOT_FOUND');
  if(!await Address.exists({userId,active:true,isDefault:true}).session(session))await Address.findOneAndUpdate({userId,active:true},{$set:{isDefault:true}},{session});
  return address;
 });
}
