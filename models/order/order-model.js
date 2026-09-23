import mongoose from 'mongoose';
const money = { type: Number, required: true, min: 0, validate: Number.isSafeInteger };
const item = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'PhysicalProduct', required: true },
  sku: String, name: String, quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  unitPrice: money, lineTotal: money, pricingSnapshot: mongoose.Schema.Types.Mixed
}, { _id: false });
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  checkoutSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'CheckoutSession', required: true, unique: true },
  items: { type: [item], required: true }, addressSnapshot: mongoose.Schema.Types.Mixed, shippingSnapshot: mongoose.Schema.Types.Mixed,
  subtotal: money, shippingAmount: money, totalAmount: money,
  paymentMethod: { type: String, enum: ['wallet', 'gateway'], required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed', 'refunded'], default: 'unpaid', index: true },
  status: { type: String, enum: ['pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'manual_review', 'refunded'], default: 'pending_payment', index: true },
  manualReviewReason: String, reviewResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  paidAt: Date, confirmedAt: Date, expiresAt: { type: Date, required: true },
  stockConsumed: { type: Boolean, default: false }, cartRevision: Number,
  refundPending: { type: Boolean, default: false }, trackingCode: String,
  history: [{ status: String, actorId: mongoose.Schema.Types.ObjectId, at: Date, reason: String }]
}, { timestamps: true });
export const Order = mongoose.model('Order', schema);
