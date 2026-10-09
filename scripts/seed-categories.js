import 'dotenv/config';
import mongoose from 'mongoose';
import {seedProductCategories} from './category-fixtures.js';
try{await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:5000});console.log(JSON.stringify(await seedProductCategories()));}finally{await mongoose.disconnect();}
