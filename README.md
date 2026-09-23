# Fly My Cart CRM

**Customer, shipment and financial management for courier businesses.**

Fly My Cart CRM brings domestic and international courier operations into one application. It connects customer profiles, shipment bookings, invoices, payment collections, carrier costs and business reporting, giving front-desk teams, operations staff and management a shared view of daily work.

The application is built around a connected booking workflow: record a shipment, link it to the customer, generate its invoice and manage the associated collections and courier costs. Staff can work within their assigned responsibilities while administrators control access to business records and financial information.

## Contents

- [Application Overview](#application-overview)
- [Dashboard and Business Visibility](#dashboard-and-business-visibility)
- [Customer Management](#customer-management)
- [Shipment Operations](#shipment-operations)
- [Invoicing and Customer Payments](#invoicing-and-customer-payments)
- [Accounts and Financial Management](#accounts-and-financial-management)
- [Carrier Bill Reconciliation](#carrier-bill-reconciliation)
- [B2B Accounts and Credit Management](#b2b-accounts-and-credit-management)
- [Refund Management](#refund-management)
- [Follow-ups and Communication History](#follow-ups-and-communication-history)
- [Business Reports](#business-reports)
- [Staff Attendance](#staff-attendance)
- [Users, Roles and Permissions](#users-roles-and-permissions)
- [Business Configuration](#business-configuration)
- [Everyday User Experience](#everyday-user-experience)
- [Connected Business Workflows](#connected-business-workflows)

## Application Overview

Fly My Cart CRM supports individual walk-in customers, business customers and corporate credit accounts. Its workspace covers both the operational and financial sides of a courier booking.

| Business area | Capabilities |
| --- | --- |
| Customer relationships | Customer profiles, contact information, documents, booking history and follow-ups |
| Courier operations | Domestic and international bookings, package details, weight calculations, AWB records and shipment status |
| Billing and collections | Shipment invoices, GST details, partial payments, payment references and outstanding balances |
| Carrier accounting | Prepaid wallets, postpaid provider accounts, courier payments and carrier bill reconciliation |
| Business finance | Expenses, account transfers, collection checks and financial reporting |
| Workforce administration | Attendance records, staff accounts, assigned centers and individual access controls |

## Dashboard and Business Visibility

The dashboard provides an overview of current booking activity and the business records that need attention.

- View today's shipment count, sales and payment collections.
- Review outstanding corporate balances, pending refunds and due follow-ups.
- See active shipment volumes and courier-level activity.
- Compare daily booking trends across two calendar weeks.
- Review sales, collections, recorded courier costs and value after courier costs, subject to financial permissions.
- View prepaid wallet and postpaid provider summaries.
- Browse recent bookings with date filters and pagination.
- Open customer profiles, update shipment status and access common booking actions.
- Select a business center to review supported center-specific views.

Charts and summary cards help staff identify workload, pending collections and operational priorities without opening each module separately.

## Customer Management

### Customer Directory

Maintain a customer profile that can be reused across bookings. The directory includes C2C, B2C and B2B customer categories and supports additional types configured in Settings and includes customer names, company information, mobile numbers, email addresses, addresses and center details.

Staff can search by name, mobile number, company or email, filter by customer type, browse records in pages and export the directory. Booking counts and customer spending are available according to the user's permissions.

### Customer Profile and History

The customer profile brings related records together for service and account review:

- Contact and business details.
- Shipment history and booking activity.
- Linked invoices, payments and outstanding amounts.
- Follow-up and communication records.
- Available customer documents and authorized document downloads.

This gives staff the context needed to answer shipment queries, review unpaid invoices and continue earlier customer conversations.

## Shipment Operations

### Booking Details

Create domestic or international bookings with the information needed to manage each shipment:

- A unique air waybill (AWB) number.
- Booking, pickup and delivery dates.
- Customer, sender and receiver information.
- Destination city, country and address details.
- Assigned center and employee.
- Courier, service type and prepaid or postpaid provider selection.
- Package description, box details and shipment weights.
- Customer selling price, applicable GST and recorded provider cost, where permitted.
- Customer payment status, payment method and collection details.

An existing customer can be identified during booking, keeping subsequent shipments connected to the same profile.

### Package and Weight Calculations

The booking form supports multiple boxes and actual, volumetric and chargeable weights. Dimensions can be entered in centimetres or inches, with inches converted for calculation.

Configurable weight rules include the volumetric divisor, the chargeable-weight basis, minimum billable weight and rounding increments. Rules can apply to the shipment as a whole or to individual boxes, with overrides for courier, service and destination criteria.

### Shipment Directory and Status

Search shipments by AWB, customer, receiver information, phone numbers or linked invoice number. Filter by courier, shipment status and provider billing type, and export shipment records.

Supported status choices include Booked, Picked Up, In Transit, Delivered, Delayed and Cancelled. Authorized staff can record status changes and delay information. Tracking links open supported couriers' tracking pages for further investigation.

## Invoicing and Customer Payments

### Invoice Management

Bookings generate linked invoice records containing customer, shipment and billing information. The invoice workspace supports:

- Invoice numbers, dates, AWBs and courier details.
- Base amounts, applicable GST and invoice totals.
- Paid amounts, remaining balances and payment status.
- Search by invoice number, customer or AWB.
- Payment-status filters and paginated browsing.
- Invoice previews, printing and directory exports.
- Business contact details and configurable invoice branding.

### Collections and Settlement

Record full or partial payments against an invoice and retain the outstanding balance for follow-up. Payment records capture the selected method and relevant account or reference details.

Available payment methods include cash, UPI, PhonePe, Google Pay, Office QR, bank transfer, cheque, card and other configured methods. Forms request the details required for the selected method.

Payment retry protection helps prevent duplicate financial entries when a supported submission is retried after an interrupted request.

## Accounts and Financial Management

The Accounts workspace connects shipment revenue, customer collections, courier costs and operating expenses. Date ranges, center selection and ledger filters support period-based review.

### Shipment Accounts

Review sales excluding and including GST, recorded courier costs, expenses, collected amounts, pending customer payments and B2B outstanding balances. The shipment ledger connects these figures to individual bookings and includes customer collection and courier payment status.

Authorized users can filter the ledger by shipment details, courier, account, status and date, inspect individual records and export the matching results.

### Customer Collections and Account Checks

Review receipts with their payment method, receiving account, collector and reference details. Account checks compare expected collections with counted amounts and record shortages or overages, notes and the person completing the check.

### Prepaid Wallets and Postpaid Couriers

Manage prepaid provider wallets and recharge entries, alongside postpaid courier accounts, provider payments and deposits. Courier costs and payments remain connected to the financial workspace for reconciliation and review.

### Expenses, Payment Accounts and Transfers

Record operating expenses with categories, dates, amounts, payment details and remarks. Expense records can include uploaded bill attachments for later download and review.

The workspace also supports saved payment-account details, account transfers and transaction histories. Expense categories can be customized to reflect the business's operating costs.

### Financial Definitions

The application distinguishes sales from collections and business expenses from movements between accounts.

| Measure | Meaning |
| --- | --- |
| Sales excluding GST | Recorded customer selling amounts before GST |
| Sales including GST | Total billed amounts including applicable GST |
| Amount collected | Recorded customer payments received |
| Outstanding balance | Invoice amounts that remain unpaid |
| Value after courier cost | Sales less recorded courier costs |
| Net value | Value after courier costs, operating expenses and applicable refund adjustments |

GST-inclusive value views include sales GST before settlement. Recorded account movements represent entries in the CRM; they are not a direct bank-feed verification of available balances.

## Carrier Bill Reconciliation

Reconciliation compares a courier's bill with shipment costs recorded in the CRM.

1. Select the relevant provider account.
2. Upload the carrier bill.
3. Review the detected AWB and cost columns.
4. Inspect matched shipments, differences and entries requiring attention.
5. Apply reviewed costs to the corresponding shipment records.

Supported inputs include Excel workbooks, CSV, TSV, TXT and searchable table PDFs. The importer recognizes common carrier bill layouts, including Aramex, Blue Dart, Delhivery, DHL/BRV and FedEx/ICL formats.

Duplicate AWBs, invalid amounts and unmatched shipments are surfaced for review. Imported final totals are used without adding GST or surcharges a second time. Reconciliation batches provide a record of the reviewed imports.

Scanned bill images require text extraction before import. Recording a carrier bill updates provider costs; customer payments are recorded separately.

## B2B Accounts and Credit Management

Manage corporate customers who operate on agreed credit terms.

- Create corporate accounts with customer and company details.
- Set credit limits and payment periods.
- Review total credit sales, collections and outstanding balances.
- Monitor credit utilization and balances exceeding the configured limit.
- Identify amounts due during the current week and overdue accounts.
- Open related customer profiles for transaction history.
- Refresh account summaries and export corporate account records.

Aging summaries group receivables into not due, 1-30 days, 31-60 days, 61-90 days and more than 90 days overdue, helping the team prioritize collection follow-ups.

## Refund Management

Record refund requests with the customer, shipment reference, amount and reason. Staff can search and filter the refund register, review request status and export records.

Authorized users manage approval, rejection and payout steps. Completed payouts retain payment details for review. Refund adjustments are reflected in the applicable financial calculations without treating the approval and payout as two separate profit deductions.

## Follow-ups and Communication History

Schedule customer tasks with a due date, category, priority and notes. The workspace groups follow-ups into due today, overdue, upcoming and completed tasks so staff can focus on the next action.

Users can search tasks, mark completed work, open customer communication actions and export follow-up records. Communication entries preserve the context of customer interactions. Sharing links and recorded communication activity do not by themselves confirm delivery by an external messaging service.

## Business Reports

Reports use recorded operational and financial activity to support daily review and management decisions. Access to report types and financial values follows the user's assigned permissions.

| Report | Purpose |
| --- | --- |
| End-of-day operations | Review a selected day's bookings, collections and related operational or financial activity |
| Weekly operations | Review activity and trends across a weekly period |
| Custom date range | Inspect business activity between selected dates |
| Monthly business P&L | Review sales, courier costs, expenses, refunds and resulting business value for a selected month |

Reports include supporting summaries, tables and charts, with printing available to authorized users. Business calendar dates use Indian Standard Time for consistent daily and period-based reporting.

## Staff Attendance

The Attendance workspace records staff working activity and provides daily and period-based summaries.

- Record login and logout punches.
- Record lunch start/end and break start/end events.
- Review the current shift state and attendance event history.
- Inspect working time and late-attendance summaries.
- Filter by today, week, month or a custom date range.
- Review individual staff members or all staff where permitted.
- Configure expected login/logout times, required working hours and the grace period.

Personal attendance actions and staff-wide management are controlled through separate permissions.

## Users, Roles and Permissions

### Staff Administration

Administrators can review staff registrations, approve or reject access requests, suspend or reactivate accounts and manage role and center assignments.

### Role and Individual Access

Access can be configured at the role level and adjusted for an individual staff member. Controls cover module visibility and permitted actions, such as viewing, adding, editing, deleting, exporting or approving records where supported.

Financial access is controlled separately for customer sale prices, carrier costs and net-value or financial-report information. The access editor presents permission groups, individual overrides and options to restore role defaults.

Explicit individual denials take precedence over role defaults. Some administrative and financial actions remain restricted to Super Admin.

### Activity and Session Controls

Recorded staff activity can be reviewed through audit-history views. Permission and center changes revoke affected sessions so updated access takes effect when the user signs in again.

## Business Configuration

Business settings let administrators adapt the application to the courier office's operating requirements.

| Configuration area | Available settings |
| --- | --- |
| Business identity | Company name, address, GSTIN, phone and email used in invoice presentation |
| Invoice defaults | Invoice-number prefix, default GST rate and selectable GST rates |
| Customer types | Add customer categories for registration, shipment bookings, directory filters and counts |
| Courier services | Courier names, logos and service types |
| Centers and employees | Business centers and employee choices used in operational records |
| Payment methods and accounts | Enabled payment methods, receiving accounts and reusable account details |
| Provider accounts | Prepaid wallets, opening balances, postpaid providers, deposits and payment terms |
| Weight calculation | Volumetric divisors, calculation basis, minimum weights, rounding and matching overrides |
| Corporate credit | Default credit limits and payment periods for new B2B accounts |
| Attendance | Expected working times, daily hours and grace periods |

Changes to billing and credit defaults apply to new records; existing invoice amounts, invoice numbers and saved client credit terms are preserved.

## Everyday User Experience

The interface supports everyday use across desktop and mobile layouts, with a consistent sidebar, center selection and shared navigation.

- Global search helps locate supported customer, shipment and invoice records.
- Customer, shipment and invoice directories show 50 rows per page while keeping later records accessible.
- Customer and shipment searches filter loaded records without a new request for every keystroke.
- Screens and forms load when opened to reduce initial loading work.
- Page loaders, table placeholders and button spinners provide feedback during longer actions.
- An app-wide activity indicator covers API requests, including file uploads and downloads.
- Failed loads and supported operations provide error messages or retry options.
- Exports and printed views are available from supported modules, subject to permissions.

## Connected Business Workflows

### From Booking to Collection

Select or create a customer, enter the shipment details and save the booking. Review the linked invoice, record an initial or later payment and track the remaining balance. Staff can return to the customer profile for the shipment and billing history.

### From Courier Bill to Cost Review

Record the expected courier cost during booking, import the carrier's bill when received and review any differences. Apply confirmed costs, record the provider payment and review the resulting shipment and financial summaries.

### From Outstanding Balance to Follow-up

Identify unpaid invoices or aging corporate balances, inspect the customer's history and schedule a follow-up. Record the next collection against the invoice and review the updated balance.

### Daily Office Review

Review attendance and booking activity, check customer collections, record expenses and account checks, and inspect the end-of-day report. Management can use weekly, monthly or custom-period reports for a broader view of the business.
