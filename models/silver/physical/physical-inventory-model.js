import mongoose from 'mongoose';
const schema=new mongoose.Schema({ productId:{type:mongoose.Schema.Types.ObjectId,ref:'PhysicalProduct',required:true,unique:true,index:true}, availableQuantity:{type:Number,required:true,default:0,min:0}, version:{type:Number,default:0,min:0} },{timestamps:true});
export const PhysicalInventory=mongoose.model('PhysicalInventory',schema);
