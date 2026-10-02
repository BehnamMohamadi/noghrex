import mongoose from 'mongoose';
const bankSchema=new mongoose.Schema({name:{type:String,required:true,unique:true,trim:true,minlength:2,maxlength:100},active:{type:Boolean,default:true,index:true},sortOrder:{type:Number,default:0},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},updatedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null}},{timestamps:true});
export const Bank=mongoose.model('Bank',bankSchema);
