# Requirements review — 8 September 2026

Reviewed against `REQUIREMENTS.md`. This is a local code and automated-test review, not a production or complete specification sign-off.

## Corrected and verified

- Shipment creation returned an undefined response after committing the booking. It now returns the saved shipment and invoice successfully.
- Partial collections used an assumed 50% payment. Booking now requires the actual amount; subsequent invoice payments have a dated collection ledger recording method, destination account and collector. Overpayments are rejected.
- Dashboard/EOD collection totals now use payment dates. Customer and B2B balances use invoice payments. Monthly refunds use approval dates. Super Admin financial reports recognize wildcard clearance; EOD shipment details are masked for staff without clearance.
- Aging buckets now measure days past the credit due date, including boundary cases. Due-this-week is calculated from credit terms instead of an estimated percentage.
- Cargo/LTL uses divisor 4000. Multi-box payloads aggregate server-calculated weights. The standard form uses the same cargo divisor.
- Delayed shipments require a reason. Invalid statuses and blank AWBs are rejected. Shipment search includes invoice numbers.
- Customers with the same name and different mobile numbers remain separate. Customer 360 uses linked customer IDs; mobile lookup requires an exact match. The form clears stale customer links while a new lookup runs.
- Reconciliation validates provider ownership, costs and duplicate applied AWBs before writing. Batch totals are calculated from verified shipments instead of trusting client totals. Cached shipment margins are invalidated after application.
- Refund status changes require Super Admin and valid transitions; payout cannot skip approval or be reversed to Requested.
- Restored the missing booking-request, quote, quote-response, conversion and customer shipment/dashboard APIs used by the existing lifecycle tests. Customer shipment responses exclude internal cost and collection-staff fields.
- Removed anonymous/header-based Super Admin fallback, passwordless password claiming and universal password fallbacks. Per the current product decision, an unknown email with a supplied full name is registered as active Operations Staff on first login; existing emails still require their originally stored password and are never overwritten. Startup preserves an existing admin password. MFA step-up validates a configured authenticator rather than accepting arbitrary text.
- The frontend respects pending/rejected/suspended states, validates the stored session on startup, and no longer rewrites unknown/customer roles to Super Admin. Fabricated dashboard fallback counts were removed.
- Startup waits for database initialization. Tests create disposable databases instead of writing to the configured CRM database.

## Verification

- `python -m pytest backend/tests -q`: **37 passed**.
- `npm.cmd run build` in `frontend`: **passed**.
- `npm.cmd run lint` in `frontend`: **exit 0**, existing warnings remain.
- Frontend still reports a bundle-size warning; backend reports a TestClient dependency deprecation warning.
- No production deployment, live account messages, or changes to the existing CRM database were performed. Browser interaction and external storage/delivery services were not verified.
- A disposable SQLite benchmark with 100,000 shipments and 10,000 customers completed successfully. Default shipment/customer pages were bounded at 100 records; the paginated B2B response was about 27 KB. Uncached aggregate routes measured roughly 0.6–1.1 seconds locally. This is a regression benchmark, not a substitute for PostgreSQL staging load testing.

## Data compatibility

The new `payment_collections` table is created during normal startup. Existing `Invoice.paid` values remain the source for lifetime paid amounts and outstanding balances. Historical records do not contain reliable collection dates or individual payment methods; they are not backfilled with invented transactions. Consequently, dated/channel collection reports cover recorded ledger transactions and may not reconcile to older lifetime invoice totals until historical payment evidence is entered through a reviewed migration.

## Remaining specification gaps

These require further implementation or integration; passing the tests above does not establish these capabilities:

| Requirement areas | Remaining work |
| --- | --- |
| Permissions and account security (§1, §17) | Consistent server-side own/center row filtering across every module; complete MFA enrollment and login challenge flow; modern salted password-hash migration; review all legacy user-management paths. |
| Booking/customer fields (§4, §6) | Full multi-box editor in the staff UI and persistent shipment box detail; complete sender/receiver email, state and ID field propagation; customer portal UI wiring for restored APIs. |
| Provider accounting (§9–12) | Complete postpaid bill/payment/deposit ledgers, statement due dates and net payable; persisted running wallet balances; reconciliation malformed-row handling and specification-aligned category names. |
| Invoicing (§13) | Configured GST split/rounding and invoice numbering are not implemented end-to-end by shipment creation; standalone PDF generation and actual email dispatch are not verified. |
| Follow-ups (§15) | Complete scheduled retention/payment reminder generation and real message-delivery status integration. |
| Reports (§16) | The weekly UI currently requests monthly data; complete weekly reporting, operational expenses and every required EOD breakdown remain outstanding. |
| Data integrity (§19) | Historical collection migration, database-enforced normalized customer-mobile uniqueness, concurrent payment/reconciliation tests and a complete financial deletion/reversal policy. |

This review fixes the reproduced operational failures but the full master specification is **not yet complete**.
