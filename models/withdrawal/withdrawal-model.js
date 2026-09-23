import mongoose from 'mongoose';
const withdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bankAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'BankAccount', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  feeAmount: { type: Number, required: true, default: 0, min: 0 },
  finalAmount: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['pending', 'approved', 'processing', 'completed', 'rejected', 'failed', 'cancelled'], default: 'pending', index: true },
  ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  bankReference: { type: String, default: null, trim: true },
  rejectionReason: { type: String, default: null, maxlength: 500 },
  failureReason: { type: String, default: null, maxlength: 500 },
  requestedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null }
}, { timestamps: true });
withdrawalSchema.add({idempotencyKey:{type:String,maxlength:120}});
withdrawalSchema.index({userId:1,idempotencyKey:1},{unique:true,partialFilterExpression:{idempotencyKey:{$type:'string'}}});
withdrawalSchema.index({bankReference:1},{unique:true,partialFilterExpression:{bankReference:{$type:'string'}}});
export const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);
