import dotenv from 'dotenv';
import mongoose from 'mongoose';
import {DemoMarketPrice} from '../models/silver/online/demo-market-price-model.js';
dotenv.config({quiet:true});
try {
 await mongoose.connect(process.env.MONGODB_URI);
 await DemoMarketPrice.init();
 const end=new Date();end.setUTCMinutes(0,0,0);
 const start=+end-365*86400000;
 const ops=[];
 for(let i=0;i<=365*24;i++){
  const sampledAt=new Date(start+i*3600000);
  const silverGramToman=Math.round(450000+28000*Math.sin(i/310)+14000*Math.sin(i/47)+7000*Math.sin(i/9));
  ops.push({updateOne:{filter:{sampledAt},update:{$set:{silverGramToman}},upsert:true}});
 }
 await DemoMarketPrice.bulkWrite(ops);
 console.log('Seeded '+ops.length+' hourly demo points in a separate collection; live prices unchanged.');
} finally {await mongoose.disconnect();}
