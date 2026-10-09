import express from 'express';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {authenticate,authorize} from '../../middlewares/auth.js';
import {AppError} from '../../errors/app-error.js';
const router=express.Router();
router.post('/',authenticate,authorize('admin'),express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),async(req,res)=>{
 if(!Buffer.isBuffer(req.body)||!req.body.length)throw new AppError('فقط عکس JPG، PNG یا WebP مجاز است.',415,'IMAGE_TYPE_INVALID');
 let metadata,output;
 try{metadata=await sharp(req.body,{limitInputPixels:16777216}).metadata();}catch{throw new AppError('فایل عکس معتبر نیست یا ابعاد آن بیش از حد مجاز است.',400,'IMAGE_INVALID');}
 if(!['jpeg','png','webp'].includes(metadata.format)||metadata.pages>1)throw new AppError('عکس ثابت JPG، PNG یا WebP انتخاب کنید؛ GIF و عکس متحرک مجاز نیست.',400,'IMAGE_TYPE_INVALID');
 if(metadata.width!==metadata.height||metadata.width<512||metadata.width>4096)throw new AppError('عکس باید مربع ۱:۱ و هر ضلع بین ۵۱۲ تا ۴۰۹۶ پیکسل باشد.',400,'IMAGE_DIMENSIONS_INVALID');
 try{output=await sharp(req.body,{limitInputPixels:16777216}).rotate().resize(1200,1200,{fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();}catch{throw new AppError('فایل عکس قابل پردازش نیست.',400,'IMAGE_INVALID');}
 const directory=new URL('../../public/customer/uploads/products/',import.meta.url),name=randomUUID()+'.webp';
 await mkdir(directory,{recursive:true});await writeFile(new URL(name,directory),output,{flag:'wx'});
 res.status(201).json({status:'success',data:{image:{url:'/uploads/products/'+name,width:Math.min(1200,metadata.width),height:Math.min(1200,metadata.height)}}});
});
export default router;
