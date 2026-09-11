# ✈️ FLY MY CART CRM — MASTER SYSTEM REQUIREMENTS & SPECIFICATION

**Project**: Fly My Cart CRM  
**Domain**: International & Domestic Courier Logistics & Financial Operating Engine  
**Core Objective**: High-performance, single-entry web-based CRM and financial management platform.  
**Guiding Principle**: **Enter Once, Auto-Connect Everywhere**. Eliminate duplicate data entry. A shipment booked once automatically connects with Customer 360°, GST Invoices, Payment Collections, Carrier Wallets/Costs, B2B Credit Ledgers, Follow-ups, and Executive P&L Reports.

---

## 1. USER ROLES & PERMISSION ARCHITECTURE

### Super Admin
- Full, unrestricted access across all modules and centers.
- User management: review, approve, reject, suspend, reactivate users, and assign roles.
- Permission matrix configuration.
- Full access to all sensitive financial data (gross profit margins, carrier costs, provider bills, company P&L).
- Sole authority to approve and disburse customer refunds.
- Full control over provider wallets, deposits, and bank reconciliations.
- Full system configuration and master settings control.

### Admin / Operations Staff / Front Counter
- Access restricted strictly to modules and actions assigned by the Super Admin.
- Granular permission flags:
  - **View**
  - **Add**
  - **Edit**
  - **Delete**
  - **Export**
  - **Approve**
- **Financial Confidentiality Gate**: Sensitive financial metrics (carrier buy rates, gross margins, P&L reports, provider reconciliation balance) must be masked at both API and UI levels for staff without explicit financial clearance.

---

## 2. SYSTEM NAVIGATION & MAIN MODULES

The application features a clean, responsive left sidebar navigation with the following dedicated modules:

1. **Dashboard** (Executive operational overview & courier breakdown)
2. **Customers** (360° Directory with unified lifetime history)
3. **Shipments** (Core booking engine, volumetric calculations, package manager & AWB tracking — *AWB belongs inside Shipments, no standalone AWB module*)
4. **Invoices** (GST-compliant tax invoices, payment settlement & WhatsApp dispatch)
5. **Accounts** (Financial control center: Collections, Prepaid Wallets, Postpaid Carrier Accounts)
6. **B2B / Credit** (Corporate accounts, credit limits, payment terms & 5-bucket aging)
7. **Refunds** (5-stage dispute & refund lifecycle with approval workflow)
8. **Follow-ups & Communications** (Unified customer retention, invoice collection, and automated reminders)
9. **Reports** (EOD Operations, Weekly Trends, Monthly Business P&L & Profit Reconciliation)
10. **Users & Permissions** (Staff directory, role assignments & registration approvals)
11. **Settings** (System parameters, centers, couriers, banks, UPI handles, payment modes, GST rates)

---

## 3. DASHBOARD

Keep the dashboard clean, simple, and uncluttered. Avoid visual noise and excessive cards.

### Core KPI Metrics
- **Today's Shipments** (Total count for today)
- **Today's Sales** (Total booked revenue for today in ₹)
- **Today's Collection** (Actual money collected today across all payment channels)
- **B2B Outstanding** (Total outstanding receivables across corporate accounts)
- **Follow-ups Due** (Pending follow-up actions due today)
- **Refunds Pending** (Refund requests awaiting Super Admin review/approval)

### Today's Shipments Summary
Display a concise inline courier distribution bar rather than individual large cards:
> **Example**:  
> *Today's Shipments: 16*  
> `FedEx: 9 | Aramex: 1 | Delhivery: 3 | Blue Dart: 2`

### Quick Actions
- `+ New Shipment` (Opens single-entry booking modal)
- `+ Customer` (Opens quick customer creation modal)
- `Create Invoice` (Quick invoice generation)
- `EOD Report` (Direct link to End-of-Day reconciliation audit)
- `Provider Reconciliation` (Direct link to carrier bill matching)

---

## 4. CUSTOMER 360° DIRECTORY

**Core Rule**: *One Customer = One Permanent Customer Profile*.

