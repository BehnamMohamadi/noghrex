import mongoose from 'mongoose';
const item=new mongoose.Schema({productId:{type:mongoose.Schema.Types.ObjectId,ref:'PhysicalProduct',required:true},quantity:{type:Number,required:true,min:1}},{_id:false});
const schema=new mongoose.Schema({userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,unique:true,index:true},items:{type:[item],default:[]},revision:{type:Number,default:0}},{timestamps:true,optimisticConcurrency:true});
export const PhysicalCart=mongoose.model('PhysicalCart',schema);
