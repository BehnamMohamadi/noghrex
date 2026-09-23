import {transaction} from '../../utils/transaction.js';
import {writeAudit} from '../audit/audit-service.js';
import { SystemSetting, DEFAULT_FINANCIAL_SETTINGS } from '../../models/settings/system-setting-model.js';
import { AppError } from '../../errors/app-error.js';

const FINANCIAL_KEY = 'financial';
export async function getFinancialSettings() {
  const doc = await SystemSetting.findOne({ key: FINANCIAL_KEY }).lean();
  const defaults = structuredClone(DEFAULT_FINANCIAL_SETTINGS);
  if (!doc) return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...doc.value[key] }]));
}
export async function updateFinancialSettings(value, adminId) {
  if (!value || typeof value !== 'object') throw new AppError('تنظیمات معتبر نیست.', 400, 'INVALID_SETTINGS');
  return transaction(async session=>{const before=await SystemSetting.findOne({key:FINANCIAL_KEY}).session(session).lean();const result=await SystemSetting.findOneAndUpdate({ key: FINANCIAL_KEY }, { $set: { value, updatedBy: adminId } }, { upsert: true, new: true, runValidators: true,session });await writeAudit({actorType:'admin',actorId:adminId,action:'FINANCIAL_SETTINGS_CHANGED',entityType:'SystemSetting',entityId:result._id,metadata:{before:before?.value,after:value}},session);return result;});
}
export async function getDepositMethodSettings(method) {
  const settings = await getFinancialSettings();
  const config = settings.deposit?.[method];
  if (!config) throw new AppError('روش واریز پشتیبانی نمی‌شود.', 400, 'UNSUPPORTED_DEPOSIT_METHOD');
  return config;
}
export async function getWithdrawalSettings() { return (await getFinancialSettings()).withdrawal; }
