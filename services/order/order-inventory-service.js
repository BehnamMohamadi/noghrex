import {integer} from '../../utils/money.js';
import { PhysicalInventory } from '../../models/silver/physical/physical-inventory-model.js';
import { PhysicalInventoryTransaction } from '../../models/silver/physical/physical-inventory-transaction-model.js';
import { PhysicalProduct } from '../../models/silver/physical/product-model.js';
import { AppError } from '../../errors/app-error.js';

export async function canFulfill(order, session) {
  // Inspect the WHOLE basket before writes. Concurrent changes abort and retry the transaction.
  for (const item of order.items) {
    const product = await PhysicalProduct.findOne({ _id: item.productId, active: true }).session(session);
    const inventory = await PhysicalInventory.findOne({ productId: item.productId }).session(session);
    if (!product || !inventory || inventory.availableQuantity < item.quantity) return false;
  }
  return true;
}
export async function consumeInventory(order, session) {
  if (order.stockConsumed) return;
  for (const item of order.items) {
    const inventory = await PhysicalInventory.findOneAndUpdate({ productId: item.productId, availableQuantity: { $gte: item.quantity } },
      { $inc: { availableQuantity: -item.quantity, version: 1 } }, { new: true, session });
    if (!inventory) throw new AppError('موجودی محصول تغییر کرده است.', 409, 'PHYSICAL_INVENTORY_CHANGED');
    await PhysicalInventoryTransaction.create([{ productId: item.productId, type: 'sale', quantity: item.quantity,
      beforeQuantity: inventory.availableQuantity + item.quantity, afterQuantity: inventory.availableQuantity,
      reason: `order:${order._id}`, referenceType: 'order', referenceId: order._id,
      idempotencyKey: `order:${order._id}:product:${item.productId}` }], { session });
  }
  order.stockConsumed = true;
}
export async function restoreInventory(order, refundId, session) {
  if (!order.stockConsumed) return;
  for (const item of order.items) {
    const inventory = await PhysicalInventory.findOneAndUpdate({ productId: item.productId },
      { $inc: { availableQuantity: item.quantity, version: 1 } }, { new: true, session });
    if (!inventory) throw new AppError('موجودی مرجوعی پیدا نشد.', 409, 'INVENTORY_NOT_FOUND');
    integer(inventory.availableQuantity);
    await PhysicalInventoryTransaction.create([{ productId: item.productId, type: 'return', quantity: item.quantity,
      beforeQuantity: inventory.availableQuantity - item.quantity, afterQuantity: inventory.availableQuantity,
      reason: `refund:${refundId}`, referenceType: 'refund', referenceId: refundId,
      idempotencyKey: `refund:${refundId}:product:${item.productId}` }], { session });
  }
  order.stockConsumed = false;
}
