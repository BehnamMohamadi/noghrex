# Financial code review — 2026-10-02

Scope: static source review of wallet payments, online trades, gateway verification,
deposits, withdrawals, refunds, ledger entries and inventory changes.
No tests, API calls, database mutations or load simulations were run for this review.

## Changes

- All application-created transaction sessions now explicitly use primary reads,
  snapshot read concern and majority+journal write concern. Driver transaction
  retry handling remains in place; no blanket retry of financial requests was added.
- Reusing a ledger key now checks transaction type, reference, posted state and
  the complete financial entry set. A changed request produces IDEMPOTENCY_CONFLICT.
- Withdrawal replay is resolved before rechecking current bank eligibility. New
  withdrawals check and write-lock the bank document within the transaction,
  so concurrent bank deactivation cannot silently use a stale outside read.
- Deposit replay also compares source card, IBAN, receipt and user note.
- Physical inventory adjustments reject unknown operation types and missing keys
  at service level, even when bypassing HTTP validation.

## Existing controls observed in source

- Wallet payment writes wallet, inventory, ledger and order state in one transaction;
  paid/refunded orders return their existing state on replay.
- Physical stock consumption uses a conditional quantity decrement and a unique
  per-order/product inventory reference.
- Trades use a unique quote reference and transaction-scoped wallet/inventory
  updates; duplicate-key recovery looks up the completed trade for that user.
- Gateway verification writes payment state and the financial outcome together;
  verified/refunded payments return without crediting the wallet again.
- Late or unfulfillable gateway orders enter manual review rather than consuming
  unavailable stock. Refunds return funds to the wallet in a transaction.
- Withdrawal creation locks funds; completion and rejection move the locked funds
  transactionally. Requests use persisted operation identifiers.

## Limits and outstanding verification

These are source observations, not runtime guarantees. Concurrent transactions,
network loss at commit, primary failover, and reconciliation of actual database
balances against ledger entries remain untested per the user's instruction.
After a lost response, clients must query/retry the SAME operation identifier;
creating a new deposit/checkout key describes a new operation, not a retry.
Only a mock gateway exists. Real gateway initiation, verification, timeout recovery
and external settlement reconciliation require the selected provider's integration.
Majority acknowledgement on a single-node development replica set is not redundant
storage and does not replace production replication or backups.