### Customer Profile Fields
- Customer Name
- Company Name (Optional for C2C/B2C, required for B2B)
- Mobile Number (Primary unique search index)
- WhatsApp Number
- Email Address
- Billing & Pickup Address
- ID Proof (Aadhaar / Passport / GSTIN / PAN / Voter ID)
- Customer Type:
  - **C2C** (Customer to Customer / Walk-in retail)
  - **B2C** (Business to Customer / E-commerce vendors)
  - **B2B** (Business to Business / Corporate credit accounts)
- Acquisition Source (Walk-in, Referral, Google, Social, Corporate)
- Center (Assigned branch / store location)
- Assigned Employee
- Registration / Created Date

### Customer 360° History (Auto-Aggregated)
- All associated Shipments & AWB numbers
- Receiver history & destination countries
- Carrier partners utilized
- Customer selling prices
- Payment transaction history & mode breakdown
- Tax invoices & outstanding balances
- Real-time delivery status & logged delay reasons
- Refund claims and resolutions
- Scheduled follow-ups & full communication logs

### Auto-Linking Feature
When staff inputs an existing customer's mobile number during shipment booking, the system immediately fetches and auto-populates the customer's permanent details and address.

---

## 5. B2B CORPORATE CREDIT & RECEIVABLES

B2B corporate clients have an extended commercial ledger profile.

### Corporate Profile Fields
- Company Name (e.g., "TLB", "Zenith Corp")
- Contact Person
- Mobile & Landline
- Official Email
- GSTIN
- Registered Billing Address
- Authorized Credit Limit (₹)
- Credit Period Terms (30 / 40 / 50 / 60 / 90 Days)
- Payment Terms & Notes

### Financial Receivables Flow
- Every shipment booked under a B2B account automatically registers as an active Account Receivable.
- Real-time financial aggregation:
  - Total Credit Sales
  - Total Collected to Date
  - Total Outstanding Balance
  - Amount Due This Week
  - Amount Overdue

### 5-Bucket Receivables Aging Schedule
1. **Not Due** (Within approved credit period)
2. **1 – 30 Days Overdue**
3. **31 – 60 Days Overdue**
4. **61 – 90 Days Overdue**
5. **90+ Days Overdue**

---

## 6. SHIPMENTS & SINGLE-ENTRY BOOKING ENGINE

**The Core Operational Module**. Every shipment has exactly one AWB. Searchable by: AWB, Customer Name, Mobile, or Invoice Number.

### New Shipment Form Specifications

#### A. Center & Staff
- Select Business Center / Branch
- Select Booking Employee who handled the transaction

#### B. Customer Auto-Fetch
- Existing vs. New Customer toggle
- Customer Type (`C2C`, `B2C`, `B2B`)
- Search by Mobile & Auto-fill sender profile

#### C. Sender Information
- Full Name, Mobile, Email, Full Address, ID Proof reference

#### D. Receiver Information
- Full Name, Mobile, Email
- Delivery Address, City, State, ZIP / Pincode, Destination Country

#### E. Parcel & Volumetric Weight Calculator
- Parcel Description & Content Type
- Number of Packages / Custom Boxes
- Dynamic Multi-box dimensions: Length (cm), Width (cm), Height (cm)
- Actual Physical Weight (kg)
- Volumetric Weight auto-calculation:
  $$\text{Volumetric Weight (kg)} = \frac{L \times W \times H}{5000} \quad (\text{Express}) \quad \text{or} \quad \frac{L \times W \times H}{4000} \quad (\text{Cargo})$$
- **Chargeable Weight Rule**:
  $$\text{Chargeable Weight} = \max(\text{Actual Weight}, \text{Volumetric Weight})$$

#### F. Courier Partner & Service
- FedEx, DHL, Aramex, UPS, Delhivery, Blue Dart, Sree Maruthi, Other
- Type: `Domestic` vs. `International`
- Service Level: Express, Standard, Economy, Cargo

