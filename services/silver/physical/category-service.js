import {ProductCategory} from '../../../models/silver/physical/product-category-model.js';
import {AppError} from '../../../errors/app-error.js';
export async function categoryTree(){const items=await ProductCategory.find({active:true}).sort({sortOrder:1,name:1}).lean();return items.filter(c=>!c.parentId).map(c=>({...c,children:items.filter(s=>String(s.parentId)===String(c._id))}));}
export async function resolveCategories(data,existing={}){
 if(data.categoryId===undefined&&data.subcategoryId===undefined)return data;
 const categoryId=data.categoryId===undefined?existing.categoryId:data.categoryId;
 const changed=data.categoryId!==undefined&&String(categoryId)!==String(existing.categoryId);
 const subcategoryId=data.subcategoryId===undefined?(changed?null:existing.subcategoryId):data.subcategoryId;
 if(!categoryId){if(subcategoryId)throw new AppError('ابتدا دسته اصلی را انتخاب کنید.',400,'CATEGORY_REQUIRED');return {...data,categoryId:null,subcategoryId:null,category:null,subcategory:null};}
 const parent=await ProductCategory.findOne({_id:categoryId,parentId:null,active:true}).lean();if(!parent)throw new AppError('دسته اصلی انتخاب‌شده معتبر یا فعال نیست.',400,'CATEGORY_INVALID');
 let child=null;if(subcategoryId){child=await ProductCategory.findOne({_id:subcategoryId,parentId:categoryId,active:true}).lean();if(!child)throw new AppError('زیردسته باید متعلق به دسته اصلی انتخاب‌شده باشد.',400,'SUBCATEGORY_INVALID');}
 return {...data,categoryId:parent._id,subcategoryId:child?._id||null,category:parent.name,subcategory:child?.name||null};
}
