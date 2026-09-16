# Payment release checklist

## Verification

Run the **Payment production checks** GitHub Actions workflow before releasing.
It runs the API suite against isolated SQLite databases and a disposable PostgreSQL
16 service, including concurrent duplicate requests and concurrent invoice payments.
It also runs frontend tests, lint and a production build. The PostgreSQL tests create
and remove a separate randomly named schema for each test.

For a local PostgreSQL run, explicitly set `TEST_POSTGRES_URL` to a disposable test
database. Never point that variable at the production database. Without it, the
PostgreSQL tests are skipped; a SQLite pass does not certify PostgreSQL concurrency.

From `backend`, with `DATABASE_URL=sqlite:///:memory:`:

```text
python -m unittest discover -s tests -v
```

From `frontend`:

```text
npm ci
node --test src/utils/paymentRequests.test.js src/utils/businessDates.test.js
npm run lint
npm run build
```

The Windows browser checks in `backend/tests/accounts_browser_check.py` and
`backend/tests/payment_details_browser_check.py` exercise the built app with mocked
API fixtures. They do not access production records.

## Release order

1. Verify a recent database backup using the existing backup procedure.
2. Apply the additive migrations in filename order:
   `20260915_accounts_workspace.sql`, `20260915_payment_details.sql`, then
   `20260915_payment_requests.sql`. Keep existing migration history intact.
3. Deploy the backend and frontend in one coordinated release. Backend startup also
   creates missing payment columns and the request table. The request table enables
   row-level security and removes access from Supabase client roles.
4. Refresh all open browser sessions. Production rejects financial mutations from
   older clients that do not send `Idempotency-Key`.
5. Check `/api/health`, sign-in, Settings account editing and permitted payment
   workflows on the deployed app. Use an approved test account/data set for writes.

## Retry and consistency behavior

- A random request key identifies each financial submission. The browser retains
  it across a timeout, a server error and a same-tab reload. It stores only a payload
  hash and random key in session storage, not account or payment details.
- The backend stores a hash scoped to the authenticated user, endpoint and key.
  Claiming the key, recording money and writing its audit event commit together.
  Retrying the same request returns the existing resource. Reusing a key with
  different contents returns HTTP 409. Invoice and refund updates use database locks.
- After an uncertain result, retry the same payment in the same tab. A new tab,
  cleared browser storage, a different user or changed payment details represents
  a different request: check the ledger before entering another payment.
- Keep the request records. Deleting them removes retry protection for old requests.
- Account edits carry a revision number; stale edits return HTTP 409. A payment
  using a saved account must match its current owner and mode-specific details.
  Historical payments retain their original detail snapshots.
- Payment amounts require at most two decimal places. Unknown prepaid wallets,
  malformed payout data and incomplete electronic payment references are rejected.

## Rollback

Keep the added nullable columns and request table when rolling back application
code. Do not delete financial records or migration data. An older backend lacks
the new validation and retry guarantees; pause payment entry if that backend must
be restored. Recheck the ledger before allowing payment entry again.

Validation checks required fields and formats. It does not confirm settlement
with a bank or UPI provider.