#### G. Tracking, Dates & Statuses
- AWB / Tracking Number
- Booking Date, Pickup Date, Expected / Actual Delivery Date
- Lifecycle Statuses:
  - `Booked`
  - `Picked Up`
  - `In Transit`
  - `Delivered`
  - `Delayed`
  - `Cancelled`
- *Delay Reason*: Mandatory field whenever status is marked as `Delayed`.

---

## 7. CUSTOMER SELLING PRICE & PROFIT DYNAMICS

- **Customer Selling Price**: Gross amount billed to the customer (e.g., 5 KG parcel to USA = ₹5,500).
- **Payment Statuses**: `Paid`, `Partial`, `Unpaid`, `B2B Credit`.
- **Gross Profit Formula**:
  $$\text{Gross Profit} = \text{Customer Selling Price} - \text{Actual Provider Cost}$$
- Strict separation between customer selling price and carrier provider cost.

---

## 8. MULTI-CHANNEL CUSTOMER PAYMENT COLLECTIONS

Every customer payment collection captures:
- **Amount Received** (₹)
- **Payment Method**: Cash, PhonePe, Google Pay, UPI, Bank Transfer, QR, Other
- **Paid To (Destination Account)**:
  - Current Account
  - Savings Account
  - Office QR
  - Lata UPI
  - Other Employee UPI / Designated Bank Accounts
- **Collected By (Staff Handler)**:
  - Nawaz, Lata, Umesh, Uma, or designated staff member
- Automatic traceability: Feeds directly into daily EOD reconciliation and cashier accountability audits.

---

## 9. PROVIDER ACCOUNTS (DUAL ACCOUNTING MODEL)

Carrier partners operate under two distinct financial accounting models:

- Direct postpaid bookings must use the selected courier's configured billing account (for example, DHL maps to DHL Express). A DHL booking cannot use Blue Dart's postpaid account.
- Selecting or changing the courier automatically selects its matching direct account; if none exists, staff must select a configured prepaid wallet or configure the courier account before booking.
- Billing choices come from Settings. Configured prepaid wallets such as ICL and BRV remain available for wallet-funded bookings.
- The backend must reject mismatched postpaid accounts. Unbilled costs belong to the validated billing account.


### Model A: Prepaid Carrier Wallets (e.g., ICL, BRV)
- **Operational Flow**:
  $$\text{Company Bank Account} \xrightarrow{\text{Recharge}} \text{Provider Wallet} \xrightarrow{\text{Shipment Booking}} \text{Wallet Deduction}$$
- **Accounting Rule 1**: **A wallet recharge is NOT an expense**. It is an asset transfer: *Company Bank $\rightarrow$ Provider Wallet*.
- **Accounting Rule 2**: Provider cost occurs strictly when the wallet balance is debited upon shipment dispatch.
- **Wallet Ledger Data**:
  - Transaction Date
  - Transaction Type (`Recharge` vs. `Debit/Shipment`)
  - Amount Debited / Credited
  - Paid From (Bank / Mode)
  - AWB Number & Shipment ID link
  - Remaining Running Balance

### Model B: Postpaid / Deposit Accounts (e.g., Aramex, Blue Dart)
- **Operational Flow**:
  - Company places an initial Security Deposit (e.g., ₹2,00,000 with Aramex).
  - Shipments are booked against the courier credit account.
  - Fly My Cart logs a **Predicted Provider Cost** at the time of booking.
  - Courier generates a monthly statement/bill with actual billed weights and surcharges.
- **Account Tracking Metrics**:
  - Opening Security Deposit
  - Active Deposits Placed
  - Unbilled Shipment Usage (Accumulated predicted cost)
  - Provider Billed Amount
  - Payments Disbursed to Carrier
  - Net Outstanding Provider Payable
  - Statement Due Date

---

## 10. PREDICTED VS. ACTUAL PROVIDER COSTS & GROSS PROFIT

- For prepaid providers, actual cost is known immediately from the wallet deduction.
- For postpaid providers, shipments initially use the **Predicted Provider Cost**.
- When the carrier's monthly invoice arrives, the predicted cost is updated/reconciled with the **Actual Provider Cost**.
- Individual AWB Variance tracking:
  $$\text{Cost Variance} = \text{Actual Cost} - \text{Predicted Cost}$$
