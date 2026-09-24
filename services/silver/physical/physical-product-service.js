import {paginate} from '../../../utils/pagination.js';
import { transaction } from '../../../utils/transaction.js';
import { PhysicalProduct } from '../../../models/silver/physical/product-model.js';
import { PhysicalInventory } from '../../../models/silver/physical/physical-inventory-model.js';
import { getPhysicalPrice,calculateProductPrice } from './physical-price-service.js';
import { AppError } from '../../../errors/app-error.js';
export async function listProducts(query = {}) {
 const filter = { active: true };
 if (typeof query.q === 'string' && query.q.trim()) {
  const text = query.q.trim().slice(0,100);
  const literal = Array.from(text, char => '\\^$.*+?()[]{}|'.includes(char) ? '\\' + char : char).join('');
  const regex = new RegExp(literal, 'i');
  filter.$or = ['name','category','sku'].map(key => ({ [key]: regex }));
 }
 const page=await paginate(PhysicalProduct,filter,query);if(!page.items.length)return page;const price=await getPhysicalPrice();const stock=await PhysicalInventory.find({productId:{$in:page.items.map(p=>p._id)}}).lean();const map=new Map(stock.map(s=>[String(s.productId),s.availableQuantity]));return {...page,items:page.items.map(p=>({...p,inventory:map.get(String(p._id))||0,price:calculateProductPrice(p,price.pricePerGram,price.settings)}))};}
export async function getProduct(id){const [p,price]=await Promise.all([PhysicalProduct.findOne({_id:id,active:true}).lean(),getPhysicalPrice()]);if(!p)throw new AppError('محصول پیدا نشد.',404,'PRODUCT_NOT_FOUND');const inv=await PhysicalInventory.findOne({productId:p._id}).lean();return {...p,inventory:inv?.availableQuantity||0,price:calculateProductPrice(p,price.pricePerGram,price.settings)};}
export async function createProduct(data){return transaction(async session=>{const [p]=await PhysicalProduct.create([data],{session});await PhysicalInventory.create([{productId:p._id,availableQuantity:0}],{session});return p;});}
export async function updateProduct(id,data){const p=await PhysicalProduct.findByIdAndUpdate(id,{$set:data},{new:true,runValidators:true});if(!p)throw new AppError('محصول پیدا نشد.',404,'PRODUCT_NOT_FOUND');return p;}
