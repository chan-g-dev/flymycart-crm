# Fly My Cart CRM

Fly My Cart CRM is a web application for managing domestic and international courier operations. It brings customer records, shipment bookings, invoicing, collections and carrier accounting into one workspace.

A booking connects to its customer, invoice and provider costs, helping staff maintain consistent records without repeating the same information across separate ledgers.

## Business modules

| Module | Purpose |
| --- | --- |
| Dashboard | View booking activity, sales, collections, outstanding balances and follow-up counts. |
| Customers | Maintain customer profiles, contact details, documents and shipment history. |
| Shipments | Record unique AWBs, sender and receiver details, multiple packages, weights and shipment status. |
| Invoices | Review generated invoices, record payments and print billing documents. |
| Accounts | Manage prepaid wallets, postpaid provider accounts, deposits, expenses and collection checks. |
| Reconciliation | Compare carrier bills with recorded shipment costs and apply reviewed adjustments. |
| B2B credit | Manage corporate accounts, credit limits, payment terms and outstanding balances. |
| Refunds | Record refund requests and manage authorized approval and payout steps. |
| Follow-ups | Schedule customer tasks and review payment and retention reminders. |
| Reports | Review daily operations and weekly or monthly financial summaries. |
| Users and settings | Manage staff permissions, centers, couriers and payment configuration. |

The interface includes layouts for desktop and mobile screens. Financial visibility and available actions depend on the signed-in user's permissions.

## Technology

| Layer | Implementation |
| --- | --- |
| Frontend | React, Vite, JavaScript, CSS and Lucide icons |
| Backend | Python, FastAPI, Pydantic and SQLAlchemy |
| Local database | SQLite |
| Production database | Supabase PostgreSQL |
| Document storage | Configured private Supabase Storage bucket |
| Deployment | Vercel frontend and Docker-based Render backend |

### Data flow

The browser sends authenticated requests to the FastAPI backend. The backend validates requests and reads or writes the database selected by `DATABASE_URL`.

In production, Vercel serves the frontend, Render runs the API, and Supabase stores application data. Publishing code does not upload local SQLite records to Supabase. Existing production records remain until explicitly changed or removed.

## Repository structure

```text
backend/
  app/                  API routes, models, authentication and business logic
  scripts/              Administrative utilities
  Dockerfile            Backend production image
  requirements.txt      Python dependencies
frontend/
  src/                  Application screens, components and styles
  public/               Static assets
  package.json          Frontend dependencies and commands
  vercel.json           Frontend hosting configuration
supabase/
  migrations/           Database and storage security migrations
  schema.sql            Database reference schema
render.yaml             Render service configuration
README.md               Project overview, setup and deployment
REQUIREMENTS.md         Detailed product requirements
```

## Local development

Use Python 3.11 and a Node.js version compatible with the installed Vite release. Run the following commands from the repository root in PowerShell.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Create `backend/.env.local` with development values:

```dotenv
ENVIRONMENT=development
DEBUG=false
DATABASE_URL=sqlite:///./app.db
SECRET_KEY=<unique-random-secret-at-least-32-characters>
BOOTSTRAP_ADMIN_PASSWORD=<unique-initial-admin-password-at-least-16-characters>
STORAGE_PROVIDER=local
```

Replace the placeholders before starting. Development reads `.env` and then `.env.local`; process environment variables take precedence. Initial setup creates the required system records and admin account. An existing custom admin password is preserved.

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API runs at `http://127.0.0.1:8000`. Interactive API documentation is available at `/docs` in development mode, and the database health endpoint is `/api/health`.

### Frontend

Open a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Set `VITE_API_URL=` in `frontend/.env.local` to use Vite's local `/api` proxy. Alternatively, set it to the local backend origin without the `/api` suffix. Open `http://localhost:5173` and sign in with the configured admin credentials.

## Production deployment

### 1. Configure the backend on Render

Use the repository's `render.yaml` Blueprint or configure an existing Docker service with `backend` as its build context. Review the selected hosting plan before creating a service.

