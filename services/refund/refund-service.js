import { Refund } from '../../models/refund/refund-model.js';
import { Order } from '../../models/order/order-model.js';
import { Payment } from '../../models/payment/payment-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
import { transaction } from '../../utils/transaction.js';
import { paginate } from '../../utils/pagination.js';
import { restoreInventory } from '../order/order-inventory-service.js';
import { getUserLedgerAccount, ensurePlatformTomanAccount } from '../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../ledger/ledger-service.js';
import { writeAudit } from '../audit/audit-service.js';
import { AppError } from '../../errors/app-error.js';

export async function requestRefund(userId, orderId, reason) {
  return transaction(async session => {
    const existing = await Refund.findOne({ orderId, userId }).session(session);
    if (existing) return existing;
    const order = await Order.findOne({ _id: orderId, userId, paymentStatus: 'paid' }).session(session);
    if (!order) throw new AppError('سفارش پرداخت‌شده پیدا نشد.', 409, 'ORDER_NOT_REFUNDABLE');
    order.refundPending = true; await order.save({ session });
    const [refund] = await Refund.create([{ userId, orderId, amount: order.totalAmount, reason }], { session });
    return refund;
  });
}
export const listRefunds = (userId, query) => paginate(Refund, userId ? { userId } : {}, query);
export async function reviewRefund(id, adminId, decision, reason) {
  return transaction(async session => {
    const refund = await Refund.findById(id).session(session);
    if (!refund) throw new AppError('بازپرداخت پیدا نشد.', 404, 'REFUND_NOT_FOUND');
    if (refund.status === decision) return refund;
    if (refund.status !== 'requested') throw new AppError('بازپرداخت بررسی شده است.', 409, 'REFUND_ALREADY_REVIEWED');
    refund.status = decision; refund.reviewedBy = adminId; refund.reviewedAt = new Date();
    if (decision === 'rejected') { refund.rejectionReason = reason; await Order.updateOne({ _id: refund.orderId }, { $set: { refundPending: false } }, { session }); }
    await refund.save({ session });
    await writeAudit({ actorType: 'admin', actorId: adminId, action: 'REFUND_' + decision.toUpperCase(), entityType: 'Refund', entityId: refund._id, metadata: { reason } }, session);
    return refund;
  });
}
export async function completeRefund(id, adminId, stockReturned = false) {
  return transaction(async session => {
    const refund = await Refund.findById(id).session(session);
    if (!refund) throw new AppError('بازپرداخت پیدا نشد.', 404, 'REFUND_NOT_FOUND');
    if (refund.status === 'refunded') return refund;
    if (refund.status !== 'approved') throw new AppError('بازپرداخت تأیید نشده است.', 409, 'REFUND_NOT_APPROVED');
    const order = await Order.findById(refund.orderId).session(session);
    if (!order || order.paymentStatus !== 'paid' || order.totalAmount !== refund.amount) throw new AppError('مبلغ اصلی پرداخت تطبیق ندارد.', 409, 'REFUND_PAYMENT_MISMATCH');
    const shipped = ['shipped', 'delivered'].includes(order.status);
    if (shipped && !stockReturned) throw new AppError('دریافت کالای مرجوعی باید تأیید شود.', 409, 'RETURN_RECEIPT_REQUIRED');
    const wallet = await Wallet.findOne({ userId: order.userId }).session(session);
    if (!wallet) throw new AppError('کیف پول پیدا نشد.', 404, 'WALLET_NOT_FOUND');
    wallet.toman.available += refund.amount; await wallet.save({ session });
    // Direct gateway receipts become wallet-backed settlement cash only on refund.
    if (order.paymentMethod === 'gateway') {
      const payment = await Payment.findOne({ _id: order.paymentId, status: 'verified', amount: refund.amount }).session(session);
      if (!payment) throw new AppError('پرداخت اصلی معتبر نیست.', 409, 'REFUND_PAYMENT_MISMATCH');
      payment.status = 'refunded'; payment.refundedAt = new Date(); await payment.save({ session });
      let balance = await PlatformBalance.findOne({ key: 'main' }).session(session);
      if (!balance) balance = new PlatformBalance({ key: 'main' });
      balance.tomanAvailable += refund.amount; await balance.save({ session });
    }
    const user = await getUserLedgerAccount(order.userId, 'TOMAN', 'available', session), platform = await ensurePlatformTomanAccount(session);
    const ledger = await postLedgerTransaction({ type: 'refund', referenceType: 'refund', referenceId: refund._id,
      idempotencyKey: 'REFUND:' + refund._id, metadata: { originalPaymentMethod: order.paymentMethod, destination: 'wallet' }, entries: [
        { accountId: platform._id, asset: 'TOMAN', direction: 'debit', amount: refund.amount },
        { accountId: user._id, asset: 'TOMAN', direction: 'credit', amount: refund.amount }
      ] }, session);
    await restoreInventory(order, refund._id, session);
    order.status = 'refunded'; order.paymentStatus = 'refunded'; order.refundPending = false; await order.save({ session });
    refund.status = 'refunded'; refund.stockReturned = stockReturned; refund.completedAt = new Date(); refund.ledgerTransactionId = ledger._id;
    await refund.save({ session });
    await writeAudit({ actorType: 'admin', actorId: adminId, action: 'REFUND_COMPLETED', entityType: 'Refund', entityId: refund._id,
      metadata: { amount: refund.amount, stockReturned, destination: 'wallet' } }, session);
    return refund;
  });
}
