import { PhysicalCart } from '../../models/silver/physical/cart-model.js';
import { PhysicalProduct } from '../../models/silver/physical/product-model.js';
import { Address } from '../../models/address/address-model.js';
import { CheckoutSession } from '../../models/checkout/checkout-session-model.js';
import { ShippingMethod } from '../../models/shipping/shipping-method-model.js';
import { getPhysicalPrice, calculateProductPrice } from '../silver/physical/physical-price-service.js';
import { getFinancialSettings } from '../settings/settings-service.js';
import { AppError } from '../../errors/app-error.js';
import { integer } from '../../utils/money.js';
import { transaction } from '../../utils/transaction.js';
export async function createCheckout(userId, { addressId, shippingMethodId }) {
  const settings = await getFinancialSettings();
  return transaction(async session => {
    const cart = await PhysicalCart.findOne({ userId }).session(session).lean();
    if (!cart?.items?.length) throw new AppError('سبد خرید خالی است.', 400, 'EMPTY_CART');
    const address = await Address.findOne({ _id: addressId, userId, active: true }).session(session).lean();
    if (!address) throw new AppError('آدرس معتبر نیست.', 404, 'ADDRESS_NOT_FOUND');
    const shipping = await ShippingMethod.findOne({ _id: shippingMethodId, active: true }).session(session).lean();
    if (!shipping || shipping.provinceRestrictions?.length && !shipping.provinceRestrictions.includes(address.province)) throw new AppError('روش ارسال معتبر نیست.', 409, 'SHIPPING_NOT_AVAILABLE');
    const price = await getPhysicalPrice(session);
    const products = await PhysicalProduct.find({ _id: { $in: cart.items.map(i => i.productId) }, active: true }).session(session).lean();
    const map = new Map(products.map(p => [String(p._id), p]));
    const items = cart.items.map(item => {
      const product = map.get(String(item.productId));
      if (!product) throw new AppError('محصول در دسترس نیست.', 409, 'CART_PRODUCT_UNAVAILABLE');
      const pricing = calculateProductPrice(product, price.pricePerGram, settings.physical);
      return { productId: product._id, sku: product.sku, name: product.name, quantity: integer(item.quantity, 1),
        unitPrice: pricing.finalPrice, lineTotal: integer(pricing.finalPrice * item.quantity),
        pricingSnapshot: { ...pricing, pricePerGram: price.pricePerGram, priceSource: price.source } };
    });
    const subtotal = integer(items.reduce((sum, i) => sum + i.lineTotal, 0));
    const shippingAmount = shipping.freeAbove != null && subtotal >= shipping.freeAbove ? 0 : integer(shipping.cost);
    const [checkout] = await CheckoutSession.create([{ userId, items, cartRevision: cart.revision || 0,
      addressSnapshot: { addressId: address._id, recipientName: address.recipientName, phoneNumber: address.phoneNumber, province: address.province, city: address.city, addressLine: address.addressLine, postalCode: address.postalCode },
      shippingSnapshot: { shippingMethodId: shipping._id, name: shipping.name, cost: shippingAmount },
      subtotal, shippingAmount, totalAmount: integer(subtotal + shippingAmount, 1),
      expiresAt: new Date(Date.now() + settings.checkout.ttlSeconds * 1000) }], { session });
    return checkout;
  });
}
export async function getCheckout(userId, id) {
  const checkout = await CheckoutSession.findOne({ _id: id, userId }).lean();
  if (!checkout) throw new AppError('Checkout پیدا نشد.', 404, 'CHECKOUT_NOT_FOUND');
  if (checkout.status === 'active' && checkout.expiresAt <= new Date()) checkout.status = 'expired';
  return checkout;
}
