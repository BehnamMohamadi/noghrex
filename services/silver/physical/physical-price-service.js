import { PhysicalPrice } from '../../../models/silver/physical/physical-price-model.js';
import { AppError } from '../../../errors/app-error.js';
import { getFinancialSettings } from '../../settings/settings-service.js';
import { writeAudit } from '../../audit/audit-service.js';
import { transaction } from '../../../utils/transaction.js';
import { integer, floorProduct } from '../../../utils/money.js';
export async function getPhysicalPrice(session = null) {
  const price = await PhysicalPrice.findOne({ key: 'physical', active: true }).session(session).lean();
  if (!price) throw new AppError('قیمت نقره فیزیکی در دسترس نیست.', 503, 'PHYSICAL_PRICE_UNAVAILABLE');
  return { ...price, settings: (await getFinancialSettings()).physical };
}
export async function setPhysicalPrice(pricePerGram, adminId) {
  integer(pricePerGram, 1);
  return transaction(async session => {
    const before = await PhysicalPrice.findOne({ key: 'physical' }).session(session).lean();
    const price = await PhysicalPrice.findOneAndUpdate({ key: 'physical' }, { $set: { pricePerGram, source: 'manual', active: true, updatedBy: adminId } }, { upsert: true, new: true, runValidators: true, session });
    await writeAudit({ actorType: 'admin', actorId: adminId, action: 'PHYSICAL_PRICE_CHANGED', entityType: 'PhysicalPrice', entityId: price._id, metadata: { previousPrice: before?.pricePerGram, pricePerGram } }, session);
    return price;
  });
}
export function calculateProductPrice(product, pricePerGram, defaults = {}) {
  const config = product.pricingMode === 'custom' ? product : { ...product, ...defaults };
  const silver = floorProduct(product.weightGrams, pricePerGram);
  const wage = config.wageType === 'fixed' ? integer(config.wageValue || 0) : floorProduct(silver, config.wageValue || 0, 100);
  const profit = floorProduct(integer(silver + wage), config.profitPercent || 0, 100);
  const tax = floorProduct(integer(wage + profit), config.taxPercent || 0, 100);
  const accessories = integer(product.accessoriesAmount || 0);
  return { silverValue: silver, wage, profit, tax, accessories, finalPrice: integer(silver + wage + profit + tax + accessories, 1) };
}
