import mongoose from 'mongoose';
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:100},slug:{type:String,required:true,unique:true,trim:true,lowercase:true},parentId:{type:mongoose.Schema.Types.ObjectId,ref:'ProductCategory',default:null,index:true},active:{type:Boolean,default:true},sortOrder:{type:Number,default:0}},{timestamps:true});
schema.index({parentId:1,name:1},{unique:true});
export const ProductCategory=mongoose.model('ProductCategory',schema);