- System displays:
  - Total Predicted Cost
  - Total Actual Billed Cost
  - Total Variance (₹)
  - Corrected Final Gross Profit

---

## 11. PROVIDER BILL RECONCILIATION ENGINE

Located under **Accounts $\rightarrow$ Provider Accounts $\rightarrow$ Reconciliation**.

Super Admin can upload/input the monthly carrier statement. The engine automatically matches line items by AWB against internal shipment records:

### Matching Categories
1. **MATCHED**: AWB found, predicted cost matches actual bill within allowable tolerance.
2. **WRONG AMOUNT**: AWB found, but billed weight or charges differ from internal estimate.
3. **MISSING AWB**: AWB exists in CRM records for this carrier, but is absent from carrier's invoice.
4. **EXTRA AWB**: Courier billed for an AWB not found in the Fly My Cart database.
5. **DUPLICATE AWB**: Courier billed the same tracking number multiple times.
6. **UNMATCHED**: Data formatting or parsing issue requiring manual review.

**Reconciliation Outcome**: 1-click ledger commit updates actual costs retroactively, correcting monthly profit calculations.

---

## 12. ACCOUNTS & FINANCIAL CONTROL CENTER

Unified financial cockpit covering 4 key areas:
1. **Customer Sales & Collections**:
   - Total sales booked
   - Collections by channel: Cash, UPI (PhonePe, GPay), Bank NEFT/RTGS, Office QR
   - Collections categorized by handling employee
   - Pending collections & B2B credit sales
2. **Prepaid Provider Wallets**:
   - Opening balance, total recharges, total shipment deductions, current balance for ICL, BRV, etc.
3. **Postpaid Provider Accounts**:
   - Security deposits, predicted unbilled usage, finalized provider bills, payments made, outstanding liability.
4. **Reconciliation Summary**:
   - Expected cost vs. actual billed cost, variance breakdown, and audit log.

---

## 13. INVOICING & GST COMPLIANCE

- Seamlessly linked to Customer + Shipment.
- **Invoice Content**:
  - Official Tax Invoice Number & Date
  - Customer Name, GSTIN, and Billing Address
  - AWB Number, Courier Partner & Destination
  - Package description & Chargeable Weight
  - Taxable Amount, CGST, SGST, IGST calculation, Total Billed Amount
  - Amount Paid, Balance Due, Payment Status
- **Actions**:
  - Print-optimized view (`@media print` clean layout)
  - PDF Generation
  - 1-Click WhatsApp invoice dispatch with pre-filled message and tracking links
  - Email dispatch
- **Statuses**: `Paid`, `Partial`, `Due`, `Overdue`.

---

## 14. CUSTOMER REFUNDS & DISPUTES LIFECYCLE

- Dedicated dispute handling module:
  - Customer, AWB Number, Invoice Reference
  - Claimed Refund Amount (₹) & Justification / Reason
  - Requested By (Staff Member) & Request Date
  - Approved By (Super Admin Only) & Approval Date
  - Payout Date & Refund Payment Method
- **5-Stage Status Workflow**:
  $$\text{Requested} \rightarrow \text{Under Review} \rightarrow \text{Approved} \rightarrow \text{Processed} / \text{Refunded} \quad (\text{or } \text{Rejected})$$
- Automatically debited from gross revenue in financial reports upon approval.

---

## 15. FOLLOW-UPS & COMMUNICATIONS HUB

Unified retention and collection engine:

### Customer Retention Follow-ups
- Identifies inactive or returning customers based on last shipment date (5, 10, 15, 30 days, or custom interval).
- Direct outreach triggers: WhatsApp, Call, SMS, Email.

### Financial Payment Follow-ups
- **Retail Invoices**: Due Soon, Due Today, Overdue.
- **B2B Corporate Credit**: Due Date Approaching, Credit Term Overdue.

