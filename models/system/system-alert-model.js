import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  severity: { type: String, enum: ['info','warning','critical'], default: 'warning', index: true },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  status: { type: String, enum: ['open','resolved'], default: 'open', index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });
schema.index({ status: 1, createdAt: -1 });
export const SystemAlert = mongoose.model('SystemAlert', schema);
