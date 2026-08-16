# Architecture — Company Finance, Expense & Employee Management Portal

## 1. Document Overview

### Product
Company Finance, Expense & Employee Management Portal

### Backend Stack
- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- REST API
- JWT + Refresh Token authentication
- Redis (optional for caching, queues and rate limiting)
- S3-compatible object storage for documents
- BullMQ (optional for background jobs)
- PDF generation service/library
- Winston/Pino for structured logging

### Frontend
The backend is designed to support:
- React.js / Next.js web application
- Responsive employee portal
- Future mobile/PWA application

---

# 2. Architecture Goals

The backend must provide:

1. Secure role-based access.
2. Strong financial transaction consistency.
3. Complete auditability.
4. Approval workflows.
5. Employee self-service.
6. Secure document handling.
7. Accurate account balances.
8. Salary and payment tracking.
9. Loan utilization tracking.
10. Scalable reporting.
11. Clear separation between business logic and HTTP controllers.
12. Easy future integration with Tally, banks, WhatsApp and other systems.

---

# 3. High-Level Architecture

```text
                         CLIENT APPLICATIONS
                    ┌─────────────────────────┐
                    │ React / Next.js Web App │
                    │ Employee Portal         │
                    │ Future Mobile/PWA       │
                    └────────────┬────────────┘
                                 │ HTTPS
                                 ▼
                         ┌─────────────────┐
                         │ Reverse Proxy   │
                         │ Nginx / Cloud   │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌────────────────────────┐
                    │ Node.js + Express.js   │
                    │ REST API                │
                    └────────────┬───────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ Auth/RBAC    │      │ Business     │      │ Reporting    │
   │ Middleware   │      │ Services     │      │ Services     │
   └──────────────┘      └──────┬───────┘      └──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌────────────┐
              │ Prisma   │ │ Storage  │ │ Redis /    │
              │ ORM      │ │ S3       │ │ Queue      │
              └────┬─────┘ └──────────┘ └────────────┘
                   │
                   ▼
             ┌────────────┐
             │ PostgreSQL │
             └────────────┘
```

---

# 4. Architectural Style

Use a modular layered architecture.

```text
Request
  ↓
Route
  ↓
Authentication Middleware
  ↓
Authorization Middleware
  ↓
Validation Middleware
  ↓
Controller
  ↓
Service
  ↓
Repository / Prisma
  ↓
PostgreSQL
```

Supporting services:

```text
Service
 ├── Notification Service
 ├── File Storage Service
 ├── Voucher Service
 ├── PDF Service
 ├── Audit Service
 ├── Approval Service
 └── Transaction/Accounting Service
```

Business rules must not be placed directly inside Express route files.

---

# 5. Recommended Project Structure

