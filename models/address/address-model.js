import mongoose from 'mongoose';
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},title:{type:String,trim:true,maxlength:80,default:'آدرس'},recipientName:{type:String,required:true,trim:true,maxlength:160},phoneNumber:{type:String,required:true,trim:true},province:{type:String,required:true,trim:true},city:{type:String,required:true,trim:true},addressLine:{type:String,required:true,trim:true,maxlength:1000},postalCode:{type:String,required:true,trim:true},isDefault:{type:Boolean,default:false},active:{type:Boolean,default:true,index:true}},{timestamps:true});
schema.index({userId:1,isDefault:1});
export const Address=mongoose.model('Address',schema);