### Communication History Log
- Logs all interactions: Customer, Date & Time, Channel, Message / Campaign, Staff Handler, Delivery Status.

---

## 16. EXECUTIVE REPORTING & AUDIT ENGINE

Reports read directly from operational records without duplicate data tables.

### A. End-of-Day (EOD) Operations Report
- Total shipments booked today (Courier breakdown, Domestic vs. International, C2C vs. B2C vs. B2B).
- Sales breakdown: Cash, Paid Online, Credit Sales.
- Collection breakdown: Cash in register, PhonePe, GPay, Bank transfers, QR.
- Staff collection audit: Amounts collected by Nawaz, Lata, Umesh, Uma, and others.
- Prepaid wallet status: Opening, recharges, daily usage, closing balance.
- Postpaid usage: Aramex and Blue Dart daily bookings and predicted costs.
- Refunds requested vs. refunded today.

### B. Weekly Operational Report
- Sales, collections, provider logistics costs, and gross profit trends.
- Courier volume distribution and delivery performance.
- B2B credit aging status and overdue follow-ups.

### C. Monthly Business P&L Statement
$$\begin{aligned}
\text{Gross Revenue} &= \sum \text{Customer Sales} \\
\text{Total Direct Provider Cost} &= \text{ICL Actual} + \text{BRV Actual} + \text{Aramex Billed} + \text{Blue Dart Billed} + \text{Others} \\
\text{Gross Profit} &= \text{Gross Revenue} - \text{Total Direct Provider Cost} \\
\text{Net Profit} &= \text{Gross Profit} - \text{Approved Refunds} - \text{Operational Expenses}
\end{aligned}$$
- Displays side-by-side: **Predicted Profit**, **Actual Reconciled Profit**, and **Net Variance**.

---

## 17. SETTINGS & SYSTEM CONFIGURATION (SUPER ADMIN ONLY)

- Business Centers & Branches
- Employees & Staff Profiles
- Supported Courier Partners (FedEx, DHL, Aramex, UPS, Delhivery, Blue Dart, Sree Maruthi)
- Provider Accounts & Wallet configurations
- Company Bank Accounts & Employee UPI handles
- Payment Methods & Cashier Accounts
- Customer Categories & Tier Rules
- Invoice series numbering, Tax/GST rates & HSN codes
- Follow-up interval rules & message templates
- User credentials, access tokens & RBAC permissions

---

## 18. UI & UX DESIGN SYSTEM

- **Aesthetic**: Premium, responsive, modern dark/light balanced theme.
- **Ergonomics**: Search-first interface, minimal clicks, fast keyboard shortcuts.
- **Top Navigation Bar**: Global unified search box (`Search AWB / Customer / Mobile / Invoice`), Center & Role switcher.
- **Responsive Layout**: Fluid desktop control room and fully responsive mobile views.
- **No Clutter**: Avoid redundant information cards or duplicate views.

---

## 19. CORE ACCOUNTING PRINCIPLES (GOLDEN RULES)

1. **RULE 1**: ICL/BRV wallet recharge is an asset transfer, NOT a business expense.
2. **RULE 2**: Actual provider cost for prepaid couriers is recorded only when debited for a shipment.
3. **RULE 3**: Postpaid provider costs are initially estimated (predicted) and only finalized after invoice reconciliation.
4. **RULE 4**: Carrier bill reconciliation must match strictly AWB-by-AWB.
5. **RULE 5**: Customer selling price and provider cost must always remain distinct and independently auditable.
6. **RULE 6**: $\text{Gross Profit} = \text{Customer Sale} - \text{Actual Provider Cost}$.
7. **RULE 7**: B2B credit sales count towards booked revenue, but NOT towards customer cash collections until received.
8. **RULE 8**: Every collection must record both **Collected By** (employee) and **Paid To** (bank/UPI/cash drawer).
9. **RULE 9**: Every financial transaction must link back to an AWB/Shipment whenever applicable.
10. **RULE 10**: Enter once; all reports, profiles, ledgers, and analytics compute dynamically in real-time.
