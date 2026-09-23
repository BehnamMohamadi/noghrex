import { Order } from '../../models/order/order-model.js';
import { CheckoutSession } from '../../models/checkout/checkout-session-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { PhysicalCart } from '../../models/silver/physical/cart-model.js';
import { Payment } from '../../models/payment/payment-model.js';
import { getUserLedgerAccount, ensurePlatformTomanAccount, ensurePlatformFinancialAccount } from '../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../ledger/ledger-service.js';
import { writeAudit } from '../audit/audit-service.js';
import { canFulfill, consumeInventory } from './order-inventory-service.js';
import { transaction } from '../../utils/transaction.js';
import { paginate } from '../../utils/pagination.js';
import { AppError } from '../../errors/app-error.js';

export async function createOrder(userId, { checkoutSessionId, paymentMethod }) {
  return transaction(async session => {
    const existing = await Order.findOne({ checkoutSessionId, userId }).session(session);
    if (existing) {
      if (existing.paymentMethod !== paymentMethod) throw new AppError('روش پرداخت درخواست تکراری متفاوت است.', 409, 'IDEMPOTENCY_CONFLICT');
      return existing;
    }
    const checkout = await CheckoutSession.findOneAndUpdate({ _id: checkoutSessionId, userId, status: 'active', expiresAt: { $gt: new Date() } },
      { $set: { status: 'used' } }, { new: true, session });
    if (!checkout) throw new AppError('Checkout منقضی یا نامعتبر است.', 409, 'CHECKOUT_EXPIRED');
    const data = checkout.toObject();
    const [order] = await Order.create([{ userId, checkoutSessionId, items: data.items, addressSnapshot: data.addressSnapshot,
      shippingSnapshot: data.shippingSnapshot, subtotal: data.subtotal, shippingAmount: data.shippingAmount, totalAmount: data.totalAmount,
      cartRevision: data.cartRevision, expiresAt: data.expiresAt, paymentMethod }], { session });
    return order;
  });
}
export async function clearPurchasedCart(order, session) {
  await PhysicalCart.updateOne({ userId: order.userId, revision: order.cartRevision }, { $set: { items: [] }, $inc: { revision: 1 } }, { session });
}
export async function payOrderWithWallet(userId, orderId) {
  return transaction(async session => {
    const order = await Order.findOne({ _id: orderId, userId, paymentMethod: 'wallet' }).session(session);
    if (!order) throw new AppError('سفارش پیدا نشد.', 404, 'ORDER_NOT_FOUND');
    if (['paid', 'refunded'].includes(order.paymentStatus)) return order;
    if (order.status !== 'pending_payment' || order.expiresAt <= new Date()) throw new AppError('سفارش قابل پرداخت نیست.', 409, 'ORDER_NOT_PAYABLE');
    if (!await canFulfill(order, session)) throw new AppError('موجودی محصول کافی نیست.', 409, 'PHYSICAL_INVENTORY_CHANGED');
    const wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet || wallet.toman.available < order.totalAmount) throw new AppError('موجودی تومان کافی نیست.', 409, 'INSUFFICIENT_TOMAN');
    wallet.toman.available -= order.totalAmount; await wallet.save({ session });
    await consumeInventory(order, session);
    const user = await getUserLedgerAccount(userId, 'TOMAN', 'available', session), platform = await ensurePlatformTomanAccount(session);
    await postLedgerTransaction({ type: 'order_payment', referenceType: 'order', referenceId: order._id,
      idempotencyKey: 'order-wallet:' + order._id, entries: [
        { accountId: user._id, asset: 'TOMAN', direction: 'debit', amount: order.totalAmount },
        { accountId: platform._id, asset: 'TOMAN', direction: 'credit', amount: order.totalAmount }
      ] }, session);
    order.paymentStatus = 'paid'; order.status = 'confirmed'; order.paidAt = new Date(); order.confirmedAt = new Date();
    await order.save({ session }); await clearPurchasedCart(order, session);
    return order;
  });
}
export async function finalizeVerifiedGatewayOrder(orderId, paymentId, externalSession = null) {
  const work = async session => {
    const payment = await Payment.findOne({ _id: paymentId, status: 'verified', purpose: 'order_payment', relatedEntityId: orderId }).session(session);
    const order = await Order.findOne({ _id: orderId, paymentMethod: 'gateway' }).session(session);
    if (!order || !payment || !payment.userId.equals(order.userId) || payment.amount !== order.totalAmount) throw new AppError('پرداخت تأییدشده مطابق سفارش نیست.', 409, 'PAYMENT_ORDER_MISMATCH');
    if (['paid', 'refunded'].includes(order.paymentStatus)) return order;
    let reason = order.status !== 'pending_payment' || payment.lateVerification || payment.expiresAt <= new Date() ? 'late_payment' : null;
    if (!reason && !await canFulfill(order, session)) reason = 'paid_but_inventory_unavailable';
    order.paymentId = payment._id; order.paymentStatus = 'paid'; order.paidAt = new Date();
    if (reason) { order.status = 'manual_review'; order.manualReviewReason = reason; }
    else { await consumeInventory(order, session); order.status = 'confirmed'; order.confirmedAt = new Date(); await clearPurchasedCart(order, session); }
    const platform = await ensurePlatformTomanAccount(session);
    const gateway = await ensurePlatformFinancialAccount('gateway_receipts', session);
    await postLedgerTransaction({ type: 'order_payment', referenceType: 'order', referenceId: order._id,
      idempotencyKey: 'order-gateway:' + order._id, entries: [
        { accountId: gateway._id, asset: 'TOMAN', direction: 'debit', amount: order.totalAmount },
        { accountId: platform._id, asset: 'TOMAN', direction: 'credit', amount: order.totalAmount }
      ] }, session);
    await order.save({ session }); return order;
  };
  return externalSession ? work(externalSession) : transaction(work);
}
export const listOrders = (userId, query) => paginate(Order, { userId }, query);
export async function getOrder(userId, id) {
  const order = await Order.findOne({ _id: id, userId }).lean();
  if (!order) throw new AppError('سفارش پیدا نشد.', 404, 'ORDER_NOT_FOUND');
  return order;
}
export const listAdminOrders = (filter = {}, query) => paginate(Order, filter, query);
export async function confirmManualReviewAfterSupply(orderId, adminId) {
  return transaction(async session => {
    const order = await Order.findOne({ _id: orderId, status: 'manual_review', paymentStatus: 'paid', refundPending: false }).session(session);
    if (!order) throw new AppError('سفارش قابل تأمین نیست.', 409, 'ORDER_NOT_IN_MANUAL_REVIEW');
    if (!await canFulfill(order, session)) throw new AppError('موجودی کافی نیست.', 409, 'PHYSICAL_INVENTORY_CHANGED');
    await consumeInventory(order, session);
    order.status = 'confirmed'; order.confirmedAt = new Date(); order.manualReviewReason = null; order.reviewResolvedBy = adminId;
    await order.save({ session }); await clearPurchasedCart(order, session);
    await writeAudit({ actorType: 'admin', actorId: adminId, action: 'ORDER_SUPPLIED', entityType: 'Order', entityId: order._id }, session);
    return order;
  });
}
export async function updateFulfillmentStatus(orderId, status, adminId, trackingCode) {
  const previous = { processing: 'confirmed', shipped: 'processing', delivered: 'shipped' }[status];
  if (!previous) throw new AppError('وضعیت نامعتبر است.', 400, 'INVALID_ORDER_STATUS');
  return transaction(async session => {
    const order = await Order.findById(orderId).session(session);
    if (!order || order.paymentStatus !== 'paid' || order.refundPending || !order.stockConsumed) throw new AppError('سفارش قابل ارسال نیست.', 409, 'ORDER_NOT_FULFILLABLE');
    if (order.status === status) return order;
    if (order.status !== previous) throw new AppError('ترتیب وضعیت سفارش معتبر نیست.', 409, 'INVALID_ORDER_TRANSITION');
    order.status = status; if (trackingCode) order.trackingCode = trackingCode;
    order.history.push({ status, actorId: adminId, at: new Date() }); await order.save({ session });
    await writeAudit({ actorType: 'admin', actorId: adminId, action: 'ORDER_STATUS_CHANGED', entityType: 'Order', entityId: order._id, metadata: { status, trackingCode } }, session);
    return order;
  });
}
export async function cancelOrder(userId, id) {
  return transaction(async session => {
    const order = await Order.findOne({ _id: id, userId }).session(session);
    if (!order) throw new AppError('سفارش پیدا نشد.', 404, 'ORDER_NOT_FOUND');
    if (order.status === 'cancelled') return order;
    if (order.status !== 'pending_payment' || order.paymentStatus === 'paid') throw new AppError('برای سفارش پرداخت‌شده درخواست بازپرداخت ثبت کنید.', 409, 'ORDER_NOT_CANCELLABLE');
    order.status = 'cancelled'; await order.save({ session }); return order;
  });
}