```text
backend/
│
├── src/
│   │
│   ├── app.js
│   ├── server.js
│   │
│   ├── config/
│   │   ├── env.js
│   │   ├── database.js
│   │   ├── storage.js
│   │   ├── redis.js
│   │   └── logger.js
│   │
│   ├── routes/
│   │   ├── index.js
│   │   ├── auth.routes.js
│   │   ├── users.routes.js
│   │   ├── employees.routes.js
│   │   ├── accounts.routes.js
│   │   ├── paymentIn.routes.js
│   │   ├── paymentOut.routes.js
│   │   ├── expenses.routes.js
│   │   ├── advances.routes.js
│   │   ├── receivables.routes.js
│   │   ├── loans.routes.js
│   │   ├── salaries.routes.js
│   │   ├── bankAccounts.routes.js
│   │   ├── vouchers.routes.js
│   │   ├── approvals.routes.js
│   │   ├── reports.routes.js
│   │   ├── notifications.routes.js
│   │   ├── attachments.routes.js
│   │   └── auditLogs.routes.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── employee.controller.js
│   │   ├── account.controller.js
│   │   ├── paymentIn.controller.js
│   │   ├── paymentOut.controller.js
│   │   ├── expense.controller.js
│   │   ├── advance.controller.js
│   │   ├── receivable.controller.js
│   │   ├── loan.controller.js
│   │   ├── salary.controller.js
│   │   ├── bankAccount.controller.js
│   │   ├── voucher.controller.js
│   │   ├── approval.controller.js
│   │   ├── report.controller.js
│   │   └── notification.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── employee.service.js
│   │   ├── account.service.js
│   │   ├── transaction.service.js
│   │   ├── paymentIn.service.js
│   │   ├── paymentOut.service.js
│   │   ├── expense.service.js
│   │   ├── advance.service.js
│   │   ├── receivable.service.js
│   │   ├── loan.service.js
│   │   ├── salary.service.js
│   │   ├── bankAccount.service.js
│   │   ├── approval.service.js
│   │   ├── voucher.service.js
│   │   ├── attachment.service.js
│   │   ├── notification.service.js
│   │   ├── audit.service.js
│   │   └── report.service.js
│   │
│   ├── repositories/
│   │   ├── user.repository.js
│   │   ├── employee.repository.js
│   │   ├── account.repository.js
│   │   ├── transaction.repository.js
│   │   ├── expense.repository.js
│   │   ├── advance.repository.js
│   │   ├── loan.repository.js
│   │   ├── salary.repository.js
│   │   └── approval.repository.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── permission.middleware.js
│   │   ├── validation.middleware.js
│   │   ├── upload.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   ├── error.middleware.js
│   │   └── requestId.middleware.js
│   │
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── employee.validator.js
│   │   ├── account.validator.js
│   │   ├── transaction.validator.js
│   │   ├── expense.validator.js
│   │   ├── advance.validator.js
│   │   ├── loan.validator.js
│   │   ├── salary.validator.js
│   │   └── bankAccount.validator.js
│   │
│   ├── utils/
│   │   ├── apiResponse.js
│   │   ├── pagination.js
│   │   ├── amount.js
│   │   ├── dates.js
│   │   ├── voucherNumber.js
│   │   └── crypto.js
│   │
│   ├── constants/
│   │   ├── roles.js
│   │   ├── permissions.js
│   │   ├── statuses.js
│   │   ├── paymentModes.js
│   │   └── transactionTypes.js
│   │
│   └── jobs/
│       ├── salarySlip.job.js
│       ├── notification.job.js
│       ├── reminder.job.js
│       └── report.job.js
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── uploads/
│   └── .gitkeep
│
├── .env.example
├── package.json
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# 6. Express Application Setup

`app.js` responsibilities:

1. Create Express app.
2. Configure security middleware.
3. Configure CORS.
4. Configure JSON/body limits.
5. Add request ID.
6. Register routes.
7. Register health endpoint.
8. Register 404 handler.
9. Register global error handler.

Recommended middleware order:

```text
Helmet
↓
CORS
↓
Request ID
↓
Body Parser
↓
Logger
↓
Rate Limiting
↓
Routes
↓
404 Handler
↓
Global Error Handler
```

---

# 7. API Versioning

Use:

```text
/api/v1
```

Example:

```text
GET /api/v1/employees
POST /api/v1/expenses
GET /api/v1/expenses/:id
POST /api/v1/salaries/generate
```

Future breaking API changes can use:

```text
/api/v2
```

---

# 8. Authentication Architecture

Recommended flow:

```text
Login
 ↓
Validate credentials
 ↓
Generate access token
 ↓
Generate refresh token
 ↓
Return authentication response
```

Access token:
- Short lifetime
- Used for API requests

Refresh token:
- Longer lifetime
- Used to obtain a new access token
- Store securely
- Support revocation

Recommended payload:

```json
{
  "sub": "user-id",
  "companyId": "company-id",
  "role": "ACCOUNT",
  "permissions": []
}
```

Do not put sensitive data into JWT payloads.

---

# 9. Authorization / RBAC

Permissions should be granular.

Example:

```text
payment_in.view
payment_in.create
payment_in.edit
payment_in.approve

payment_out.view
payment_out.create
payment_out.approve

expense.view
expense.create
expense.edit
expense.submit
expense.verify
expense.approve
expense.reject

salary.view
salary.generate
salary.approve
salary.pay

bank_account.view
bank_account.create
bank_account.verify
bank_account.reject

loan.view
loan.create
loan.utilize
loan.repay
```

Middleware:

```text
authenticate()
authorize("expense.approve")
```

Authorization must always happen server-side.

---

# 10. Multi-Company Readiness

Even if the first release supports one company, database records should be designed with:

```text
company_id
```

This makes future multi-company support easier.

Every company-owned record should be scoped by `company_id`.

Example:

```text
employees.company_id
accounts.company_id
transactions.company_id
expenses.company_id
loans.company_id
salaries.company_id
```

A user must never be able to access another company's records by changing an ID in the API request.

---

# 11. Database Architecture

## PostgreSQL

PostgreSQL is recommended because the system has:

- Financial transactions
- Relationships
- Approval workflows
- Audit logs
- Salary records
- Strong consistency requirements
- Reporting queries

Use Prisma ORM for:
- Schema management
- Type-safe database access
- Migrations
- Transactions

---

# 12. Financial Data Rules

Never use JavaScript floating-point numbers for financial calculations.

Recommended database type:

```text
DECIMAL(18,2)
```

or an equivalent exact numeric type.

Example:

```text
amount DECIMAL(18,2)
```

In JavaScript, use a decimal-safe library/type for calculations.

Never calculate money using:

```js
0.1 + 0.2
```

for financial balances without decimal-safe handling.

---

# 13. Financial Transaction Ledger

A central transaction ledger is recommended.

Instead of updating balances independently in multiple modules, all confirmed financial movements should create a transaction record.

Example:

```text
Payment In
      ↓
