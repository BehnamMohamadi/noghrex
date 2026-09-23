import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  nationalId: { type: String, required: true, trim: true, unique: true, index: true },
  birthDate: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  verificationMethod: { type: String, enum: ['manual', 'provider'], default: 'manual' },
  rejectionReason: { type: String, trim: true, maxlength: 500, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null }
}, { timestamps: true });

export const Kyc = mongoose.model('Kyc', kycSchema);
