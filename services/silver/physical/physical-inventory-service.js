import { PhysicalInventory } from '../../../models/silver/physical/physical-inventory-model.js';
import { PhysicalInventoryTransaction } from '../../../models/silver/physical/physical-inventory-transaction-model.js';
import { AppError } from '../../../errors/app-error.js';
import { writeAudit } from '../../audit/audit-service.js';
import { transaction } from '../../../utils/transaction.js';
import { integer } from '../../../utils/money.js';
export async function adjustInventory({productId,type,quantity,reason,actorId,idempotencyKey}) {
  integer(quantity,1);
  return transaction(async session=>{
    const inv=await PhysicalInventory.findOneAndUpdate({productId},{$inc:{version:1}},{new:true,session});
    if(!inv)throw new AppError('موجودی پیدا نشد.',404,'INVENTORY_NOT_FOUND');
    const old=await PhysicalInventoryTransaction.findOne({idempotencyKey}).session(session);
    if(old){
      if(String(old.productId)!==String(productId)||old.type!==type||old.quantity!==quantity||old.reason!==reason||String(old.actorId)!==String(actorId))throw new AppError('کلید تکرار متفاوت است.',409,'IDEMPOTENCY_CONFLICT');
      return old;
    }
    const before=inv.availableQuantity;
    if(type==='decrease'&&before<quantity)throw new AppError('موجودی کافی نیست.',409,'INSUFFICIENT_PHYSICAL_INVENTORY');
    inv.availableQuantity=integer(before+(type==='increase'?quantity:-quantity));await inv.save({session});
    const [out]=await PhysicalInventoryTransaction.create([{productId,type,quantity,beforeQuantity:before,afterQuantity:inv.availableQuantity,reason,actorId,idempotencyKey}],{session});
    await writeAudit({actorType:'admin',actorId,action:'PHYSICAL_INVENTORY_ADJUSTED',entityType:'PhysicalInventoryTransaction',entityId:out._id,metadata:{productId,type,quantity,reason}},session);
    return out;
  });
}
