# Current working-tree recheck ? 25 September 2026

This is a fresh local recheck following the earlier QA_REVIEW_2026-09-25.md. Existing application changes were preserved. Nothing was committed, pushed or deployed.

## Fixes in this pass

- Removed an unused report-chart prop that failed strict lint.
- Print titles now use the document title text property instead of interpolating customer names or invoice numbers into HTML.
- Downloaded parcel labels escape company, AWB, courier, weight and sender/receiver fields before inserting them into HTML.
- WhatsApp number normalization now prefixes ten-digit Indian numbers beginning with 91 correctly, supports international 00 prefixes and local trunk prefixes, and rejects malformed numbers.
- Added regression tests for phone normalization and HTML escaping.

## Fresh verification

- Backend: 84 unittest tests passed.
- Isolated API workflows: 69 checks passed, including collections, booking/invoice linkage, carrier reconciliation/payments, expenses, transfers, refunds and role/center restrictions.
- Frontend: 26 Node tests passed; strict lint and production build passed.
- Rendering: 34 checks passed, including permission presentation and 1,200-record directory pagination.
- Real-browser print regression: malicious title text remains inert; no injected script element or execution.
- Compiled-build browser workflows: all 19 checks passed (admin/staff login, 12 pages, customer creation, booking weights, invoice payment and KYC restrictions); no runtime errors or API 5xx responses. The harness now handles success dialogs and waits for the payment modal to close before navigation.
- Python dependency consistency: pip check passed.

## Limits

Hosted API, proxy and frontend probes returned connection errors from this environment. That does not establish a server-side outage or its cause. Live deployment verification remains incomplete. No production records were changed; workflow writes used isolated local QA databases. Existing trailing-whitespace warnings across the wider working tree were left intact to avoid unrelated formatting churn. Automated external reminder delivery and Docker image execution were not verified in this pass.
