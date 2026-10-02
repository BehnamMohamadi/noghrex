import {pagination} from '../../../utils/pagination.js';
import { transaction } from '../../../utils/transaction.js';
import { PhysicalProduct } from '../../../models/silver/physical/product-model.js';
import { PhysicalInventory } from '../../../models/silver/physical/physical-inventory-model.js';
import { getPhysicalPrice,calculateProductPrice } from './physical-price-service.js';
import { AppError } from '../../../errors/app-error.js';
export async function listProducts(query = {}, allowedIds = null) {
 const filter = { active: true };
 if(allowedIds)filter._id={$in:allowedIds};
 if(typeof query.category==='string' && query.category.trim())filter.category=query.category.trim().slice(0,100);
 if(query.inStock==='true'){
  const ids=await PhysicalInventory.distinct('productId',{availableQuantity:{$gt:0}});
  filter._id={$in:allowedIds?ids.filter(id=>allowedIds.some(a=>String(a)===String(id))):ids};
 }
 if (typeof query.q === 'string' && query.q.trim()) {
  const text = query.q.trim().slice(0,100);
  const literal = Array.from(text, char => '\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char).join('');
  const regex = new RegExp(literal, 'i');
  filter.$or = ['name','category','sku'].map(key => ({ [key]: regex }));
 }
 const sorts={newest:{createdAt:-1,_id:-1},oldest:{createdAt:1,_id:1},name:{name:1,_id:1},lightest:{weightGrams:1,_id:1},heaviest:{weightGrams:-1,_id:1}};
 const {page:pageNumber,limit,skip}=pagination(query),sort=Object.hasOwn(sorts,query.sort)?sorts[query.sort]:sorts.newest;
 const [items,total,categories]=await Promise.all([PhysicalProduct.find(filter).sort(sort).skip(skip).limit(limit).lean(),PhysicalProduct.countDocuments(filter),PhysicalProduct.distinct('category',{active:true,category:{$nin:[null,'']}})]);
 const page={items,total,page:pageNumber,perPage:limit,totalPages:Math.ceil(total/limit),categories};
 if(!items.length)return page;
 const price=await getPhysicalPrice();const stock=await PhysicalInventory.find({productId:{$in:items.map(p=>p._id)}}).lean();const map=new Map(stock.map(s=>[String(s.productId),s.availableQuantity]));return {...page,items:items.map(p=>({...p,inventory:map.get(String(p._id))||0,price:calculateProductPrice(p,price.pricePerGram,price.settings)}))};}
export async function getProduct(id){const [p,price]=await Promise.all([PhysicalProduct.findOne({_id:id,active:true}).lean(),getPhysicalPrice()]);if(!p)throw new AppError('محصول پیدا نشد.',404,'PRODUCT_NOT_FOUND');const inv=await PhysicalInventory.findOne({productId:p._id}).lean();return {...p,inventory:inv?.availableQuantity||0,price:calculateProductPrice(p,price.pricePerGram,price.settings)};}
export async function createProduct(data){return transaction(async session=>{const [p]=await PhysicalProduct.create([data],{session});await PhysicalInventory.create([{productId:p._id,availableQuantity:0}],{session});return p;});}
export async function updateProduct(id,data){const p=await PhysicalProduct.findByIdAndUpdate(id,{$set:data},{new:true,runValidators:true});if(!p)throw new AppError('محصول پیدا نشد.',404,'PRODUCT_NOT_FOUND');return p;}
