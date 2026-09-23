import { AuditLog } from '../../models/audit/audit-log-model.js';
export async function writeAudit({ actorType, actorId = null, action, entityType, entityId = null, metadata = null, ip = null }, session = null) {
  const [log] = await AuditLog.create([{ actorType, actorId, action, entityType, entityId, metadata, ip }], { session });
  return log;
}
