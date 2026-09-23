import { PhysicalCart } from '../../../models/silver/physical/cart-model.js';
import { PhysicalProduct } from '../../../models/silver/physical/product-model.js';
import { getPhysicalPrice, calculateProductPrice } from './physical-price-service.js';
import { AppError } from '../../../errors/app-error.js';
import { transaction } from '../../../utils/transaction.js';
export async function getCart(userId) {
  const cart = await PhysicalCart.findOneAndUpdate({ userId }, { $setOnInsert: { items: [] } }, { upsert: true, new: true }).populate('items.productId').lean();
  if (!cart.items.length) return cart;
  const price = await getPhysicalPrice();
  return { ...cart, items: cart.items.map(item => {
    if (!item.productId?.active) return { ...item, available: false, unitPrice: null, lineTotal: null };
    const unitPrice = calculateProductPrice(item.productId, price.pricePerGram, price.settings).finalPrice;
    return { ...item, available: true, unitPrice, lineTotal: unitPrice * item.quantity };
  }) };
}
async function mutate(userId, work) {
  await PhysicalCart.updateOne({ userId }, { $setOnInsert: { items: [] } }, { upsert: true });
  await transaction(async session => {
    const cart = await PhysicalCart.findOneAndUpdate({ userId }, { $inc: { revision: 1 } }, { new: true, session });
    await work(cart, session); await cart.save({ session });
  });
  return getCart(userId);
}
export async function addCartItem(userId, productId, quantity) {
  return mutate(userId, async (cart, session) => {
    const product = await PhysicalProduct.findOne({ _id: productId, active: true }).session(session);
    if (!product) throw new AppError('محصول پیدا نشد.', 404, 'PRODUCT_NOT_FOUND');
    const found = cart.items.find(item => String(item.productId) === String(productId));
    if ((found?.quantity || 0) + quantity > 100) throw new AppError('حداکثر تعداد هر کالا ۱۰۰ است.', 400, 'CART_QUANTITY_LIMIT');
    if (found) found.quantity += quantity; else cart.items.push({ productId, quantity });
  });
}
export async function setCartItem(userId, productId, quantity) {
  return mutate(userId, async cart => {
    const item = cart.items.find(i => String(i.productId) === String(productId));
    if (!item) throw new AppError('کالا در سبد نیست.', 404, 'CART_ITEM_NOT_FOUND');
    if (quantity === 0) cart.items = cart.items.filter(i => String(i.productId) !== String(productId)); else item.quantity = quantity;
  });
}
export async function clearCart(userId) { return mutate(userId, async cart => { cart.items = []; }); }