Transaction Ledger
      ↓
Account Balance

Payment Out
      ↓
Transaction Ledger
      ↓
Account Balance
```

This creates a reliable audit trail.

---

# 14. Transaction Types

Example enum:

```text
PAYMENT_IN
PAYMENT_OUT
EXPENSE
STAFF_ADVANCE
ADVANCE_SETTLEMENT
SALARY_PAYMENT
LOAN_RECEIVED
LOAN_REPAYMENT
RECEIVABLE_RETURN
REFUND
TRANSFER
ADJUSTMENT
```

---

# 15. Account Balance Strategy

Recommended approach:

### Source of truth
Confirmed transaction ledger.

### Cached current balance
`accounts.current_balance` may be maintained for fast dashboard access.

Every balance-changing operation must run inside a database transaction:

```text
BEGIN
 ↓
Validate transaction
 ↓
Create ledger entry
 ↓
Update account balance
 ↓
Create voucher
 ↓
Create audit log
 ↓
COMMIT
```

If any step fails:

```text
ROLLBACK
```

This prevents money and ledger data from becoming inconsistent.

---

# 16. Account Transfer

For transfers between company accounts:

Example:

```text
HDFC Bank → Office Cash
₹20,000
```

Do not treat this as income or expense.

Create a transfer transaction:

```text
Source: HDFC
Destination: Cash
Amount: ₹20,000
```

Balances:

```text
HDFC -₹20,000
Cash +₹20,000
```

Net company balance remains unchanged.

---

# 17. Payment In Architecture

Flow:

```text
POST /payment-in
       ↓
Authentication
       ↓
Permission Check
       ↓
Validation
       ↓
Payment In Service
       ↓
Database Transaction
       ├── Payment In Record
       ├── Ledger Entry
       ├── Account Balance Update
       ├── Attachment Link
       ├── Voucher
       └── Audit Log
       ↓
COMMIT
       ↓
Response
```

---

# 18. Payment Out Architecture

Flow:

```text
Create Payment Out
       ↓
Validate account balance
       ↓
Validate purpose/payee
       ↓
Approval if required
       ↓
Confirm payment
       ↓
Database Transaction
       ├── Payment Out
       ├── Ledger
       ├── Balance Update
       ├── Voucher
       └── Audit Log
       ↓
COMMIT
```

For approval-based payments, do not reduce the real account balance until the transaction is confirmed/paid.

---

# 19. Expense Architecture

Expense has separate lifecycle from actual payment.

```text
DRAFT
  ↓
SUBMITTED
  ↓
UNDER_REVIEW
  ├── RETURNED
  └── REJECTED
  ↓
APPROVED
  ↓
PAID / REIMBURSED
  ↓
CLOSED
```

Important:

`Approved Expense` does not necessarily mean `Paid Expense`.

This distinction is required for accurate reporting.

---

# 20. Staff Expense Reimbursement

Example:

Staff spends ₹1,500 personally.

```text
Staff Expense
     ↓
Submit proof
     ↓
Accounts verifies
     ↓
Admin approval
     ↓
Reimbursement payment
     ↓
Payment Out
     ↓
Staff Expense marked Reimbursed
```

The reimbursement should create a linked Payment Out transaction.

---

# 21. Staff Advance Architecture

```text
Advance Request
      ↓
Approval
      ↓
Payment Out
      ↓
Advance Balance
      ↓
Expense Claims
      ↓
Settlement
      ↓
Return Excess / Additional Reimbursement
      ↓
Close Advance
```

The system must prevent settlement amounts from exceeding the outstanding advance without an appropriate additional reimbursement flow.

---

# 22. Receivable / Returnable Architecture

Outgoing transaction can have:

```text
is_returnable = true
```

Then create a receivable record.

Fields:

```text
amount
expected_return_date
returned_amount
outstanding_amount
status
```

Outstanding:

```text
outstanding = original_amount - returned_amount
```

Overdue calculation should be based on the expected return date.

---

# 23. Loan Architecture

Loan lifecycle:

```text
Loan Created
 ↓
