const fs=require('node:fs');
const sharp=require('sharp');
(async()=>{
 const root='public/customer/assets/';
 const names=['fine-01','fine-02','bold-01','bold-02','bar-01','bar-02'];
 const cells=[];
 for(let i=0;i<6;i++){
  const cell=await sharp(root+'catalog-atlas.png').extract({left:(i%3)*512,top:Math.floor(i/3)*512,width:512,height:512}).png().toBuffer();cells.push(cell);
  await sharp(cell).webp({quality:90}).toFile(root+'product-'+names[i]+'.webp');
 }
 const frames=[],size=360;
 for(let i=0;i<32;i++){
  const phase=i/32*Math.PI*2,zoom=1+0.05*(1-Math.cos(phase))/2;
  const edge=Math.round(512/zoom);
  frames.push(await sharp(cells[0]).extract({left:Math.floor((512-edge)/2),top:Math.floor((512-edge)/2),width:edge,height:edge}).resize(size,size).removeAlpha().raw().toBuffer());
 }
 await sharp(Buffer.concat(frames),{raw:{width:size,height:size*frames.length,channels:3,pageHeight:size}}).gif({loop:0,delay:Array(frames.length).fill(150),colours:64,dither:0.5}).toFile(root+'jewelry-motion.gif');
 console.log(await sharp(root+'jewelry-motion.gif',{animated:true}).metadata());
})();
