import mongoose from 'mongoose';

// All financial writes must commit durably on the primary. withTransaction handles
// transient conflicts and uncertain commits; callers must reuse their operation ID.
export function startFinancialSession() {
  return mongoose.startSession({
    defaultTransactionOptions: {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority', j: true },
      readPreference: 'primary'
    }
  });
}
