# Fly My Cart CRM architecture

`REQUIREMENTS.md` is the product specification. `REQUIREMENTS_AUDIT.md` records verified coverage and known gaps; a passing test suite does not mean every requirement is complete.

## Runtime structure

- `frontend/src/App.jsx` owns authenticated application state, navigation, initial data loading, and refreshes after user actions.
- `frontend/src/api/client.js` is the single browser-to-API boundary. It uses `/api`, HttpOnly session cookies, and a bearer-token fallback.
- `frontend/src/context/AuthContext.jsx` owns session restoration, login/logout, account status, and UI permission checks.
- `frontend/src/pages/` contains the eleven modules listed in the requirements.
- `frontend/src/components/` contains shared UI and action modals.
- `backend/app/main.py` initializes the database and registers API routers.
- `backend/app/routers/` separates endpoints by product module.
- `backend/app/models.py` and `schemas.py` define persistence and API contracts.
- `backend/app/dependencies.py` is the authoritative session/RBAC guard.
- `backend/app/finance_engine.py` and `collections.py` hold shared financial rules.
- `backend/tests/` contains disposable-database regression and lifecycle tests.

## Data flow

The browser loads CRM data once after authentication. It does not poll. Successful create, update, delete, payment, approval, or reconciliation actions request fresh data explicitly. Financial totals are calculated from shipment, invoice, collection, refund, wallet, and reconciliation records rather than duplicated frontend constants.

An unknown staff email is registered as active Operations Staff on its first login when a full name and password are supplied. The password is stored as a hash. Once the email exists, all later logins must match that original password; login never replaces an existing credential.

## Development rules

1. Enforce authorization and financial masking in the backend; UI checks are only a usability layer.
2. Never invent records or report local success after an API failure.
3. Keep customer sale, provider cost, collection, wallet transfer, and refund as separate auditable concepts.
4. Link financial events to a shipment/AWB when applicable.
5. Add regression tests for every accounting, authentication, status-transition, and permission change.
6. Do not add timer polling or automatic refresh indicators. Refresh only after explicit lifecycle events.
7. Do not restore legacy header-based authentication, universal passwords, or email-based Super Admin bypasses.
8. First-login registration must only create unknown emails and must never reset an existing account's password.

## Production scale

- Production startup requires PostgreSQL and rejects SQLite or a placeholder `SECRET_KEY`.
- High-volume list endpoints are bounded to 100 records by default, accept `limit`/`offset`, cap pages at 500, and expose `X-Total-Count`.
- B2B company results are paginated independently from financial summary totals.
- PostgreSQL pool sizing is configured with `DB_POOL_SIZE`, `DB_MAX_OVERFLOW`, `DB_POOL_TIMEOUT_SECONDS`, and `DB_POOL_RECYCLE_SECONDS`.
- New operational identifiers use at least 64 bits of random space; invoice and reconciliation numbers use 48 random bits instead of short three-character suffixes.
- Common center/status/customer/date query paths have composite database indexes.
- Deploy multiple API workers behind a load balancer and use managed PostgreSQL backups, monitoring, connection pooling, and point-in-time recovery. The in-process cache is per worker and is an optimization, never a source of truth.

## Local verification

From the repository root:

```powershell
python -m pytest backend/tests -q
Set-Location frontend
npm.cmd run lint
npm.cmd run build
```
