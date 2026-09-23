import * as productService from '../../../services/silver/physical/physical-product-service.js';
import * as priceService from '../../../services/silver/physical/physical-price-service.js';
import * as inventoryService from '../../../services/silver/physical/physical-inventory-service.js';
import * as cartService from '../../../services/silver/physical/cart-service.js';
export async function listProducts(req,res){res.json({status:'success',data:{products:await productService.listProducts(req.query)}});}
export async function getProduct(req,res){res.json({status:'success',data:{product:await productService.getProduct(req.params.id)}});}
export async function createProduct(req,res){res.status(201).json({status:'success',data:{product:await productService.createProduct(req.body)}});}
export async function updateProduct(req,res){res.json({status:'success',data:{product:await productService.updateProduct(req.params.id,req.body)}});}
export async function getPrice(req,res){res.json({status:'success',data:{price:await priceService.getPhysicalPrice()}});}
export async function setPrice(req,res){res.json({status:'success',data:{price:await priceService.setPhysicalPrice(req.body.pricePerGram,req.user._id)}});}
export async function adjustInventory(req,res){res.status(201).json({status:'success',data:{transaction:await inventoryService.adjustInventory({...req.body,productId:req.params.id,actorId:req.user._id})}});}
export async function getCart(req,res){res.json({status:'success',data:{cart:await cartService.getCart(req.user._id)}});}
export async function addCartItem(req,res){res.status(201).json({status:'success',data:{cart:await cartService.addCartItem(req.user._id,req.body.productId,req.body.quantity)}});}
export async function setCartItem(req,res){res.json({status:'success',data:{cart:await cartService.setCartItem(req.user._id,req.params.productId,req.body.quantity)}});}
export async function clearCart(req,res){res.json({status:'success',data:{cart:await cartService.clearCart(req.user._id)}});}
