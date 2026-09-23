import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['wallet_deposit', 'order_payment'], required: true },
  method: { type: String, enum: ['gateway', 'card_to_card', 'iban'], required: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  status: { type: String, enum: ['pending', 'verified', 'failed', 'cancelled', 'expired', 'refunded'], default: 'pending', index: true },
  gateway: { type: String, default: null }, authority: String, referenceId: String,
  relatedEntityType: { type: String, required: true },
  relatedEntityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  lateVerification: {type:Boolean,default:false},
  expiresAt: Date, verifiedAt: Date, refundedAt: Date, failureReason: { type: String, maxlength: 500 }
}, { timestamps: true });
schema.index({ gateway: 1, authority: 1 }, { unique: true, partialFilterExpression: { authority: { $type: 'string' } } });
schema.index({ gateway: 1, referenceId: 1 }, { unique: true, partialFilterExpression: { referenceId: { $type: 'string' } } });
schema.index({ relatedEntityType: 1, relatedEntityId: 1 }, { unique: true });
export const Payment = mongoose.model('Payment', schema);