Loan Received
 ↓
Money Added to Account
 ↓
Loan Utilization
 ↓
Repayment
 ↓
Outstanding Principal
 ↓
Loan Closed
```

Loan utilization should link back to the original loan and transaction.

The system should prevent utilization above the available amount.

---

# 24. Salary Architecture

Salary processing should be separated into:

1. Salary structure
2. Salary generation
3. Salary approval
4. Salary payment
5. Salary slip generation

Flow:

```text
Employee
 ↓
Salary Structure
 ↓
Generate Monthly Salary
 ↓
Accounts Review
 ↓
Admin Approval
 ↓
Payment
 ↓
Salary Paid
 ↓
Generate PDF Slip
 ↓
Employee Portal
```

---

# 25. Salary Locking

Once salary is approved:

```text
GENERATED → APPROVED
```

The salary should become protected from normal editing.

After payment:

```text
APPROVED → PAID
```

Any correction must use an authorized adjustment/reversal process and must create an audit record.

---

# 26. Employee Bank Account Workflow

```text
Employee submits account
       ↓
PENDING_VERIFICATION
       ↓
Accounts verifies documents
       ↓
Admin approves
       ↓
VERIFIED
```

Rejected:

```text
PENDING_VERIFICATION
       ↓
REJECTED
```

If changed later:

```text
Existing VERIFIED account
       ↓
New account submitted
       ↓
PENDING_VERIFICATION
```

Salary payment must select only an eligible verified account.

---

# 27. Voucher Service

Voucher generation should be centralized.

Service:

```text
VoucherService
```

Responsibilities:
- Generate voucher number
- Build voucher data
- Generate PDF
- Store PDF
- Link PDF to transaction
- Return secure download URL

Voucher number must be unique.

---

# 28. Attachment Service

Use private object storage.

Recommended:

```text
S3-compatible storage
```

Do not expose storage buckets publicly.

Upload flow:

```text
Client
 ↓
API
 ↓
File Validation
 ↓
Object Storage
 ↓
Attachment Record
 ↓
Linked Transaction/Expense
```

Supported:
- PDF
- JPG
- JPEG
- PNG
- WEBP

Validate:
- MIME type
- File extension
- File size
- File signature where possible

---

# 29. Secure File Access

Never expose permanent public URLs for sensitive documents.

Use:

```text
GET /api/v1/attachments/:id/download
```

Flow:

```text
Authenticate
 ↓
Authorize record access
 ↓
Generate signed URL
 ↓
Return/download file
```

Staff must only access their own allowed documents.

---

# 30. Approval Service

Centralized service:

```text
ApprovalService
```

Responsibilities:
- Determine required approvers
- Create approval requests
- Track current step
- Approve
- Reject
- Return for correction
- Escalate
- Maintain approval history

Generic structure:

```text
approval_request
approval_step
approval_action
```

This allows the same engine to be used for:
- Expenses
- Payments
- Advances
- Salary
- Bank accounts
- Loans

---

# 31. Approval Rules

Approval can be based on:

- Module
- Amount
- Department
- Role
- Transaction type
- Employee level

Example:

```text
Expense <= ₹5,000
→ Accounts

₹5,001–₹50,000
→ Accounts + Admin

> ₹50,000
→ Accounts + Super Admin/Admin
```

Rules must be configurable.

---

# 32. Notification Service

Central service:

```text
NotificationService
```

Channels:
- In-app
- Email
- Future WhatsApp/SMS

Events:
- Expense submitted
- Expense approved
- Expense rejected
- Payment completed
- Salary approved
- Salary paid
- Bank account verified
- Loan due
- Returnable overdue

Notifications can be queued using BullMQ/Redis.

---

# 33. Background Jobs

Use background jobs for tasks that do not need to block API responses.

Examples:

```text
Generate salary slips
Generate large reports
Send emails
Send reminders
Create monthly reports
Overdue notifications
Loan due reminders
```

Architecture:

```text
Express API
   ↓
Queue
   ↓
Worker
   ↓
Task
```

---

# 34. Reporting Architecture

Simple reports can run directly from PostgreSQL.

For heavy reports:

```text
API
 ↓
Report Service
 ↓
Query
 ↓
Generate Excel/PDF
 ↓
Background Job
 ↓
File Storage
 ↓
