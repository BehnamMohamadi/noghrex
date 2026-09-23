import { Payment } from '../../models/payment/payment-model.js';
import { Deposit } from '../../models/deposit/deposit-model.js';
import { Order } from '../../models/order/order-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
import { getGateway } from './gateway-adapter.js';
import { getFinancialSettings } from '../settings/settings-service.js';
import { getUserLedgerAccount, ensurePlatformTomanAccount } from '../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../ledger/ledger-service.js';
import { finalizeVerifiedGatewayOrder } from '../order/order-service.js';
import { transaction } from '../../utils/transaction.js';
import { AppError } from '../../errors/app-error.js';

export async function createPayment(data, session = null) {
  const [payment] = await Payment.create([data], { session }); return payment;
}
export async function initiatePayment(userId, { purpose, entityId }) {
  const gateway = getGateway();
  const settings = await getFinancialSettings();
  return transaction(async session => {
    const Model = purpose === 'wallet_deposit' ? Deposit : Order;
    const entity = await Model.findOne({ _id: entityId, userId }).session(session);
    if (!entity) throw new AppError('درخواست پیدا نشد.', 404, 'PAYMENT_ENTITY_NOT_FOUND');
    const existing = await Payment.findOne({ relatedEntityType: purpose, relatedEntityId: entityId }).session(session);
    if (existing) return existing;
    if (purpose === 'wallet_deposit') {
      if (entity.method !== 'gateway' || entity.status !== 'pending') throw new AppError('واریز قابل پرداخت نیست.', 409, 'DEPOSIT_NOT_PAYABLE');
      entity.status = 'processing';
    } else {
      if (entity.paymentMethod !== 'gateway' || entity.status !== 'pending_payment' || entity.paymentStatus === 'paid' || entity.expiresAt <= new Date()) throw new AppError('سفارش قابل پرداخت نیست.', 409, 'ORDER_NOT_PAYABLE');
      entity.paymentStatus = 'pending';
    }
    // The local mock has no network side effect. A future remote adapter must initiate
    // outside this transaction using a persisted attempt ID, then verify on the server.
    const initiation = await gateway.initiate();
    const payment = await createPayment({ userId, purpose, method: 'gateway', amount: purpose === 'wallet_deposit' ? entity.amount : entity.totalAmount,
      status: 'pending', gateway: gateway.name, authority: initiation.authority, relatedEntityType: purpose, relatedEntityId: entityId,
      expiresAt: new Date(Date.now() + settings.checkout.paymentTtlSeconds * 1000) }, session);
    entity.paymentId = payment._id; await entity.save({ session });
    return payment;
  });
}
export async function getPayment(userId, id) {
  const payment = await Payment.findOne({ _id: id, userId }).lean();
  if (!payment) throw new AppError('پرداخت پیدا نشد.', 404, 'PAYMENT_NOT_FOUND');
  return payment;
}
export async function verifyMockPayment(userId, id, outcome = 'success') {
  const gateway = getGateway();
  const snapshot = await getPayment(userId, id);
  if (snapshot.gateway !== gateway.name) throw new AppError('درگاه پرداخت متفاوت است.', 409, 'GATEWAY_MISMATCH');
  const verified = await gateway.verify(snapshot, outcome);
  return transaction(async session => {
    const payment = await Payment.findOne({ _id: id, userId }).session(session);
    if (['verified', 'refunded'].includes(payment.status)) return payment;
    if (!verified.verified) {
      if (payment.status === 'pending') { payment.status = 'cancelled'; payment.failureReason = 'mock_cancelled'; await payment.save({ session }); }
      return payment;
    }
    if (verified.amount !== payment.amount || !verified.referenceId) throw new AppError('تأیید مبلغ پرداخت نامعتبر است.', 409, 'PAYMENT_VERIFICATION_MISMATCH');
    payment.lateVerification = payment.status !== 'pending' || payment.expiresAt <= new Date();
    payment.status = 'verified'; payment.referenceId = verified.referenceId; payment.verifiedAt = new Date(); await payment.save({ session });
    if (payment.purpose === 'order_payment') {
      await finalizeVerifiedGatewayOrder(payment.relatedEntityId, payment._id, session);
    } else {
      const deposit = await Deposit.findOne({ _id: payment.relatedEntityId, userId: payment.userId, method: 'gateway' }).session(session);
      if (!deposit || deposit.amount !== payment.amount || deposit.status === 'completed') throw new AppError('واریز تطبیق ندارد.', 409, 'PAYMENT_DEPOSIT_MISMATCH');
      const wallet = await Wallet.findOne({ userId: payment.userId }).session(session);
      if (!wallet) throw new AppError('کیف پول پیدا نشد.', 404, 'WALLET_NOT_FOUND');
      wallet.toman.available += payment.amount; await wallet.save({ session });
      let balance = await PlatformBalance.findOne({ key: 'main' }).session(session);
      if (!balance) balance = new PlatformBalance({ key: 'main' });
      balance.tomanAvailable += payment.amount; await balance.save({ session });
      const user = await getUserLedgerAccount(userId, 'TOMAN', 'available', session), platform = await ensurePlatformTomanAccount(session);
      const ledger = await postLedgerTransaction({ type: 'deposit', referenceType: 'deposit', referenceId: deposit._id,
        idempotencyKey: 'DEPOSIT:' + deposit._id, entries: [
          { accountId: platform._id, asset: 'TOMAN', direction: 'debit', amount: payment.amount },
          { accountId: user._id, asset: 'TOMAN', direction: 'credit', amount: payment.amount }
        ] }, session);
      deposit.status = 'completed'; deposit.completedAt = new Date(); deposit.ledgerTransactionId = ledger._id; await deposit.save({ session });
    }
    return payment;
  });
}
export async function expirePayments() {
  return Payment.updateMany({ status: 'pending', expiresAt: { $lte: new Date() } }, { $set: { status: 'expired' } });
}
