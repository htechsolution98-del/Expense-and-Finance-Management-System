# PRD — Company Finance, Expense & Employee Management Portal

## 1. Product Overview

### Product Name
Company Finance, Expense & Employee Management Portal

### Product Type
Web-based internal management portal.

### Objective
Build a centralized portal to track every company financial movement:

- Money received
- Money paid
- Cash, bank, UPI and card transactions
- Office expenses
- Staff expenses
- Expense proofs and vouchers
- Staff advances
- Returnable amounts
- Loans received and their utilization
- Loan repayment
- Employee salary
- Employee bank-account verification
- Salary approval and payment status
- Salary slips
- Role-based access and approvals
- Audit trail and reports

The core objective is financial visibility and accountability:

> Where did the money come from, where did it go, why was it used, who used it, which payment account/mode was used, what proof exists, who approved it, and whether the money is recoverable?

---

# 2. Problem Statement

Companies often have payments spread across cash, multiple bank accounts, UPI, cards and employees. Expenses may be submitted through WhatsApp or verbally, bills may be lost, staff advances may not be tracked properly, and management may not know how borrowed money was utilized.

The system will centralize these activities and create a controlled workflow from transaction creation to verification, approval, payment and reporting.

---

# 3. Goals

## Primary Goals

1. Track all incoming money.
2. Track all outgoing money.
3. Maintain cash and bank balances.
4. Track payment mode and source account.
5. Record purpose of every transaction.
6. Attach bills, receipts and screenshots.
7. Generate vouchers for expenses/payments.
8. Manage staff expenses and advances.
9. Track returnable/recoverable money.
10. Track loans and utilization.
11. Manage employee salary.
12. Verify employee bank accounts.
13. Generate salary slips.
14. Provide approval workflows.
15. Provide role-based permissions.
16. Maintain a complete audit trail.
17. Provide management dashboards and reports.

## Non-Goals for MVP

- Full GST filing
- Full statutory accounting replacement
- Full payroll compliance engine
- Banking API auto-reconciliation
- Income-tax filing
- Inventory management

These can be added in future versions.

---

# 4. User Roles

## 4.1 Super Admin

Full system access.

Permissions:
- Manage all users
- Manage roles and permissions
- Manage company settings
- View all transactions
- Create/edit/delete master data
- Configure approval workflows
- Final approval
- Salary management
- Finance management
- Reports
- Audit logs

## 4.2 Admin

Management-level access.

Permissions:
- View dashboard
- View employees
- Approve configured transactions
- Final salary approval if authorized
- View finance reports
- View expenses
- View payments
- View loans
- View advances

Restricted:
- System-level configuration
- Role/permission administration unless granted

## 4.3 Accounts User

Finance/accounting operations.

Permissions:
- Payment In
- Payment Out
- Expense verification
- Expense approval if configured
- Cash management
- Bank management
- Voucher generation
- Salary processing
- Employee bank verification
- Reports
- Loan records
- Advances

## 4.4 Staff / Employee

Employee self-service portal.

Permissions:
- View own profile
- Add own expense
- Upload bill/receipt/screenshot
- View expense status
- Request advance
- View own advances
- Add/update bank account
- View salary
- Download salary slips
- View own payment history where permitted

Staff must not see other employees' private salary or financial information.

---

# 5. Core Modules

1. Authentication & Authorization
2. Dashboard
3. Payment In
4. Payment Out
5. Cash Management
6. Bank Account Management
7. Payment Accounts / Wallets
8. Office Expense Management
9. Staff Expense Management
10. Staff Advance Management
11. Receivable / Returnable Money
12. Loan Management
13. Loan Utilization
14. Employee Management
15. Employee Bank Account Verification
16. Salary Management
17. Salary Approval
18. Salary Payment
19. Salary Slip
20. Voucher Management
21. Document/Attachment Management
22. Approval Workflow
23. Notifications
24. Reports
25. Audit Logs
26. System Settings

---

# 6. Authentication

## Requirements

- Login with email/username and password
- Secure password hashing
- Forgot password
- Reset password
- Session management
- Logout
- Optional 2FA in future
- Role-based access control
- Account active/inactive status

## Security

