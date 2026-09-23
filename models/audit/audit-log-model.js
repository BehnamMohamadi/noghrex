import mongoose from 'mongoose';
const auditLogSchema = new mongoose.Schema({
  actorType: { type: String, enum: ['user', 'admin', 'system'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, default: null }
}, { timestamps: true });
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
