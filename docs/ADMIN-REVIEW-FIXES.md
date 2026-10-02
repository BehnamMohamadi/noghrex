# Admin review fixes — 2026-10-02

- Validation responses include the rule type and limit. Admin forms display Persian
  field-specific messages, mark affected controls and focus the first invalid field.
- KYC/bank rejection reasons require three characters in both UI and backend.
- Withdrawal confirmation displays requester, requested amount, fee, net transfer,
  destination bank/card/IBAN, and clarifies that recording success does not send money.
- Financial settings GET returns `data.settings` and `data.revision` from one read.
  PUT requires the settings fields plus `expectedRevision`. A stale version returns
  HTTP 409 / SETTINGS_VERSION_CONFLICT. The transaction writes the next revision
  with the settings and audit log. Existing documents without revision start at zero.
  Internal seed/service callers without an expected revision still advance revision.
- Admin settings expose a refresh button; a conflict disables stale submission.
  Postman reference GET captures the revision with the settings payload. Fetch again
  before another update after a successful save.

Only source review and file edits were performed. No tests or live API/database
operations were executed, per the user's instruction.