- Passwords must never be stored in plain text.
- Sensitive information must be protected.
- API endpoints must validate authorization server-side.
- Users must only access permitted company data.

---

# 7. Company & Account Setup

Admin should be able to create/manage:

### Company
- Company name
- Logo
- Address
- GSTIN (optional)
- PAN (optional)
- Contact details
- Financial year
- Currency
- Time zone

### Financial Accounts

Examples:
- HDFC Bank
- SBI Bank
- ICICI Bank
- Office Cash
- Petty Cash
- UPI Account
- Company Card

Fields:
- Account name
- Account type
- Bank name
- Account number (masked in UI where appropriate)
- IFSC
- Opening balance
- Current balance
- Active/inactive

Account types:
- Cash
- Bank
- UPI
- Card
- Other

---

# 8. Payment In

Payment In records money received by the company.

## Sources

- Client
- Interest
- Loan
- Refund
- Other income
- Advance from customer
- Other

## Fields

- Transaction ID
- Date
- Received from
- Source type
- Amount
- Payment mode
- Received account
- Reference number
- Invoice/reference
- Purpose
- Attachment
- Notes
- Created by
- Verification status
- Approval status

## Example

Client pays ₹50,000 through bank.

System records:

- Source: Client
- Amount: ₹50,000
- Mode: Bank
- Account: HDFC Bank
- Purpose: Invoice payment
- Reference: UTR number
- Attachment: payment proof

Bank balance increases automatically.

---

# 9. Payment Out

Payment Out records money leaving the company.

## Categories

- Office expense
- Vendor payment
- Staff advance
- Staff reimbursement
- Loan repayment
- Asset purchase
- Client refund
- Other

## Fields

- Transaction ID
- Date
- Paid to
- Category
- Amount
- Purpose
- Payment mode
- Source account
- Reference number
- Bill/receipt
- Returnable flag
- Expected return date
- Notes
- Created by
- Verified by
- Approved by
- Status

## Example

₹10,000 paid to a vendor from HDFC Bank.

The HDFC balance decreases by ₹10,000.

---

# 10. Payment Modes

Supported modes:

- Cash
- Bank Transfer
- UPI
- Credit Card
- Debit Card
- Cheque
- Other

For card payments:
- Card name/account
- Last 4 digits
- Transaction/reference number
- Bill attachment

For UPI:
- UPI reference
- Screenshot attachment

For bank:
- Bank account
- UTR/reference

For cash:
- Cash account
- Cash voucher

---

# 11. Office Expense Management

Admin/Accounts can create office expenses.

## Expense Categories

Configurable master:

- Rent
- Electricity
- Internet
- Telephone
- Stationery
- Travel
- Petrol/Fuel
- Repairs & Maintenance
- Software
- Advertising
- Office Supplies
- Courier
- Tea/Refreshment
- Equipment
- Professional Fees
- Miscellaneous

## Expense Fields

- Expense ID
- Date
- Expense category
- Vendor/payee
- Amount
- Purpose
- Payment mode
- Paid from account
- Bill number
- Attachment
- Notes
- Created by
- Approval status

---

# 12. Staff Expense Management

Staff can submit business expenses from their portal.

## Staff Form

- Expense date
- Expense category
- Amount
- Purpose
- Payment mode
- Payment account/card
- Vendor/payee
- Bill/receipt
- UPI screenshot if applicable
- Card bill if applicable
- Other attachment
- Notes

## Workflow

Staff submits expense
→ Accounts verifies
→ Accounts approves/rejects or sends back
→ Authorized Admin gives final approval if required
→ Expense is recorded/paid/reimbursed
→ Staff sees final status

## Statuses

- Draft
- Submitted
- Under Review
- Approved
- Rejected
- Returned for Correction
- Paid
- Reimbursed
- Closed

---

# 13. Expense Proof & Attachment System

Every expense should support documents.

Allowed examples:
- PDF
- JPG
- JPEG
- PNG
- WEBP

Examples:
- UPI screenshot
- Card bill
- Invoice
- Cash receipt
- Travel ticket
- Vendor quotation

Requirements:
- Preview
- Download
- Upload timestamp
- Uploaded by
- Link attachment to transaction
- Prevent unauthorized access

