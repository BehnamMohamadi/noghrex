import { ShippingMethod } from '../../models/shipping/shipping-method-model.js';
import { AppError } from '../../errors/app-error.js';
export const listShippingMethods=()=>ShippingMethod.find({active:true}).sort({sortOrder:1,createdAt:1}).lean();
export async function getShippingMethod(id,province){const m=await ShippingMethod.findOne({_id:id,active:true}).lean();if(!m)throw new AppError('روش ارسال پیدا نشد.',404,'SHIPPING_METHOD_NOT_FOUND');if(m.provinceRestrictions?.length&&!m.provinceRestrictions.includes(province))throw new AppError('این روش ارسال برای استان انتخابی فعال نیست.',409,'SHIPPING_NOT_AVAILABLE');return m;}
export async function upsertShippingMethod(id,data){return id?ShippingMethod.findByIdAndUpdate(id,{$set:data},{new:true,runValidators:true}):ShippingMethod.create(data);}
