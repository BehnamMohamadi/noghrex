import mongoose from 'mongoose';

const onlineInventorySchema = new mongoose.Schema({
  key: { type: String, enum: ['x'], default: 'x', unique: true, immutable: true },
  availableX: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
  version: { type: Number, required: true, default: 0, min: 0 }
}, { timestamps: true });

export const OnlineInventory = mongoose.model('OnlineInventory', onlineInventorySchema);
