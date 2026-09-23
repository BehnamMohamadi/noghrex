import mongoose from 'mongoose';
const schema = new mongoose.Schema({ key:{type:String,default:'physical',unique:true,immutable:true}, pricePerGram:{type:Number,required:true,min:0}, source:{type:String,enum:['manual','provider'],default:'manual'}, active:{type:Boolean,default:true}, updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null} },{timestamps:true});
export const PhysicalPrice=mongoose.model('PhysicalPrice',schema);