Set the following environment variables in the hosting dashboard:

| Variable | Value |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `DEBUG` | `false` |
| `DATABASE_URL` | Supabase PostgreSQL connection string with SSL |
| `SECRET_KEY` | Unique random secret of at least 32 characters |
| `BOOTSTRAP_ADMIN_PASSWORD` | Unique password of at least 16 characters for initial admin creation or replacement of the old default password |
| `FRONTEND_URL` | Exact HTTPS frontend origin, without a trailing slash |
| `STORAGE_PROVIDER` | `supabase` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend-only service role key |
| `SUPABASE_BUCKET` | Configured private document bucket name |

Production uses process environment variables rather than local dotenv files. Keep database credentials and service role keys out of Git and frontend variables. Remove the bootstrap password from hosting configuration after successful initialization when it is no longer needed.

Back up an existing database before applying migrations. Apply files in `supabase/migrations` in filename order. For an empty database, initialize application tables before running migrations and admitting users. Create the configured storage bucket before applying its security migration; ensure the migration targets the correct bucket. The private-bucket migration is intended to run once.

### 2. Configure the frontend on Vercel

Import the repository and select `frontend` as the root directory. Use `npm run build` as the build command and `dist` as the output directory.

Set `VITE_API_URL` to the actual HTTPS Render backend origin, without `/api`. Rebuild whenever this value changes; it is compiled into the frontend. The build rejects HTTP backend URLs. An empty value is appropriate only when the production host provides a same-origin `/api` proxy; Vite's development proxy does not provide one in production.

Set Render's `FRONTEND_URL` to the stable Vercel production origin and redeploy the backend. Preview deployment origins are not automatically authorized.

### 3. Verify the deployment

- Confirm `/api/health` reports a healthy database.
- Sign in and verify saving and reloading a customer, booking and invoice.
- Confirm records remain available after a backend redeploy.
- Check staff permissions and restricted financial fields.
- Verify private document uploads and authorized downloads.
- Check navigation, forms and tables on an actual mobile browser.
- Configure database backups and verify restoration using a separate database.

A custom domain can be added later through the hosting dashboards. Update `FRONTEND_URL` when the frontend origin changes and rebuild with the new `VITE_API_URL` if the backend origin changes. A domain change does not require moving the database.

## Carrier bill reconciliation

Under **Accounts > Reconciliation**, select the provider account and upload an Excel (`.xlsx` or `.xls`), CSV, TSV, TXT or searchable table PDF bill. Review the detected AWB and cost columns before applying changes.

The importer recognizes common carrier export headers, including Aramex, Blue Dart, Delhivery, DHL/BRV and FedEx/ICL. It uses the supplied final total and rounds it to two decimal places without adding GST or surcharges again. Summary rows without AWBs are excluded for review; invalid amounts, duplicate AWBs and unknown shipments must be resolved before costs are applied.

Excel formula totals require saved calculated values. Scanned PDFs require OCR first; PNG and JPG images are not bill-upload inputs. Upload limits are 20 MB per file, 50,000 shipment rows and 100 PDF pages.

## Financial and integration notes

New shipment selling prices are entered excluding GST. The current booking flow adds 18% GST, rounded to paise, to new invoices. Collections and receivables include GST; revenue and gross profit exclude it. Existing invoices retain their saved amounts. Deploy frontend and backend changes together when billing behavior changes.

Carrier bill imports record provider costs; they do not establish customer selling prices or prove customer payment. Communication records and sharing links do not by themselves confirm message delivery. External messaging and delivery confirmation require the appropriate service integration.

## Development checks

Run from `frontend`:

```powershell
npm run lint
npm run build
```

Use a real HTTPS backend origin for a production build. A successful build does not replace deployment, permission or mobile-browser verification. Local databases, secrets, dependencies and generated build files are excluded from Git.

## Product requirements

[REQUIREMENTS.md](REQUIREMENTS.md) contains the detailed product scope and workflows. It describes intended requirements; it is not a certification that every requirement or external integration has been implemented and verified.
