import { Router } from 'express';
import mongoose from 'mongoose';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { pagination } from '../../utils/pagination.js';
import { getIranBusinessDayUtcRange } from '../../utils/business-day.js';
import { AppError } from '../../errors/app-error.js';
import { User } from '../../models/account/user-model.js';
import { Kyc } from '../../models/account/kyc-model.js';
import { BankAccount } from '../../models/account/bank-account-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { Trade } from '../../models/silver/online/trade-model.js';
import { OnlinePrice } from '../../models/silver/online/online-price-model.js';
import { OnlinePriceHistory } from '../../models/silver/online/online-price-history-model.js';
import { OnlineInventory } from '../../models/silver/online/online-inventory-model.js';
import { XInventoryTransaction } from '../../models/silver/online/x-inventory-transaction-model.js';
import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
import { BuybackAdjustment } from '../../models/platform/buyback-adjustment-model.js';
import { Order } from '../../models/order/order-model.js';
import { PhysicalProduct } from '../../models/silver/physical/product-model.js';
import { PhysicalPrice } from '../../models/silver/physical/physical-price-model.js';
import { PhysicalInventory } from '../../models/silver/physical/physical-inventory-model.js';
import { PhysicalInventoryTransaction } from '../../models/silver/physical/physical-inventory-transaction-model.js';
import { ShippingMethod } from '../../models/shipping/shipping-method-model.js';
import { Deposit } from '../../models/deposit/deposit-model.js';
import { Withdrawal } from '../../models/withdrawal/withdrawal-model.js';
import { Payment } from '../../models/payment/payment-model.js';
import { Refund } from '../../models/refund/refund-model.js';
import { AuditLog } from '../../models/audit/audit-log-model.js';
import { LedgerTransaction } from '../../models/ledger/ledger-transaction-model.js';
import { LedgerEntry } from '../../models/ledger/ledger-entry-model.js';
import { SystemAlert } from '../../models/system/system-alert-model.js';

