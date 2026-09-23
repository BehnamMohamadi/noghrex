import {paginate} from '../../utils/pagination.js';
import mongoose from 'mongoose';
import {transaction} from '../../utils/transaction.js';
import { Deposit } from '../../models/deposit/deposit-model.js';
import { Payment } from '../../models/payment/payment-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
import { AppError } from '../../errors/app-error.js';
import { getDepositMethodSettings } from '../settings/settings-service.js';
import { getIranBusinessDayUtcRange } from '../../utils/business-day.js';
import { getUserLedgerAccount, ensurePlatformTomanAccount } from '../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../ledger/ledger-service.js';
import { ASSETS, BALANCE_TYPES, LEDGER_DIRECTIONS } from '../../constants/financial.js';
import { writeAudit } from '../audit/audit-service.js';

const METHODS = ['gateway', 'card_to_card', 'iban'];
function assertAmount(amount) { if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError('مبلغ واریز معتبر نیست.', 400, 'INVALID_DEPOSIT_AMOUNT'); }

async function enforceLimits(userId, method, amount, session, excludeId=null) {
  const config = await getDepositMethodSettings(method);
  if (!config.enabled) throw new AppError('این روش واریز غیرفعال است.', 409, 'DEPOSIT_METHOD_DISABLED');
  if (config.perTransactionLimit && amount > config.perTransactionLimit) throw new AppError('مبلغ از سقف هر تراکنش بیشتر است.', 400, 'DEPOSIT_TRANSACTION_LIMIT_EXCEEDED');
  if (config.dailyLimit) {
    const { start, end } = getIranBusinessDayUtcRange();
    const [row] = await Deposit.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(userId), method, ...(excludeId?{_id:{$ne:excludeId}}:{}), status: {$in:['pending','processing','completed']}, createdAt: { $gte: start, $lt: end } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).session(session);
    if ((row?.total || 0) + amount > config.dailyLimit) throw new AppError('سقف واریز روزانه این روش رد می‌شود.', 400, 'DEPOSIT_DAILY_LIMIT_EXCEEDED');
  }
}

export async function createDepositRequest(userId, payload) {
  const { method, amount } = payload;
  if (!METHODS.includes(method)) throw new AppError('روش واریز معتبر نیست.', 400, 'INVALID_DEPOSIT_METHOD');
  assertAmount(amount);
  return transaction(async session=>{
    const wallet=await Wallet.findOneAndUpdate({userId},{$inc:{financialRevision:1}},{session,new:true});if(!wallet)throw new AppError('کیف پول پیدا نشد.',404,'WALLET_NOT_FOUND');
    if(payload.idempotencyKey){const old=await Deposit.findOne({userId,idempotencyKey:payload.idempotencyKey}).session(session);if(old){if(old.method!==method||old.amount!==amount||old.transferReference!==(payload.transferReference||null))throw new AppError('کلید تکرار متفاوت است.',409,'IDEMPOTENCY_CONFLICT');return old;}}
    await enforceLimits(userId,method,amount,session);
    const [deposit]=await Deposit.create([{userId,method,amount,idempotencyKey:payload.idempotencyKey,sourceCardNumber:payload.sourceCardNumber||null,sourceIban:payload.sourceIban||null,transferReference:payload.transferReference||null,receiptUrl:payload.receiptUrl||null,userNote:payload.userNote||null}],{session});return deposit;
  });
}

export async function approveManualDeposit(depositId, adminId, ip = null) {
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      const deposit = await Deposit.findById(depositId).session(session);
      if (!deposit) throw new AppError('درخواست واریز پیدا نشد.', 404, 'DEPOSIT_NOT_FOUND');
      if (!['card_to_card','iban'].includes(deposit.method)) throw new AppError('این واریز دستی نیست.', 409, 'NOT_MANUAL_DEPOSIT');
      if(deposit.status==='completed'){result=deposit;return;}
      if (deposit.status !== 'pending') throw new AppError('این درخواست قبلاً بررسی شده است.', 409, 'DEPOSIT_ALREADY_REVIEWED');
      await enforceLimits(deposit.userId, deposit.method, deposit.amount, session, deposit._id);
      const wallet = await Wallet.findOneAndUpdate({ userId: deposit.userId },{$inc:{financialRevision:1}},{new:true,session});
      if (!wallet) throw new AppError('کیف پول پیدا نشد.', 404, 'WALLET_NOT_FOUND');
      const userAccount = await getUserLedgerAccount(deposit.userId, ASSETS.TOMAN, BALANCE_TYPES.AVAILABLE, session);
      const platformAccount = await ensurePlatformTomanAccount(session);
      const ledgerTx = await postLedgerTransaction({ type:'deposit', referenceType:'deposit', referenceId:deposit._id, idempotencyKey:`DEPOSIT:${deposit._id}`, entries:[
        { accountId: platformAccount._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.DEBIT, amount: deposit.amount },
        { accountId: userAccount._id, asset: ASSETS.TOMAN, direction: LEDGER_DIRECTIONS.CREDIT, amount: deposit.amount }
      ]}, session);
      wallet.toman.available += deposit.amount; await wallet.save({ session });
      let platformBalance=await PlatformBalance.findOne({key:'main'}).session(session);if(!platformBalance)platformBalance=new PlatformBalance({key:'main'});platformBalance.tomanAvailable+=deposit.amount;await platformBalance.save({session});
      const [payment] = await Payment.create([{ userId:deposit.userId, purpose:'wallet_deposit', method:deposit.method, amount:deposit.amount, status:'verified', relatedEntityType:'deposit', relatedEntityId:deposit._id, verifiedAt:new Date(), referenceId:deposit.transferReference }], { session });
      deposit.paymentId=payment._id; deposit.ledgerTransactionId=ledgerTx._id; deposit.status='completed'; deposit.reviewedBy=adminId; deposit.reviewedAt=new Date(); deposit.completedAt=new Date(); await deposit.save({ session });
      await writeAudit({ actorType:'admin', actorId:adminId, action:'ADMIN_APPROVED_DEPOSIT', entityType:'Deposit', entityId:deposit._id, metadata:{ amount:deposit.amount, method:deposit.method }, ip }, session);
      result=deposit;
    }); return result;
  } finally { await session.endSession(); }
}

export async function rejectManualDeposit(depositId, adminId, reason, ip = null) {
  const deposit = await Deposit.findOneAndUpdate({ _id:depositId, status:'pending',method:{$in:['card_to_card','iban']} }, { $set:{ status:'rejected', reviewedBy:adminId, reviewedAt:new Date(), rejectionReason:reason } }, { new:true });
  if (!deposit) throw new AppError('درخواست واریز قابل رد کردن پیدا نشد.', 409, 'DEPOSIT_NOT_PENDING');
  await writeAudit({ actorType:'admin', actorId:adminId, action:'ADMIN_REJECTED_DEPOSIT', entityType:'Deposit', entityId:deposit._id, metadata:{ reason }, ip });
  return deposit;
}
export async function listUserDeposits(userId,query){return paginate(Deposit,{userId},query);}
export async function listPendingManualDeposits(query) { return paginate(Deposit,{status:'pending',method:{$in:['card_to_card','iban']}},query); }
