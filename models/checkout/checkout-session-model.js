import mongoose from 'mongoose';
const item=new mongoose.Schema({productId:{type:mongoose.Schema.Types.ObjectId,ref:'PhysicalProduct',required:true},sku:String,name:String,quantity:{type:Number,required:true,min:1},unitPrice:{type:Number,required:true,min:0},lineTotal:{type:Number,required:true,min:0},pricingSnapshot:{type:mongoose.Schema.Types.Mixed,required:true}},{_id:false});
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},items:{type:[item],required:true},addressSnapshot:{type:mongoose.Schema.Types.Mixed,required:true},shippingSnapshot:{type:mongoose.Schema.Types.Mixed,required:true},subtotal:{type:Number,required:true,min:0},shippingAmount:{type:Number,required:true,min:0},totalAmount:{type:Number,required:true,min:0},status:{type:String,enum:['active','used','expired','cancelled'],default:'active',index:true},expiresAt:{type:Date,required:true}},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:86400});
schema.add({cartRevision:{type:Number,required:true,default:0}});
export const CheckoutSession=mongoose.model('CheckoutSession',schema);