Download
```

Reports must respect:
- Company scope
- User role
- Permissions
- Date range

---

# 35. Dashboard Architecture

Dashboard APIs should return aggregated data.

Example:

```text
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/cash-flow
GET /api/v1/dashboard/expenses
GET /api/v1/dashboard/salary
GET /api/v1/dashboard/approvals
```

Avoid sending raw transaction lists when only aggregate values are required.

Recommended response:

```json
{
  "moneyIn": 500000,
  "moneyOut": 120000,
  "cashBalance": 45000,
  "bankBalance": 325000,
  "pendingApprovals": 8,
  "receivable": 75000,
  "loanOutstanding": 150000,
  "salaryPayable": 120000
}
```

---

# 36. API Response Standard

Success:

```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Expense approval is required",
  "code": "APPROVAL_REQUIRED",
  "errors": []
}
```

All API errors should use consistent status codes.

---

# 37. HTTP Status Codes

Use:

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
```

---

# 38. Validation

Recommended library:

```text
Zod
```

or:

```text
Joi
```

Validation must happen before business logic.

Validate:
- Amount
- Date
- IDs
- Enums
- Required fields
- File metadata
- Pagination
- Filters

Never trust client-side validation alone.

---

# 39. Error Handling

Use a centralized error middleware.

Example structure:

```text
AppError
ValidationError
AuthenticationError
AuthorizationError
NotFoundError
ConflictError
FinancialTransactionError
```

Controller should not contain large try/catch blocks for business logic.

Service throws known application errors.

Global middleware converts them to API responses.

---

# 40. Logging

Use Pino or Winston.

Log:
- Request ID
- HTTP method
- Route
- Status
- Response time
- User ID
- Company ID
- Error stack on server side

Never log:
- Passwords
- Full bank account numbers
- Access tokens
- Refresh tokens
- Sensitive documents
- Card CVV/PIN

---

# 41. Audit Logging

Audit service should record:

```text
user_id
company_id
module
record_id
action
old_data
new_data
ip_address
user_agent
created_at
```

Actions:

```text
CREATE
UPDATE
DELETE_REQUEST
APPROVE
REJECT
SUBMIT
PAY
REVERSE
VERIFY
LOGIN
LOGOUT
```

For financial records, prefer reversal/cancellation over hard deletion.

---

# 42. Database Transactions

Use Prisma transactions for all money-changing operations.

Example conceptual flow:

```js
await prisma.$transaction(async (tx) => {
  const payment = await tx.paymentOut.create(...);

  await tx.transaction.create(...);

  await tx.account.update(...);

  await tx.voucher.create(...);

  await tx.auditLog.create(...);
});
```

If any operation fails, all changes roll back.

---

# 43. Concurrency & Balance Protection

Two users may attempt to spend the same account balance at the same time.

Therefore:

- Use database transactions.
- Use row-level locking/appropriate isolation where needed.
- Validate available balance inside the transaction.
- Avoid relying on a balance read performed before the transaction.

Example:

```text
Account balance = ₹10,000

User A requests ₹8,000
User B requests ₹7,000

Both cannot be approved simultaneously.

Database transaction must ensure:
Available balance remains consistent.
```

---

# 44. Idempotency

Financial APIs should support idempotency for critical operations.

Example:

```text
POST /api/v1/payment-out
Idempotency-Key: unique-client-key
```

If the same request is accidentally submitted twice, the backend should not create two payments.

Use idempotency for:
- Payment In confirmation
- Payment Out
- Salary payment
- Loan repayment
- Refund
- Account transfer

---

# 45. Pagination

All list endpoints should support:

```text
?page=1
&limit=20
&sortBy=createdAt
&sortOrder=desc
```

Response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "totalPages": 7
  }
}
```

Maximum page size should be enforced.

---

# 46. Search Architecture

Use PostgreSQL indexes for common searches.

Indexes should be considered for:

```text
company_id
employee_id
account_id
transaction_date
status
created_at
voucher_no
expense_no
reference_no
```

For large datasets, consider PostgreSQL full-text search or Elasticsearch/OpenSearch later.

---

# 47. Database Indexing

Important composite indexes:

```text
(company_id, transaction_date)
(company_id, status)
(company_id, employee_id)
(company_id, account_id)
(company_id, created_at)
```

Do not create excessive indexes because they increase write cost.

---

# 48. Data Integrity

Use database constraints:

- Foreign keys
- Unique constraints
- Check constraints where supported
- Non-null fields
- Decimal precision
- Enum validation

Examples:

```text
voucher_no UNIQUE
employee_code UNIQUE per company
account number appropriately constrained
```

---

# 49. Soft Delete

For master records where deletion is needed:

```text
deleted_at
deleted_by
```

Financial transactions should generally not be physically deleted.

Instead use:

```text
CANCELLED
REVERSED
```

with an audit record.

---

# 50. Security Architecture

Required:

- HTTPS
- Helmet
- CORS allowlist
- Rate limiting
- Secure cookies if used
- JWT validation
- Password hashing
- Input validation
- File upload restrictions
- SQL injection protection through ORM/parameterized queries
- XSS protection
- CSRF strategy where cookie authentication is used
- Audit logs
- Secret management
- Database backups

---

# 51. Environment Configuration

`.env.example`

```env
NODE_ENV=development
PORT=5000