File size/type limits should be configurable.

---

# 14. Voucher Management

Each approved financial expense/payment can generate a unique voucher.

## Voucher Number

Example:

`EXP-2026-000001`

Other prefixes:
- PAY-2026-000001
- REC-2026-000001
- ADV-2026-000001
- LOAN-2026-000001

## Voucher Content

- Company details
- Voucher number
- Date
- Payee
- Amount
- Expense category
- Purpose
- Payment mode
- Paid from
- Reference number
- Attachment reference
- Created by
- Verified by
- Approved by
- Signature/approval section

Actions:
- View
- Print
- Download PDF

---

# 15. Staff Advance

Staff may request or receive an advance.

## Advance Fields

- Advance ID
- Employee
- Date
- Amount
- Purpose
- Payment mode
- Paid from
- Expected settlement date
- Notes
- Approval status

## Settlement

Example:

Advance: ₹10,000
Actual expenses: ₹7,500
Balance to return: ₹2,500

System should automatically calculate:
- Advance amount
- Expense utilized
- Amount returned
- Remaining outstanding

Employee can upload expense proofs against the advance.

---

# 16. Returnable / Recoverable Money

For any outgoing payment, user can mark:

`Is Returnable? Yes/No`

If yes:

- Person/entity
- Amount
- Reason
- Expected return date
- Actual return date
- Returned amount
- Outstanding amount
- Status

Statuses:
- Pending Return
- Partially Returned
- Fully Returned
- Overdue

Dashboard should show overdue recoverables.

---

# 17. Loan Management

The system should track money borrowed by the company.

## Loan Master

- Loan ID
- Lender
- Loan amount
- Date received
- Interest rate
- Loan tenure
- Repayment frequency
- Start date
- Due date
- Purpose
- Receiving account
- Documents
- Notes

## Loan Utilization

Every use of loan money can be tagged to that loan.

Example:

Loan received: ₹5,00,000

Usage:
- Equipment: ₹1,50,000
- Stock: ₹1,00,000
- Office expense: ₹50,000
- Other: ₹50,000

System:
- Total loan
- Total utilized
- Remaining unallocated amount
- Repayment amount
- Outstanding principal
- Interest paid
- Next due date

## Loan Repayment

Fields:
- Repayment date
- Principal
- Interest
- Total payment
- Payment account
- Reference
- Proof
- Notes

---

# 18. Employee Management

Employee master fields:

- Employee ID
- Full name
- Profile photo
- Department
- Designation
- Joining date
- Employment status
- Mobile
- Email
- Address
- Emergency contact (optional)
- Salary structure
- Bank account
- Documents
- User account

Statuses:
- Active
- On Leave
- Inactive
- Resigned

---

# 19. Employee Bank Account

Employee can submit bank details from the portal.

Fields:
- Account holder name
- Bank name
- Account number
- IFSC
- Branch
- Account type
- Proof document

## Workflow

Employee submits bank details
→ Accounts verifies
→ Admin approval
→ Bank account becomes Verified

If employee changes bank details:
- Old account remains in history
- New account becomes Pending Verification
- Salary payment must not use an unverified account

---

# 20. Salary Management

## Salary Structure

Employee salary can include:

### Earnings
- Basic
- HRA
- Conveyance
- Special allowance
- Other allowance

### Deductions
- Advance recovery
- Leave/attendance deduction
- Other configured deduction

Future versions may support statutory deductions.

## Salary Generation

For each month:

- Select month
- Select employees
- Generate salary
- Calculate earnings
- Calculate deductions
- Calculate net salary
- Lock generated salary

Statuses:
- Draft
- Generated
- Under Review
- Approved
- Payment Pending
- Paid
- Cancelled

---

# 21. Salary Approval Workflow

Recommended workflow:

Salary Generated
→ Accounts Review
→ Admin Final Approval
→ Salary Payment
→ Mark Paid
→ Salary Slip Generated
→ Employee Portal Updated

Only authorized users can approve salary.

---

# 22. Salary Payment

Accounts selects approved salary.

Fields:
- Employee
- Salary month
- Net salary
- Payment date
- Payment mode
- Verified employee bank account
- Bank/UPI account
- UTR/reference
- Payment proof

