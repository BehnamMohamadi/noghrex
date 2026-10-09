import {ProductCategory} from '../models/silver/physical/product-category-model.js';
import {PhysicalProduct} from '../models/silver/physical/product-model.js';
export async function seedProductCategories(){
 const definitions=[['melted-silver','نقره آب‌شده',[['melted-pieces','قطعات آب‌شده'],['silver-granules','ساچمه نقره']]],['crafted-silver','نقره ساخته‌شده',[['necklaces','گردنبند'],['bracelets','دستبند و مچ‌بند'],['anklets','پابند'],['rings','انگشتر و حلقه'],['earrings','گوشواره'],['pendants','آویز'],['jewelry-sets','ست و نیم‌ست']]],['silver-bars','شمش نقره',[['bars-250g','شمش ۲۵۰ گرمی'],['bars-1kg','شمش یک کیلوگرمی'],['other-bars','سایر شمش‌ها']]]];
 const bySlug={};let count=0;
 for(const [order,[slug,name,children]]of definitions.entries()){
  const parent=await ProductCategory.findOneAndUpdate({slug},{$setOnInsert:{slug,name,parentId:null,active:true,sortOrder:order}},{upsert:true,new:true});bySlug[slug]=parent;count++;
  for(const [index,[childSlug,childName]]of children.entries()){bySlug[childSlug]=await ProductCategory.findOneAndUpdate({slug:childSlug},{$setOnInsert:{slug:childSlug,name:childName,parentId:parent._id,active:true,sortOrder:index}},{upsert:true,new:true});count++;}
 }
 let updated=0;
 for(const p of await PhysicalProduct.find({categoryId:null}).lean()){
  let sub;if(/^DEMO-(FINE|BOLD)-/.test(p.sku))sub='jewelry-sets';else if(p.sku==='DEMO-BAR-01')sub='bars-250g';else if(p.sku==='DEMO-BAR-02')sub='bars-1kg';else if(/گردنبند/.test(p.name))sub='necklaces';else if(/پابند/.test(p.name))sub='anklets';else if(/دستبند|مچ.?بند/.test(p.name))sub='bracelets';else if(/انگشتر|حلقه/.test(p.name))sub='rings';else if(/گوشواره/.test(p.name))sub='earrings';else if(/شمش/.test(p.name))sub='other-bars';
  if(!sub)continue;const child=bySlug[sub],parent=Object.values(bySlug).find(c=>String(c._id)===String(child.parentId));
  const result=await PhysicalProduct.updateOne({_id:p._id,categoryId:null},{$set:{categoryId:parent._id,subcategoryId:child._id,category:parent.name,subcategory:child.name}});updated+=result.modifiedCount;
 }
 return {categories:count,productsCategorized:updated,unassigned:await PhysicalProduct.countDocuments({categoryId:null})};
}