DATABASE_URL=postgresql://user:password@localhost:5432/company_finance

JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me

ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

REDIS_URL=redis://localhost:6379

S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

APP_URL=http://localhost:3000
API_URL=http://localhost:5000
```

Secrets must never be committed to Git.

---

# 52. Docker Architecture

Development:

```text
docker-compose
 ├── node-api
 ├── postgres
 ├── redis
 └── minio (optional local S3)
```

Production:

```text
Load Balancer / Reverse Proxy
          ↓
Node.js API containers
          ↓
PostgreSQL
          ↓
Redis
          ↓
S3
```

---

# 53. Deployment

Recommended production setup:

```text
Cloud Load Balancer
        ↓
Nginx
        ↓
Node.js / Express
        ↓
Managed PostgreSQL
        ↓
Redis
        ↓
S3-compatible storage
```

Node.js API should be stateless so multiple instances can run.

Do not store uploaded files permanently on local API server disks in production.

---

# 54. Health Checks

Endpoints:

```text
GET /health
GET /ready
```

`/health`:
- API process is alive.

`/ready`:
- Database reachable
- Required dependencies available

Example:

```json
{
  "status": "ok",
  "database": "connected"
}
```

Do not expose sensitive dependency details publicly.

---

# 55. Backup Strategy

Database:

- Daily full backup
- Point-in-time recovery where supported
- Retention policy
- Periodic restore testing

Files:

- Object storage versioning where appropriate
- Backup policy
- Retention policy

Audit logs should be retained according to business/legal requirements.

---

# 56. Testing Architecture

## Unit Tests

Test:
- Services
- Financial calculations
- Approval rules
- Salary calculations
- Loan calculations
- Advance settlement
- Permissions

## Integration Tests

Test:
- API + database
- Authentication
- Expense workflow
- Payment workflow
- Salary workflow
- Loan workflow

## E2E Tests

Test complete workflows:

### Expense
Staff → Submit → Accounts → Admin → Reimbursement

### Salary
Employee bank → Verify → Generate → Approve → Pay → Slip

### Loan
Receive → Utilize → Repay → Close

---

# 57. Critical Financial Test Cases

1. Payment In increases account balance.
2. Payment Out decreases account balance.
3. Account transfer does not change total company funds.
4. Failed transaction rolls back all changes.
5. Duplicate payment request does not create duplicate payment.
6. Insufficient balance prevents payment where applicable.
7. Approved expense is not automatically considered paid.
8. Reimbursement creates linked Payment Out.
9. Staff advance settlement calculates correct outstanding amount.
10. Loan utilization cannot exceed available amount.
11. Salary cannot be paid to an unverified bank account.
12. Paid salary cannot be edited through normal APIs.
13. Reversal restores balances correctly.
14. Audit logs are created for financial actions.
15. Users cannot access records outside their company.

---

# 58. API Module Map

```text
/api/v1
│
├── /auth
├── /users
├── /roles
├── /employees
├── /departments
├── /accounts
├── /transactions
├── /payment-in
├── /payment-out
├── /expenses
├── /advances
├── /receivables
├── /loans
├── /loan-utilizations
├── /loan-repayments
├── /bank-accounts
├── /salaries
├── /salary-slips
├── /vouchers
├── /approvals
├── /attachments
├── /notifications
├── /reports
├── /dashboard
├── /audit-logs
└── /settings
```

---

# 59. Example Endpoint Set

## Authentication

```http
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
GET  /api/v1/auth/me
```

## Payment In

```http
GET  /api/v1/payment-in
POST /api/v1/payment-in
GET  /api/v1/payment-in/:id
POST /api/v1/payment-in/:id/confirm
POST /api/v1/payment-in/:id/reverse
```

## Payment Out

```http
GET  /api/v1/payment-out
POST /api/v1/payment-out
GET  /api/v1/payment-out/:id
POST /api/v1/payment-out/:id/submit
POST /api/v1/payment-out/:id/approve
POST /api/v1/payment-out/:id/pay
POST /api/v1/payment-out/:id/reverse
```

## Expenses

```http
GET  /api/v1/expenses
POST /api/v1/expenses
GET  /api/v1/expenses/:id
PUT  /api/v1/expenses/:id
POST /api/v1/expenses/:id/submit
POST /api/v1/expenses/:id/verify
POST /api/v1/expenses/:id/approve
POST /api/v1/expenses/:id/reject
POST /api/v1/expenses/:id/reimburse
```

## Salary

```http
GET  /api/v1/salaries
POST /api/v1/salaries/generate
GET  /api/v1/salaries/:id
POST /api/v1/salaries/:id/approve
POST /api/v1/salaries/:id/pay
GET  /api/v1/salaries/:id/slip
```

## Bank Accounts

```http
GET  /api/v1/bank-accounts
POST /api/v1/bank-accounts
GET  /api/v1/bank-accounts/:id
POST /api/v1/bank-accounts/:id/verify
POST /api/v1/bank-accounts/:id/reject
```

---

# 60. API Security Example

Every protected endpoint:

```text
authenticate
      ↓