After payment:
- Salary status = Paid
- Employee notified
- Salary slip becomes available

---

# 23. Salary Slip

System generates a PDF salary slip.

## Content

- Company logo/name
- Employee name
- Employee ID
- Designation
- Department
- Salary month
- Joining date
- Earnings
- Deductions
- Gross salary
- Net salary
- Payment date
- Payment status
- Authorized signature

Employee can:
- View
- Download
- Print

---

# 24. Approval Engine

Approval rules should be configurable.

Possible workflow:

### Staff Expense
Staff → Accounts → Admin

### Staff Advance
Staff → Accounts → Admin

### Bank Account Change
Employee → Accounts → Admin

### Salary
Accounts → Admin

### Payment Out
Creator → Accounts → Admin, depending on configured amount/transaction type

### High-Value Transactions

Admin can configure thresholds.

Example:
- Up to ₹5,000: Accounts approval
- ₹5,001–₹50,000: Accounts + Admin
- Above ₹50,000: Admin/Super Admin

Thresholds must be configurable.

---

# 25. Dashboard

## Admin Dashboard

Cards:
- Total Money In
- Total Money Out
- Cash Balance
- Bank Balance
- UPI Balance
- Card Payables/Usage
- Total Expenses
- Pending Expenses
- Pending Approvals
- Receivables
- Overdue Receivables
- Staff Advances
- Loan Outstanding
- Salary Payable
- Salary Paid

## Charts

- Money In vs Money Out
- Monthly Expenses
- Expense by Category
- Expense by Employee
- Cash vs Bank
- Loan Utilization
- Salary Paid vs Pending

## Alerts

- Overdue recoverable amount
- Pending expense approval
- Pending bank verification
- Pending salary approval
- Salary payment due
- Loan repayment due
- Unsettled staff advances

---

# 26. Reports

## Financial Reports

- Payment In
- Payment Out
- Cash Book
- Bank Book
- Account-wise Transactions
- Daily Cash Flow
- Monthly Cash Flow
- Expense Summary
- Expense Category Report
- Vendor Payment Report

## Employee Reports

- Employee Expense
- Staff Advance
- Advance Settlement
- Employee-wise Expense
- Pending Reimbursements

## Salary Reports

- Monthly Salary Register
- Employee Salary History
- Paid Salary
- Pending Salary
- Salary Deductions
- Salary Payment Report

## Loan Reports

- Loan Received
- Loan Utilization
- Loan Repayment
- Outstanding Loan
- Interest Paid

## Receivable Reports

- Returnable Money
- Pending Return
- Overdue Return
- Partial Return

All reports should support:
- Date filters
- Employee filters
- Category filters
- Account filters
- Payment mode filters
- Status filters
- Export to Excel/CSV
- PDF export where applicable

---

# 27. Notifications

Notifications should be generated for important events.

Examples:

### Staff
"Your expense EXP-000123 has been approved."

### Accounts
"5 expenses are pending verification."

### Admin
"Salary approval is pending for August 2026."

### Employee
"Your August 2026 salary has been paid."

### Admin
"₹25,000 recoverable amount is overdue."

Channels:
- In-app notification
- Email (future/configurable)
- WhatsApp/SMS integration (future)

---

# 28. Audit Log

Every important action must be logged.

Log:
- User
- Action
- Module
- Record ID
- Old value
- New value
- Date/time
- IP/device information where legally appropriate

Examples:
- Expense created
- Expense edited
- Expense approved
- Expense rejected
- Bank details changed
- Salary generated
- Salary approved
- Payment marked paid
- Loan updated

Audit logs should be read-only for normal users.

---

# 29. Search & Filters

Global search should support:
- Employee
- Vendor
- Client
- Voucher number
- Transaction ID
- Invoice/reference
- Loan ID
- Expense ID

Filters:
- Date range
- Amount
- Status
- Category
- Payment mode
- Account
- Employee
- Department

---

# 30. Master Data

Admin should manage:

- Expense categories
- Payment modes
- Accounts
- Departments
- Designations
- Employees
- Vendors
- Clients
- Loan sources
- Approval rules
- Salary components
- Voucher prefixes
- Notification settings

---

# 31. Data Relationships

