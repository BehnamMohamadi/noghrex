import crypto from 'node:crypto';
import { AppError } from '../../errors/app-error.js';

// Real adapters must implement initiate and verify, returning a bank-verified amount
// and unique referenceId. Never trust the browser's success flag or submitted amount.
export function getGateway() {
  if ((process.env.PAYMENT_GATEWAY || 'mock') !== 'mock' || process.env.NODE_ENV === 'production') {
    throw new AppError('درگاه واقعی هنوز پیکربندی نشده است.', 503, 'GATEWAY_NOT_CONFIGURED');
  }
  return {
    name: 'mock',
    async initiate() { return { authority: 'MOCK-' + crypto.randomUUID() }; },
    async verify(payment, outcome) {
      if (outcome !== 'success') return { verified: false };
      return { verified: true, amount: payment.amount, referenceId: 'MOCK-REF-' + payment._id };
    }
  };
}