companyScope
      ↓
authorize(permission)
      ↓
validateRequest
      ↓
controller
```

Example:

```js
router.post(
  "/",
  authenticate,
  companyScope,
  authorize("expense.create"),
  validate(createExpenseSchema),
  expenseController.create
);
```

---

# 61. Service Layer Rules

Controllers should be thin.

Bad:

```text
Controller:
- validate
- calculate salary
- update account
- generate voucher
- send email
- write audit
```

Good:

```text
Controller
   ↓
SalaryService
   ├── Salary calculation
   ├── Approval logic
   ├── Transaction service
   ├── Voucher service
   ├── Audit service
   └── Notification service
```

---

# 62. Transaction Service

Create a central service:

```text
TransactionService
```

Responsibilities:

- Create ledger transaction
- Validate account
- Validate amount
- Update account balance
- Handle transfers
- Handle reversals
- Maintain transaction references
- Maintain financial consistency

Other modules should call this service instead of directly modifying balances.

---

# 63. Reversal Architecture

Do not delete a confirmed financial transaction.

Example:

Original:

```text
PAY-0001
Payment Out ₹10,000
```

If wrong:

```text
REV-0001
Reversal ₹10,000
```

Link:

```text
reversal_of = PAY-0001
```

Audit:

```text
Original transaction
+
Reason
+
User
+
Timestamp
```

Account balance is corrected through the reversal.

---

# 64. Idempotency Architecture

Create table:

```text
idempotency_keys
```

Fields:

```text
id
company_id
key
endpoint
request_hash
response_status
response_body
created_at
expires_at
```

Critical payment APIs should check this before creating transactions.

---

# 65. Reporting Data Model

For reports, derive data from:

```text
transactions
accounts
expenses
salaries
loans
advances
receivables
```

Do not create multiple independent balance systems.

The transaction ledger should remain the primary financial movement source.

---

# 66. Recommended Packages

Core:

```text
express
@prisma/client
prisma
zod
jsonwebtoken
bcrypt/argon2
helmet
cors
express-rate-limit
pino
pino-http
```

Optional:

```text
ioredis
bullmq
multer
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
pdfkit
exceljs
nodemailer
```

Testing:

```text
vitest/jest
supertest
```

Development:

```text
nodemon
eslint
prettier
husky
lint-staged
```

---

# 67. Coding Standards

Use:

- ESLint
- Prettier
- Async/await
- Centralized errors
- Clear naming
- Small service methods
- No business logic in routes
- No direct Prisma access from controllers
- Environment-based configuration
- JSDoc/TypeScript migration path if needed

Recommended naming:

```text
camelCase
PascalCase for classes
UPPER_SNAKE_CASE for constants
```

---

# 68. TypeScript Migration Path

Although the requested backend is Node.js + Express.js, the architecture should remain compatible with TypeScript.

If the project grows, migrate:

```text
.js → .ts
```

Use:

```text
strict: true
```

TypeScript is recommended for long-term maintainability because the system contains many financial entities and workflows.

---

# 69. Performance Strategy

Initial target:

- Stateless API
- Database connection pooling
- Pagination
- Proper indexes
- Cached dashboard aggregates where useful
- Background jobs for heavy work

Avoid:
- Large unpaginated queries
- Generating PDFs inside long HTTP transactions
- Storing large files in PostgreSQL
- Recalculating entire reports on every dashboard request

---

# 70. Observability

Production should include:

- Structured logs
- Error tracking
- Request IDs
- API latency monitoring
- Database monitoring
- Queue monitoring
- Health checks
- Failed job monitoring

Recommended future tools:
- Sentry
- OpenTelemetry
- Prometheus/Grafana

---

# 71. Deployment Environments

Use:

```text
Development
Staging
Production
```

Environment-specific:

```text
.env.development
.env.staging
.env.production
```

Secrets should be stored using the deployment platform's secret manager.

---

# 72. CI/CD

Recommended pipeline:

```text
Git Push
 ↓
