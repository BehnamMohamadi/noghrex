import {transaction} from '../../utils/transaction.js';
import {writeAudit} from '../audit/audit-service.js';
import { SystemSetting, DEFAULT_FINANCIAL_SETTINGS } from '../../models/settings/system-setting-model.js';
import { AppError } from '../../errors/app-error.js';

const FINANCIAL_KEY = 'financial';
export async function getFinancialSettingsSnapshot() {
  const doc = await SystemSetting.findOne({ key: FINANCIAL_KEY }).lean();
  const defaults = structuredClone(DEFAULT_FINANCIAL_SETTINGS);
  const settings = !doc ? defaults : Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, { ...value, ...doc.value[key] }]));
  return { settings, revision: doc?.revision ?? 0 };
}
export async function getFinancialSettings() { return (await getFinancialSettingsSnapshot()).settings; }
export async function updateFinancialSettings(value, adminId, expectedRevision) {
  if (!value || typeof value !== 'object') throw new AppError('تنظیمات معتبر نیست.', 400, 'INVALID_SETTINGS');
  try {
    return await transaction(async session=>{
      const before=await SystemSetting.findOne({key:FINANCIAL_KEY}).session(session).lean();
      if(expectedRevision !== undefined && expectedRevision !== (before?.revision ?? 0))
        throw new AppError('تنظیمات توسط مدیر دیگری تغییر کرده است. پنجره را ببندید، تنظیمات را به‌روز کنید و تغییرات را دوباره بررسی کنید.',409,'SETTINGS_VERSION_CONFLICT');
      const result=await SystemSetting.findOneAndUpdate({key:FINANCIAL_KEY},{$set:{value,updatedBy:adminId,revision:(before?.revision??0)+1}},{upsert:true,new:true,runValidators:true,session});
      await writeAudit({actorType:'admin',actorId:adminId,action:'FINANCIAL_SETTINGS_CHANGED',entityType:'SystemSetting',entityId:result._id,metadata:{before:before?.value,after:value,revision:result.revision}},session);
      return result;
    });
  } catch(error) {
    if(error.code===11000 && expectedRevision!==undefined)throw new AppError('تنظیمات هم‌زمان تغییر کرده است؛ ابتدا صفحه تنظیمات را به‌روز کنید.',409,'SETTINGS_VERSION_CONFLICT');
    throw error;
  }
}
export async function getDepositMethodSettings(method) {
  const settings = await getFinancialSettings();
  const config = settings.deposit?.[method];
  if (!config) throw new AppError('روش واریز پشتیبانی نمی‌شود.', 400, 'UNSUPPORTED_DEPOSIT_METHOD');
  return config;
}
export async function getWithdrawalSettings() { return (await getFinancialSettings()).withdrawal; }