const router = Router(); router.use(authenticate, authorize('admin'));
const person = 'firstname lastname phoneNumber';
const resources = {
  users: { model: User, search: ['firstname', 'lastname', 'phoneNumber', 'email'], status: 'accountStatus' },
  orders: { model: Order, populate: ['userId'], status: 'status' },
  products: { model: PhysicalProduct, search: ['name', 'sku', 'slug', 'category'], active: true },
  shipping: { model: ShippingMethod, search: ['name'], active: true },
  deposits: { model: Deposit, populate: ['userId'], status: 'status', search: ['transferReference'] },
  withdrawals: { model: Withdrawal, populate: ['userId', 'bankAccountId'], status: 'status', search: ['bankReference'] },
  payments: { model: Payment, populate: ['userId'], status: 'status', search: ['referenceId', 'authority'] },
  refunds: { model: Refund, populate: ['userId', 'orderId'], status: 'status' },
  kyc: { model: Kyc, populate: ['userId'], status: 'status', search: ['nationalId'] },
  banks: { model: BankAccount, populate: ['userId'], status: 'status', search: ['iban', 'cardNumber', 'bankName'] },
  trades: { model: Trade, populate: ['userId'], status: 'side' },
  'x-history': { model: XInventoryTransaction, populate: ['actorId'], status: 'type', search: ['reason'] },
  'price-history': { model: OnlinePriceHistory, populate: ['changedBy'], search: ['source'] },
  'budget-history': { model: BuybackAdjustment, populate: ['adminId'], status: 'type', search: ['reason'] },
  'stock-history': { model: PhysicalInventoryTransaction, populate: ['actorId', 'productId'], status: 'type', search: ['reason'] },
  audit: { model: AuditLog, populate: ['actorId'], search: ['action', 'entityType'] },
  ledger: { model: LedgerTransaction, status: 'type', search: ['referenceType', 'idempotencyKey'] },
  alerts: { model: SystemAlert, status: 'status', search: ['title', 'message', 'type'] }
};
function populate(query, paths = []) {
  for (const path of paths) query.populate(path, ['userId', 'actorId', 'adminId', 'changedBy'].includes(path) ? person : undefined);
  return query;
}
router.get('/overview', async (req, res) => {
  const today = getIranBusinessDayUtcRange().start;
  const weekStart = new Date(today.getTime() - 6 * 86400000);
  const [users, orders, deposits, withdrawals, kyc, banks, refunds, alerts, price, physicalPrice, inventory, balance, trades, latestOrders, trend, lowStock] = await Promise.all([
    User.countDocuments({ role: 'user' }), Order.countDocuments({ status: { $in: ['confirmed', 'processing', 'manual_review'] } }),
    Deposit.countDocuments({ method: { $in: ['card_to_card', 'iban'] }, status: 'pending' }),
    Withdrawal.countDocuments({ status: { $in: ['pending', 'approved', 'processing'] } }), Kyc.countDocuments({ status: 'pending' }),
    BankAccount.countDocuments({ status: 'pending', isActive: true }), Refund.countDocuments({ status: { $in: ['requested', 'approved'] } }),
    SystemAlert.countDocuments({ status: 'open' }), OnlinePrice.findOne({ key: 'current' }).lean(), PhysicalPrice.findOne({ key: 'physical' }).lean(),
    OnlineInventory.findOne({ key: 'x' }).lean(), PlatformBalance.findOne({ key: 'main' }).lean(),
    Trade.aggregate([{ $match: { status: 'completed', executedAt: { $gte: weekStart } } }, { $group: { _id: '$side', count: { $sum: 1 }, xAmount: { $sum: '$xAmount' }, grossToman: { $sum: '$grossToman' }, commissionToman: { $sum: '$commissionToman' } } }]),
    Order.find().sort({ createdAt: -1 }).limit(5).populate('userId', person).lean(),
    Trade.aggregate([{ $match: { status: 'completed', executedAt: { $gte: weekStart } } }, { $group: { _id: { day: { $dateToString: { format: '%Y-%m-%d', date: '$executedAt', timezone: 'Asia/Tehran' } }, side: '$side' }, amount: { $sum: '$grossToman' } } }]),
    PhysicalInventory.countDocuments({ availableQuantity: { $lte: 3 } })
  ]);
  res.json({ status: 'success', data: { counts: { users, orders, deposits, withdrawals, kyc, banks, refunds, alerts, lowStock },
    price, physicalPrice, inventoryX: inventory?.availableX || 0, buybackToman: balance?.buybackAvailableToman || 0,
    settlementToman: balance?.tomanAvailable || 0, trades, latestOrders, trend, weekStart, serverTime: new Date(),
    environment: process.env.NODE_ENV || 'development', gateway: process.env.PAYMENT_GATEWAY || 'mock' } });
});
router.get('/:resource', async (req, res) => {
  const spec = resources[req.params.resource];
  if (!spec) throw new AppError('بخش پیدا نشد.', 404, 'RESOURCE_NOT_FOUND');
  const { page, limit, skip } = pagination(req.query), filter = {};
  if (typeof req.query.status === 'string' && req.query.status) {
    if (spec.active) { if (['active', 'inactive'].includes(req.query.status)) filter.active = req.query.status === 'active'; }
    else if (spec.status) filter[spec.status] = req.query.status;
  }
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const text = req.query.q.trim().slice(0, 100);
    const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matches = (spec.search || []).map(field => ({ [field]: regex }));
    if (mongoose.isObjectIdOrHexString(text)) matches.push({ _id: text });
    if (spec.populate?.includes('userId')) {
      const people = await User.find({ $or: [{ firstname: regex }, { lastname: regex }, { phoneNumber: regex }] }).select('_id').limit(100).lean();
      matches.push({ userId: { $in: people.map(p => p._id) } });
    }
    filter.$or = matches.length ? matches : [{ _id: null }];
  }
  const [items, total] = await Promise.all([populate(spec.model.find(filter).select('-password -tokenVersion').sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit), spec.populate).lean(), spec.model.countDocuments(filter)]);
  if (req.params.resource === 'products') {
    const stock = await PhysicalInventory.find({ productId: { $in: items.map(i => i._id) } }).lean();
    const stockMap = new Map(stock.map(i => [String(i.productId), i.availableQuantity]));
    items.forEach(item => { item.availableQuantity = stockMap.get(String(item._id)) || 0; });
  }
  res.json({ status: 'success', data: { items, total, page, perPage: limit, totalPages: Math.ceil(total / limit) } });
});
router.get('/:resource/:id', async (req, res) => {
  const spec = resources[req.params.resource];
  if (!spec) throw new AppError('بخش پیدا نشد.', 404, 'RESOURCE_NOT_FOUND');
  const item = await populate(spec.model.findById(req.params.id).select('-password -tokenVersion'), spec.populate).lean();
  if (!item) throw new AppError('رکورد پیدا نشد.', 404, 'RECORD_NOT_FOUND');
  const data = { item };
  if (req.params.resource === 'users') data.wallet = await Wallet.findOne({ userId: item._id }).lean();
  if (req.params.resource === 'products') data.inventory = await PhysicalInventory.findOne({ productId: item._id }).lean();
  if (req.params.resource === 'ledger') data.entries = await LedgerEntry.find({ transactionId: item._id }).populate('accountId').lean();
  res.json({ status: 'success', data });
});
export default router;