Install dependencies
 ↓
Lint
 ↓
Unit Tests
 ↓
Integration Tests
 ↓
Build
 ↓
Docker Image
 ↓
Deploy Staging
 ↓
Smoke Tests
 ↓
Production Approval
 ↓
Production Deploy
```

Database migrations must be handled safely during deployment.

---

# 73. Recommended Development Order

## Phase 1 — Foundation

1. Project setup
2. Express app
3. PostgreSQL
4. Prisma
5. Authentication
6. RBAC
7. Company scope
8. Logging
9. Error handling
10. Audit framework

## Phase 2 — Finance Core

1. Accounts
2. Transaction ledger
3. Payment In
4. Payment Out
5. Transfers
6. Voucher
7. Attachments

## Phase 3 — Expenses

1. Expense categories
2. Office expenses
3. Staff expenses
4. Approval workflow
5. Reimbursements
6. Staff advances
7. Returnable money

## Phase 4 — Loans

1. Loan master
2. Loan receipt
3. Utilization
4. Repayment
5. Outstanding

## Phase 5 — HR & Salary

1. Employees
2. Bank accounts
3. Bank verification
4. Salary structures
5. Salary generation
6. Salary approval
7. Salary payment
8. Salary slips

## Phase 6 — Dashboard & Reports

1. Dashboard APIs
2. Financial reports
3. Expense reports
4. Salary reports
5. Loan reports
6. Receivable reports
7. Excel/PDF exports

## Phase 7 — Production Hardening

1. Security testing
2. Performance testing
3. Backup
4. Monitoring
5. CI/CD
6. Documentation
7. Disaster recovery testing

---

# 74. Definition of Done

A backend module is considered complete when:

- API route exists.
- Authentication is implemented.
- Permission check exists.
- Request validation exists.
- Controller is implemented.
- Service logic is implemented.
- Repository/database operations work.
- Database constraints exist.
- Audit logging is implemented.
- Error handling is implemented.
- Unit tests exist.
- Integration tests exist for critical workflows.
- API documentation is updated.
- Security checks are completed.

For financial modules additionally:

- Database transaction is used.
- Account balance is consistent.
- Duplicate request protection exists where required.
- Reversal/rollback behavior is tested.
- Voucher linkage works.
- Audit trail works.

---

# 75. Final Architecture Principle

The most important architectural principle is:

> **The financial transaction ledger is the source of truth for money movement.**

Every money movement should be traceable:

```text
SOURCE
  ↓
ACCOUNT
  ↓
TRANSACTION
  ↓
PURPOSE
  ↓
PERSON / CLIENT / VENDOR
  ↓
PROOF
  ↓
APPROVAL
  ↓
PAYMENT
  ↓
SETTLEMENT / RETURN
  ↓
REPORT
```

Employee expense:

```text
STAFF
 ↓
EXPENSE
 ↓
PROOF
 ↓
ACCOUNTS VERIFICATION
 ↓
ADMIN APPROVAL
 ↓
REIMBURSEMENT
 ↓
LEDGER
```

Salary:

```text
EMPLOYEE
 ↓
BANK ACCOUNT
 ↓
ACCOUNT VERIFICATION
 ↓
ADMIN APPROVAL
 ↓
SALARY GENERATION
 ↓
SALARY APPROVAL
 ↓
PAYMENT
 ↓
LEDGER
 ↓
SALARY SLIP
 ↓
EMPLOYEE PORTAL
```

Loan:

```text
LENDER
 ↓
LOAN RECEIVED
 ↓
COMPANY ACCOUNT
 ↓
UTILIZATION
 ↓
EXPENSE/PAYMENT
 ↓
LOAN REPAYMENT
 ↓
OUTSTANDING
```

This architecture is intended to provide a secure, auditable and scalable foundation for the Node.js + Express.js implementation of the portal.
