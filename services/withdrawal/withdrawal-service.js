import {paginate} from '../../utils/pagination.js';
import mongoose from 'mongoose';
import { Withdrawal } from '../../models/withdrawal/withdrawal-model.js';
import { BankAccount } from '../../models/account/bank-account-model.js';
import { Wallet } from '../../models/wallet/wallet-model.js';
import { PlatformBalance } from '../../models/platform/platform-balance-model.js';
import { AppError } from '../../errors/app-error.js';
import { getWithdrawalSettings } from '../settings/settings-service.js';
import { getIranBusinessDayUtcRange } from '../../utils/business-day.js';
import { getUserLedgerAccount, ensurePlatformTomanAccount } from '../ledger/ledger-account-service.js';
import { postLedgerTransaction } from '../ledger/ledger-service.js';
import { ASSETS, BALANCE_TYPES, LEDGER_DIRECTIONS } from '../../constants/financial.js';
import { writeAudit } from '../audit/audit-service.js';

const ACTIVE_DAILY_STATUSES=['pending','approved','processing','completed'];
function assertAmount(v){ if(!Number.isSafeInteger(v)||v<=0) throw new AppError('مبلغ برداشت معتبر نیست.',400,'INVALID_WITHDRAWAL_AMOUNT'); }

async function enforceWithdrawalLimits(userId, amount, session) {
  const cfg=await getWithdrawalSettings();
  if(!cfg.enabled) throw new AppError('برداشت موقتاً غیرفعال است.',409,'WITHDRAWAL_DISABLED');
  if(cfg.minimumAmount && amount<cfg.minimumAmount) throw new AppError('مبلغ از حداقل برداشت کمتر است.',400,'WITHDRAWAL_BELOW_MINIMUM');
  if(cfg.perTransactionLimit && amount>cfg.perTransactionLimit) throw new AppError('مبلغ از سقف هر برداشت بیشتر است.',400,'WITHDRAWAL_TRANSACTION_LIMIT_EXCEEDED');
  if(cfg.dailyLimit){ const {start,end}=getIranBusinessDayUtcRange(); const [row]=await Withdrawal.aggregate([{ $match:{ userId:new mongoose.Types.ObjectId(userId), status:{ $in:ACTIVE_DAILY_STATUSES }, requestedAt:{ $gte:start,$lt:end } } },{$group:{_id:null,total:{$sum:'$amount'}}}]).session(session); if((row?.total||0)+amount>cfg.dailyLimit) throw new AppError('سقف برداشت روزانه رد می‌شود.',400,'WITHDRAWAL_DAILY_LIMIT_EXCEEDED'); }
  return cfg;
}

export async function createWithdrawal(userId,{amount,bankAccountId,idempotencyKey}){
  assertAmount(amount);
  const bank=await BankAccount.findOne({_id:bankAccountId,userId,isActive:true,status:'verified'}).lean();
  if(!bank) throw new AppError('حساب بانکی تأییدشده متعلق به کاربر پیدا نشد.',400,'VERIFIED_BANK_ACCOUNT_REQUIRED');

  const session=await mongoose.startSession(); let result;
  try{ await session.withTransaction(async()=>{
    const wallet=await Wallet.findOneAndUpdate({userId},{$inc:{financialRevision:1}},{new:true,session});
    if(idempotencyKey){const old=await Withdrawal.findOne({userId,idempotencyKey}).session(session);if(old){if(old.amount!==amount||String(old.bankAccountId)!==String(bankAccountId))throw new AppError('کلید تکرار متفاوت است.',409,'IDEMPOTENCY_CONFLICT');result=old;return;}}
    const cfg=await enforceWithdrawalLimits(userId,amount,session);const fee=cfg.feeAmount||0;if(amount<=fee)throw new AppError('مبلغ برداشت باید بیشتر از کارمزد باشد.',400,'INVALID_WITHDRAWAL_AFTER_FEE'); if(!wallet) throw new AppError('کیف پول پیدا نشد.',404,'WALLET_NOT_FOUND');
    if(wallet.toman.available<amount) throw new AppError('موجودی تومانی کافی نیست.',409,'INSUFFICIENT_TOMAN_BALANCE');
    wallet.toman.available-=amount; wallet.toman.locked+=amount; await wallet.save({session});
    const available=await getUserLedgerAccount(userId,ASSETS.TOMAN,BALANCE_TYPES.AVAILABLE,session); const locked=await getUserLedgerAccount(userId,ASSETS.TOMAN,BALANCE_TYPES.LOCKED,session);
    const [withdrawal]=await Withdrawal.create([{userId,bankAccountId,idempotencyKey,amount,feeAmount:fee,finalAmount:amount-fee,status:'pending'}],{session});
    const ledgerTx=await postLedgerTransaction({type:'transfer',referenceType:'withdrawal_lock',referenceId:withdrawal._id,idempotencyKey:`WITHDRAWAL_LOCK:${withdrawal._id}`,entries:[{accountId:available._id,asset:ASSETS.TOMAN,direction:LEDGER_DIRECTIONS.DEBIT,amount},{accountId:locked._id,asset:ASSETS.TOMAN,direction:LEDGER_DIRECTIONS.CREDIT,amount}]},session);
    withdrawal.ledgerTransactionId=ledgerTx._id; await withdrawal.save({session}); result=withdrawal;
  }); return result; } finally{ await session.endSession(); }
}