Core entities:

- Company
- User
- Role
- Employee
- Department
- Account
- Client
- Vendor
- Transaction
- Payment In
- Payment Out
- Expense
- Expense Attachment
- Voucher
- Advance
- Advance Settlement
- Receivable
- Loan
- Loan Utilization
- Loan Repayment
- Salary
- Salary Component
- Employee Bank Account
- Approval
- Notification
- Audit Log

---

# 32. Suggested Database Structure

## users
- id
- employee_id
- name
- email
- password_hash
- role_id
- status
- created_at
- updated_at

## roles
- id
- name
- permissions

## employees
- id
- employee_code
- name
- department_id
- designation_id
- joining_date
- status
- salary_structure_id

## accounts
- id
- name
- type
- bank_name
- account_number
- ifsc
- opening_balance
- current_balance
- status

## transactions
- id
- transaction_no
- type
- date
- amount
- category
- source_account_id
- party_type
- party_id
- purpose
- payment_mode
- reference_no
- status
- created_by

## expenses
- id
- expense_no
- employee_id
- category_id
- amount
- date
- purpose
- payment_mode
- account_id
- status
- created_by

## attachments
- id
- module
- record_id
- file_name
- file_path
- uploaded_by
- uploaded_at

## vouchers
- id
- voucher_no
- transaction_id
- generated_at

## advances
- id
- employee_id
- amount
- purpose
- date
- account_id
- expected_settlement_date
- status

## loans
- id
- lender
- principal
- interest_rate
- received_date
- purpose
- receiving_account_id
- status

## loan_utilizations
- id
- loan_id
- transaction_id
- amount
- purpose
- date

## loan_repayments
- id
- loan_id
- principal
- interest
- total
- date
- account_id
- reference_no

## employee_bank_accounts
- id
- employee_id
- account_holder
- bank_name
- account_number
- ifsc
- proof_file
- verification_status
- verified_by
- verified_at

## salaries
- id
- employee_id
- salary_month
- gross_salary
- total_deductions
- net_salary
- status
- approved_by
- approved_at
- paid_at

## salary_components
- id
- salary_id
- component_name
- type
- amount

## approvals
- id
- module
- record_id
- approver_id
- action
- comments
- action_at

## audit_logs
- id
- user_id
- module
- record_id
- action
- old_data
- new_data
- created_at

---

# 33. Business Rules

1. Every financial transaction must have a purpose.
2. Every expense should have proof where applicable.
3. Every outgoing transaction must identify its source account.
4. Account balance must update after confirmed transactions.
5. Unapproved expenses must not be treated as final approved expenses.
6. Staff cannot approve their own expenses.
7. Employee bank-account changes require verification.
8. Salary can only be paid to an approved bank account unless an authorized alternative payment method is used.
9. Salary slip is generated after salary is finalized/paid according to configuration.
10. Returnable transactions must have expected return dates.
11. Overdue returnables must appear on dashboard.
12. Loan utilization must not exceed the available unallocated loan amount.
13. Approved/paid transactions should not be silently deleted; use reversal/cancellation with audit trail.
14. Audit logs must remain immutable for normal users.
15. Role permissions must be enforced at API level, not only in the UI.
16. Voucher numbers must be unique.
17. Salary records should be locked after final approval/payment except through authorized correction/reversal flow.
18. Every attachment must be linked to a specific record.
19. Staff can view only their own expenses, advances, salary and profile information.
20. Accounts/Admin can see financial information according to role permissions.

---

# 34. Key Workflows

## Workflow A — Client Payment

Client Payment
→ Create Payment In
→ Select Client
→ Enter Amount
→ Select Bank/Cash/UPI/Card
→ Select Receiving Account
→ Add Reference
→ Attach Proof
→ Save/Confirm
→ Account Balance Updated
→ Dashboard Updated

## Workflow B — Office Expense

Create Expense
→ Select Category
→ Enter Purpose
→ Enter Amount
→ Select Payment Mode
→ Select Account
→ Upload Bill
→ Submit
→ Accounts Verification
→ Admin Approval if required
→ Voucher Generated
→ Account Balance Updated

## Workflow C — Staff Expense

