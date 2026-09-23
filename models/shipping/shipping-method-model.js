import mongoose from 'mongoose';
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:120},description:{type:String,default:null,trim:true,maxlength:500},cost:{type:Number,required:true,min:0},freeAbove:{type:Number,default:null,min:0},active:{type:Boolean,default:true,index:true},sortOrder:{type:Number,default:0},provinceRestrictions:{type:[String],default:[]}},{timestamps:true});
export const ShippingMethod=mongoose.model('ShippingMethod',schema);