export async function approveWithdrawal(id,adminId,ip=null){ const w=await Withdrawal.findOneAndUpdate({_id:id,status:'pending'},{$set:{status:'approved',reviewedBy:adminId,reviewedAt:new Date()}},{new:true}); if(!w) throw new AppError('برداشت Pending پیدا نشد.',409,'WITHDRAWAL_NOT_PENDING'); await writeAudit({actorType:'admin',actorId:adminId,action:'ADMIN_APPROVED_WITHDRAWAL',entityType:'Withdrawal',entityId:w._id,metadata:{amount:w.amount},ip}); return w; }
export async function markWithdrawalProcessing(id,adminId,ip=null){ const w=await Withdrawal.findOneAndUpdate({_id:id,status:'approved'},{$set:{status:'processing'}},{new:true}); if(!w) throw new AppError('برداشت Approved پیدا نشد.',409,'WITHDRAWAL_NOT_APPROVED'); await writeAudit({actorType:'admin',actorId:adminId,action:'ADMIN_PROCESSING_WITHDRAWAL',entityType:'Withdrawal',entityId:w._id,ip}); return w; }

export async function completeWithdrawal(id,adminId,bankReference,ip=null){
 const session=await mongoose.startSession(); let result; try{await session.withTransaction(async()=>{
  const w=await Withdrawal.findOne({_id:id}).session(session);if(w?.status==='completed'){if(w.bankReference!==bankReference)throw new AppError('شماره پیگیری متفاوت است.',409,'IDEMPOTENCY_CONFLICT');result=w;return;} if(!w||w.status!=='processing') throw new AppError('برداشت Processing پیدا نشد.',409,'WITHDRAWAL_NOT_PROCESSING');
  const wallet=await Wallet.findOne({userId:w.userId}).session(session); if(!wallet||wallet.toman.locked<w.amount) throw new AppError('موجودی قفل‌شده برداشت معتبر نیست.',409,'WITHDRAWAL_LOCK_MISMATCH');
  const platform=await PlatformBalance.findOne({key:'main'}).session(session); if(!platform||platform.tomanAvailable<w.finalAmount) throw new AppError('نقدینگی تومانی نقرکس کافی نیست.',409,'PLATFORM_TOMAN_LIQUIDITY_INSUFFICIENT');
  wallet.toman.locked-=w.amount; await wallet.save({session}); platform.tomanAvailable-=w.finalAmount; await platform.save({session});
  const locked=await getUserLedgerAccount(w.userId,ASSETS.TOMAN,BALANCE_TYPES.LOCKED,session); const platformAccount=await ensurePlatformTomanAccount(session);
  await postLedgerTransaction({type:'withdrawal',referenceType:'withdrawal',referenceId:w._id,idempotencyKey:`WITHDRAWAL_COMPLETE:${w._id}`,entries:[{accountId:locked._id,asset:ASSETS.TOMAN,direction:LEDGER_DIRECTIONS.DEBIT,amount:w.amount},{accountId:platformAccount._id,asset:ASSETS.TOMAN,direction:LEDGER_DIRECTIONS.CREDIT,amount:w.amount}]},session);
  w.status='completed'; w.bankReference=bankReference; w.completedAt=new Date(); await w.save({session}); await writeAudit({actorType:'admin',actorId:adminId,action:'ADMIN_COMPLETED_WITHDRAWAL',entityType:'Withdrawal',entityId:w._id,metadata:{bankReference},ip},session); result=w;
 });return result;}finally{await session.endSession();}
}

export async function rejectWithdrawal(id,adminId,reason,ip=null,confirmedBankFailure=false){
 const session=await mongoose.startSession();let result;try{await session.withTransaction(async()=>{
  const w=await Withdrawal.findOne({_id:id,status:{$in:confirmedBankFailure?['processing']:['pending','approved']}}).session(session);if(!w)throw new AppError('این برداشت قابل رد کردن نیست.',409,'WITHDRAWAL_NOT_REJECTABLE');
  const wallet=await Wallet.findOne({userId:w.userId}).session(session);if(!wallet||wallet.toman.locked<w.amount)throw new AppError('موجودی قفل‌شده معتبر نیست.',409,'WITHDRAWAL_LOCK_MISMATCH'); wallet.toman.locked-=w.amount;wallet.toman.available+=w.amount;await wallet.save({session});
  const available=await getUserLedgerAccount(w.userId,ASSETS.TOMAN,BALANCE_TYPES.AVAILABLE,session);const locked=await getUserLedgerAccount(w.userId,ASSETS.TOMAN,BALANCE_TYPES.LOCKED,session);
  await postLedgerTransaction({type:'transfer',referenceType:'withdrawal_unlock',referenceId:w._id,idempotencyKey:`WITHDRAWAL_UNLOCK:${w._id}`,entries:[{accountId:locked._id,asset:ASSETS.TOMAN,direction:LEDGER_DIRECTIONS.DEBIT,amount:w.amount},{accountId:available._id,asset:ASSETS.TOMAN,direction:LEDGER_DIRECTIONS.CREDIT,amount:w.amount}]},session);
  w.status=confirmedBankFailure?'failed':'rejected';w.rejectionReason=reason;w.reviewedBy=adminId;w.reviewedAt=new Date();await w.save({session});await writeAudit({actorType:'admin',actorId:adminId,action:'ADMIN_REJECTED_WITHDRAWAL',entityType:'Withdrawal',entityId:w._id,metadata:{reason},ip},session);result=w;
 });return result;}finally{await session.endSession();}
}
export async function listUserWithdrawals(userId,query){return paginate(Withdrawal,{userId},query);}
export async function listPendingWithdrawals(query){return paginate(Withdrawal,{status:{$in:['pending','approved','processing']}},query);}