Staff Login
→ Add Expense
→ Upload Proof
→ Submit
→ Accounts Review
→ Approve/Reject/Return
→ Admin Approval if required
→ Reimbursement/Adjustment
→ Staff sees status

## Workflow D — Staff Advance

Staff Requests Advance
→ Accounts Review
→ Admin Approval
→ Payment
→ Advance Created
→ Staff Uploads Bills
→ Expense Adjusted
→ Remaining Amount Calculated
→ Return/Settlement
→ Advance Closed

## Workflow E — Loan

Loan Received
→ Record Loan
→ Money Added to Receiving Account
→ Tag Expenses/Payments to Loan
→ Loan Utilization Updated
→ Repayment Entry
→ Outstanding Updated

## Workflow F — Salary

Employee Bank Account Added
→ Accounts Verification
→ Admin Approval
→ Salary Generated
→ Accounts Review
→ Admin Final Approval
→ Salary Payment
→ UTR/Reference Added
→ Salary Status Paid
→ Salary Slip Generated
→ Employee Notified

---

# 35. UI Structure

## Sidebar

- Dashboard
- Transactions
  - Payment In
  - Payment Out
- Expenses
  - Office Expenses
  - Staff Expenses
  - My Expenses
- Accounts
  - Cash
  - Bank
  - UPI
  - Cards
- Advances
- Receivables
- Loans
- Employees
- Salary
- Vouchers
- Approvals
- Reports
- Notifications
- Audit Logs
- Settings

Sidebar items must be permission-based.

---

# 36. Staff Portal

Staff dashboard should show:

- My Expenses
- Pending Expenses
- Approved Expenses
- Reimbursed Expenses
- My Advance
- Advance Outstanding
- My Salary
- Salary Status
- Salary Slips
- Bank Account Status
- Notifications

Quick actions:
- Add Expense
- Request Advance
- Add Bank Account
- Download Salary Slip

---

# 37. Admin Dashboard Layout

Top cards:
- Money In
- Money Out
- Cash
- Bank
- Expenses
- Receivable
- Loan
- Salary

Middle:
- Cash Flow chart
- Expense chart
- Salary chart

Bottom:
- Pending Approvals
- Recent Transactions
- Overdue Recoverables
- Upcoming Loan Repayments
- Salary Payment Status

---

# 38. Technical Architecture Recommendation

## Frontend

Recommended:
- React.js / Next.js
- Responsive UI
- Desktop-first with mobile responsive staff portal

## Backend

Recommended:
- Node.js
- Express.js
- REST API

Alternative:
- FastAPI if Python stack is preferred

## Database

Recommended:
- PostgreSQL

## File Storage

- S3-compatible object storage
- Secure private file access
- Signed URLs for authorized downloads

## Authentication

- JWT/session-based authentication
- Refresh token strategy if JWT is used
- Role/permission middleware

## PDF

Use server-side PDF generation for:
- Expense vouchers
- Payment vouchers
- Salary slips
- Reports

---

# 39. API Module Structure

Example:

`/api/auth`

- POST /login
- POST /logout
- POST /forgot-password
- POST /reset-password

`/api/employees`

- GET /
- POST /
- GET /:id
- PUT /:id
- PATCH /:id/status

`/api/accounts`

- GET /
- POST /
- PUT /:id
- GET /:id/transactions

`/api/payment-in`

- GET /
- POST /
- GET /:id
- PUT /:id
- POST /:id/approve

`/api/payment-out`

- GET /
- POST /
- GET /:id
- PUT /:id
- POST /:id/approve

`/api/expenses`

- GET /
- POST /
- GET /:id
- PUT /:id
- POST /:id/submit
- POST /:id/approve
- POST /:id/reject

`/api/advances`

- GET /
- POST /
- POST /:id/settle

`/api/loans`

- GET /
- POST /
- GET /:id
- POST /:id/utilization
- POST /:id/repayment

`/api/salaries`

- GET /
- POST /generate
- POST /:id/approve
- POST /:id/pay
- GET /:id/slip

`/api/bank-accounts`

- POST /
- GET /
- POST /:id/verify
- POST /:id/reject

`/api/reports`

- GET /cash-flow
- GET /expenses
- GET /salary
- GET /loans
- GET /receivables

