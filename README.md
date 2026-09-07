# ✈️ Fly My Cart CRM - Enterprise Courier Logistics & Financial Engine

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.115-009688?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/Frontend-React_19_+_Vite_8-61DAFB?style=flat&logo=react)](https://react.dev/)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy_2.0-D71F00?style=flat&logo=sqlalchemy)](https://www.sqlalchemy.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_%7C_PostgreSQL_Ready-003B57?style=flat&logo=sqlite)](https://sqlite.org/)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)]()

A high-performance, single-entry web-based CRM and financial operating system built specifically for **Fly My Cart**, an international and domestic courier booking business.

The system eliminates duplicate data entry: a shipment booked once automatically connects with **Customer 360° profiles, GST Tax Invoices, Payment Collections, Provider Costs, Carrier Wallet Deductions, B2B Credit Ledgers, Follow-up Alerts, and Executive P&L Reports**.

---

## 📑 Table of Contents

- [Core Modules & Capabilities](#-core-modules--capabilities)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Quick Start (Local Development)](#-quick-start-local-development)
- [Automated Verification & Test Suite](#-automated-verification--test-suite)
- [Production Deployment Guide](#-production-deployment-guide)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Carrier Partner Network](#-carrier-partner-network)

---

## 🌟 Core Modules & Capabilities

### 1. 📦 Master Shipment Booking Engine
- **Single Entry Workflow**: Capture sender, receiver, dimensions, weight, price, and courier in one step.
- **Volumetric Weight Calculation**: Auto-computes volumetric weight using $(L \times W \times H) / 5000$ (Express) or $/4000$ (Cargo/LTL). Automatically calculates **Chargeable Weight** as $\max(\text{Actual Weight}, \text{Volumetric Weight})$.
- **Custom Box Manager**: Add multiple package dimensions dynamically with real-time total weight summation.
- **Permanent Customer Auto-Linking**: Customer mobile number search instantly auto-fills permanent addresses and billing history.

### 2. 👥 Customer 360° Directory
- Permanent customer repository with unified lifetime booking history, invoices, payments, and communication logs.
- Classifies customer tiers: **C2C (Walk-in)**, **B2C (E-commerce)**, and **B2B (Corporate Monthly Credit)**.
- Quick WhatsApp direct contact and printable Account Statements.

### 3. 🧾 Automated GST Invoicing & WhatsApp Sharing
- Generates official tax invoices with customer GSTIN, HSN codes, carrier breakdown, and balance due.
- Instant **1-Click WhatsApp Invoice Dispatch** with pre-composed tracking links.
- Formal print layout with dedicated `@media print` optimization.

### 4. 💳 Financial Ledgers & Carrier Wallets
- **Prepaid Partner Wallets**: Live tracking of opening balances, auto-debits on bookings, recharges, and alerts for **ICL Wallet** and **BRV Wallet**.
- **Postpaid Carrier Accounts**: Security deposits and monthly bill logging for **Aramex** and **Blue Dart**.
- **Multi-Channel Collections**: Cash, PhonePe, Google Pay, Bank NEFT/RTGS, and Office QR tracking mapped to specific staff members.

### 5. 🏢 B2B Corporate Credit & 5-Bucket Aging Schedule
- Corporate credit limit management, credit period terms (e.g. Net 30), and billing ledgers.
- Real-time **5-Bucket Receivables Aging Schedule**:
  - `Not Due`
  - `1 - 30 Days`
  - `31 - 60 Days`
  - `61 - 90 Days`
  - `90+ Days Overdue`

### 6. ⚖️ Provider Cost Reconciliation Engine
- Reconciles estimated carrier costs against actual provider invoices.
- Captures weight discrepancy, extra surcharges, and variance $(\text{Actual} - \text{Estimated})$.
- Single-click commit updates shipment gross margin and business P&L retroactively.

### 7. 🔄 Customer Refunds & Disputes Lifecycle
- 5-stage refund workflow: `Requested` &rarr; `Under Review` &rarr; `Approved` &rarr; `Rejected` &rarr; `Refunded`.
- Strict Super Admin authorization requirement for financial payouts.

### 8. 📊 Executive P&L & Reporting Engine
- **End-of-Day (EOD) Operations Audit**: Daily booking count, collections by payment mode, staff audit trail, and courier distribution.
- **Weekly & Monthly P&L Statement**: Real-time revenue, actual provider logistics costs, refund deductions, and Net Profit Margins.

---

## 🛠️ Architecture & Tech Stack

```
                               ┌─────────────────────────────────────────┐
                               │       React 19 + Vite 8 SPA UI          │
                               │   (Pure CSS Design System + Lucide)     │
                               └────────────────────┬────────────────────┘
                                                    │ REST API / JSON
                               ┌────────────────────▼────────────────────┐
                               │           FastAPI Server                │
                               │   - RBAC Auth & Permission Matrix       │
                               │   - Volumetric & Financial Engine       │
                               │   - Global Multi-Entity Search          │
                               └────────────────────┬────────────────────┘
                                                    │ SQLAlchemy 2.0 ORM
                               ┌────────────────────▼────────────────────┐
                               │           Database Layer                │
                               │  SQLite (Dev) / PostgreSQL (Production) │
                               └─────────────────────────────────────────┘
```

| Layer | Technology | Key Libraries / Features |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8 | Axios, Lucide React, Custom Responsive CSS Design System |
| **Backend** | Python 3.10+ / FastAPI | Uvicorn, Pydantic v2, CORS, Background Tasks |
| **ORM & DB** | SQLAlchemy 2.0 | SQLite (`flymycart.db`), PostgreSQL / MySQL connection support |
| **Security** | RBAC Engine | Permission gates, API-level financial data masking |

---

## 📁 Project Directory Structure

```
fly_my_cart_crm/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI server entry point & middleware
│   │   ├── database.py               # SQLAlchemy database session & engine
│   │   ├── models.py                 # Relational database models
│   │   ├── schemas.py                # Pydantic request/response validation schemas
│   │   ├── finance_engine.py         # Volumetric formulas, P&L calculations & aging
│   │   ├── routers_core.py           # Dashboard, Shipments, Customers, Search APIs
│   │   ├── routers_finance.py        # Invoices, Accounts, B2B, Refunds, Reports APIs
│   │   ├── seed.py                   # Initial demo dataset & settings
│   │   ├── test_finance_engine.py    # Unit test suite for finance math
│   │   └── verify_full_system.py     # 13-suite end-to-end integration test
│   └── requirements.txt              # Python production dependencies
│
├── frontend/
│   ├── public/
│   │   └── logo.png                  # Brand logo asset
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js             # Centralized Axios API client
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # RBAC state & role switching provider
│   │   ├── components/
│   │   │   ├── Sidebar.jsx           # Left navigation bar with dark mode
│   │   │   ├── Topbar.jsx            # Global search, centers & staff switcher
│   │   │   ├── CourierLogos.jsx      # Official vector partner logos & WhatsApp icon
│   │   │   ├── FlyMyCartLogo.jsx     # High-DPI brand identity vector component
│   │   │   ├── ShipmentModal.jsx     # Single-entry booking modal with volumetric calc
│   │   │   ├── CustomerDrawer.jsx    # 360° customer profile sliding drawer
│   │   │   ├── InvoiceModal.jsx      # GST tax invoice preview & payment recorder
│   │   │   ├── ReconciliationModal.jsx# Provider cost reconciliation modal
│   │   │   └── ActionModals.jsx      # Customer, B2B, Status, Refund modals
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx         # Executive KPI dashboard & courier volume
│   │   │   ├── CustomersAndShipments.jsx # Customers directory & Shipments engine
│   │   │   ├── InvoicesAccountsB2B.jsx   # Invoices, Provider accounts & B2B credit
│   │   │   └── OperationsAndReports.jsx # Refunds, Follow-ups, P&L reports, Settings
│   │   ├── App.jsx                   # Main routing and global state manager
│   │   ├── main.jsx                  # React DOM entry
│   │   └── index.css                 # Enterprise CSS design system & print styles
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- **Python**: 3.10, 3.11, or 3.12
- **Node.js**: 18.x or 20.x+
- **Git**

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/fly_my_cart_crm.git
cd fly_my_cart_crm
```

### Step 2: Set Up Backend
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI backend server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- **Backend API**: `http://127.0.0.1:8000`
- **Swagger Documentation**: `http://127.0.0.1:8000/docs`

### Step 3: Set Up Frontend
Open a new terminal window:
```bash
# Navigate to frontend directory
cd frontend

# Install Node packages
npm install

# Start Vite development server
npm run dev
```
- **Frontend App**: `http://localhost:5173`

---

## 🧪 Automated Verification & Test Suite

The system includes automated unit and integration tests covering the finance math, API endpoints, and database operations.

```bash
# Run finance math unit tests (Volumetric Weight, P&L, Aging Schedule, Reconciliation)
python -m app.test_finance_engine

# Run the 13-suite full system end-to-end integration test
python -m app.verify_full_system
```

### Test Suite Coverage:
1. `GET /api/dashboard/stats` - Metric aggregations
2. `GET /api/customers/` & `POST /api/customers/` - Customer directory & validation
3. `POST /api/shipments/` - Booking calculation & volumetric weight engine
4. `GET /api/invoices/` & `POST /api/invoices/{id}/payment` - GST invoice settlement
5. `GET /api/accounts/wallets` - Prepaid carrier wallet balance & transactions
6. `GET /api/b2b/` - Corporate accounts & 5-bucket aging calculation
7. `POST /api/reconciliation/` - Provider cost discrepancy audit & commit
8. `GET /api/reports/eod` & `GET /api/reports/monthly-pl` - Financial P&L calculations
9. `GET /api/search` - Global multi-entity search query
10. `RBAC Permission Masking` - Financial confidentiality rules for operations staff

---

## 🚀 Production Deployment Guide

### Option 1: Linux VPS (Ubuntu / Debian with Systemd + Nginx)

#### 1. Build the Frontend Production Bundle
```bash
cd frontend
npm install
npm run build
# Output is generated in frontend/dist/
```

#### 2. Configure Systemd Service for Backend (`/etc/systemd/system/flymycart.service`)
```ini
[Unit]
Description=Fly My Cart CRM Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/fly_my_cart_crm/backend
ExecStart=/var/www/fly_my_cart_crm/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable flymycart
sudo systemctl start flymycart
```

#### 3. Configure Nginx Reverse Proxy (`/etc/nginx/sites-available/flymycart`)
```nginx
server {
    listen 80;
    server_name crm.flymycart.com;

    # Serve built React static assets
    location / {
        root /var/www/fly_my_cart_crm/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/flymycart /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Option 2: Docker / Container Deployment

Create a `Dockerfile` for backend and frontend, or run with `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///app/flymycart.db
    volumes:
      - ./backend/app/flymycart.db:/app/flymycart.db

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

---

## 🔒 Role-Based Access Control (RBAC)

The CRM enforces strict role-based permission boundaries at both the frontend UI and backend API layers:

| Permission Capability | 👑 Super Admin | 💼 Operations Staff | 📝 Front Counter Staff |
| :--- | :---: | :---: | :---: |
| **Book Shipments & Print Invoices** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **Customer Directory & Follow-ups** | ✅ Full Access | ✅ Full Access | ✅ Full Access |
| **View Provider Costs & Gross Margins** | ✅ Visible | ❌ Masked | ❌ Masked |
| **View Financial Reports & P&L** | ✅ Full Access | ❌ Masked | ❌ Masked |
| **Approve & Process Customer Refunds** | ✅ Full Access | ❌ Request Only | ❌ Request Only |
| **Provider Cost Reconciliation** | ✅ Full Access | ❌ Restricted | ❌ Restricted |
| **Manage Settings, Wallets & Users** | ✅ Full Access | ❌ Restricted | ❌ Restricted |

*Staff can test live RBAC roles at any time using the interactive role switcher in the top navigation bar.*

---

## 🚚 Carrier Partner Network

The platform integrates custom vector brand logos for all supported courier partners:

- **FedEx** (International Express)
- **DHL Express** (Global Priority)
- **Aramex** (Middle East & Global)
- **UPS** (International Freight)
- **Delhivery** (Domestic Express)
- **Blue Dart** (Domestic Air & Surface)
- **ICL** (Prepaid Wallet)
- **BRV** (Prepaid Wallet)
- **Sree Maruthi Courier** (Regional)
- **LTL Heavy Cargo** (Freight Forwarding)

---

## 📄 License & Ownership

Copyright © 2026 **Fly My Cart Logistics Pvt. Ltd.** All rights reserved.  
Unauthorized duplication, distribution, or deployment of this software is strictly prohibited.
