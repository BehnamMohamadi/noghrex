import mongoose from 'mongoose';
const depositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  method: { type: String, enum: ['gateway', 'card_to_card', 'iban'], required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'rejected', 'failed', 'cancelled'], default: 'pending', index: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
  ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', default: null },
  sourceCardNumber: { type: String, default: null, trim: true },
  sourceIban: { type: String, default: null, trim: true, uppercase: true },
  transferReference: { type: String, default: null, trim: true },
  receiptUrl: { type: String, default: null, trim: true },
  userNote: { type: String, default: null, maxlength: 500 },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null, maxlength: 500 },
  completedAt: { type: Date, default: null }
}, { timestamps: true });
depositSchema.add({idempotencyKey:{type:String,maxlength:120}});
depositSchema.index({userId:1,idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$type:'string'}}});
export const Deposit = mongoose.model('Deposit', depositSchema);