---

# 40. Notifications & Email

Notification templates should be configurable.

Events:
- Expense submitted
- Expense approved
- Expense rejected
- Expense returned for correction
- Advance approved
- Bank account submitted
- Bank account approved
- Salary approved
- Salary paid
- Salary slip generated
- Loan due
- Recoverable overdue

---

# 41. Security Requirements

1. HTTPS in production.
2. Password hashing using Argon2 or bcrypt.
3. Role-based authorization.
4. API authorization on every protected endpoint.
5. Input validation.
6. File upload validation.
7. Private document storage.
8. Audit logs.
9. Rate limiting for authentication APIs.
10. Secure session/token handling.
11. Sensitive account numbers masked in UI.
12. Database backups.
13. Restore testing.
14. Protection against SQL injection.
15. Protection against XSS/CSRF as applicable.
16. Secure error handling without leaking sensitive information.

---

# 42. MVP Scope

The first production version should include:

### Phase 1

- Login
- Roles
- Employees
- Accounts
- Payment In
- Payment Out
- Office Expenses
- Staff Expenses
- Attachments
- Approval workflow
- Vouchers
- Dashboard
- Basic reports
- Audit log

### Phase 2

- Staff advances
- Returnable money
- Loan management
- Loan utilization
- Employee bank verification
- Salary generation
- Salary approval
- Salary payment tracking
- Salary slips
- Notifications

### Phase 3

- Advanced reports
- Excel/PDF exports
- Automated reminders
- Email/WhatsApp/SMS
- Bank integrations
- Accounting software integration
- Mobile/PWA improvements

---

# 43. Acceptance Criteria

## Payment In

- User can record received payment.
- User must select source/type and receiving account.
- Balance updates correctly.
- Reference and proof can be attached.

## Payment Out

- User must specify payee, purpose, amount and payment source.
- Account balance decreases only after confirmed transaction.
- Voucher can be generated.

## Expense

- Staff can submit expenses.
- Staff can attach UPI/card/bill proof.
- Accounts can verify.
- Authorized admin can approve.
- Staff can see status.

## Salary

- Employee bank account can be submitted.
- Accounts can verify it.
- Admin can approve it.
- Salary can be generated.
- Salary can be approved.
- Payment can be recorded.
- Salary status changes to Paid.
- Salary slip becomes downloadable.

## Loan

- Loan can be recorded.
- Loan money can be linked to utilization transactions.
- Utilization and remaining amount are calculated.
- Repayments update outstanding balance.

## Audit

- Important create/update/approve/pay actions are logged.
- Normal users cannot delete audit records.

---

# 44. Future Enhancements

- Tally integration
- GST integration
- Bank statement import
- Automatic bank reconciliation
- OCR bill scanning
- WhatsApp expense submission
- AI-based expense categorization
- Face/biometric attendance integration
- Payroll statutory compliance
- Multi-company support
- Multi-currency
- Budget management
- Department-wise budgets
- Expense limits
- Corporate card integration
- Mobile application
- Approval via WhatsApp/email
- Advanced analytics

---

# 45. Product Success Metrics

Track:

- % expenses with valid proof
- Average expense approval time
- Number of overdue recoverables
- Staff advance settlement time
- Salary payment completion rate
- Number of unapproved transactions
- Monthly expense visibility
- Number of manual/off-system transactions
- Loan utilization visibility
- Voucher generation rate

---

# 46. Final Product Vision

The portal should become the company's central internal system for financial accountability.

Every rupee should have a traceable journey:

**Source → Account → Transaction → Purpose → Person/Vendor → Proof → Approval → Payment → Settlement/Return → Report**

For employees:

**Employee → Expense/Advance → Proof → Accounts Verification → Admin Approval → Payment/Adjustment → Status**

For salary:

**Employee → Bank Account Submission → Account Verification → Admin Approval → Salary Generation → Salary Approval → Payment → Salary Slip → Employee Portal**

The final system should provide management with a single reliable answer to:

> "Company ka paisa kahan se aaya, kahan gaya, kisliye gaya, kisne use kiya, kis account se gaya, proof kya hai, kisne approve kiya, aur kitna paisa abhi receive/pay/return hona baaki hai?"

