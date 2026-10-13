import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 sampledAt:{type:Date,required:true,unique:true},
 silverGramToman:{type:Number,required:true,min:400000,max:500000}
});
export const DemoMarketPrice=mongoose.model('DemoMarketPrice',schema);
