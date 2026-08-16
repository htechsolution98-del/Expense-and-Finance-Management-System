# Final Architecture Specification — Company Finance, Expense & Employee Management Portal

This document represents the final, authoritative architecture specification for the portal. It resolves all architectural gaps, missing entities, database conflicts, and security concerns identified in previous reviews, incorporating all official product decisions.

---

## 1. Final Architecture

The backend is built as a stateless Node.js + Express.js REST API using Prisma ORM with PostgreSQL. Heavy and asynchronous activities are delegated to BullMQ worker threads backed by Redis. Private documents are stored in S3-compatible object storage.

### 1.1 Modular Layered Layout
```text
HTTP Request 
   ↓
Route Handler
   ↓
Middleware Layer [ Helmet, CORS, Request ID, Rate Limiter ]
   ↓
Authentication Middleware [ JWT verification ]
   ↓
Tenant Isolation Middleware [ companyScope - resolves & locks company_id ]
   ↓
Authorization Middleware [ checks granular permission keys, e.g., expense.approve ]
   ↓
Request Validation Middleware [ Zod schema checks ]
   ↓
Controller Layer [ parses HTTP, calls Services, returns unified JSON response ]
   ↓
Service Layer [ executes core business logic, orchestrates cross-module actions ]
   ↓
Transaction Ledger (TransactionService) [ handles all balance and ledger alterations ]
   ↓
Repository Layer / Prisma ORM [ database CRUD and transaction management ]
   ↓
PostgreSQL Database
```

---

## 2. Final Database Entities

To resolve referential integrity issues and model all requirements, the PostgreSQL database uses the following explicit schemas, managed via Prisma:

### 2.1 authentication & users
#### `companies`
*   `id` (UUID, Primary Key)
*   `name` (String)
*   `timezone` (String, default: "UTC")
*   `currency` (String, default: "INR")
*   `status` (Enum: ACTIVE, INACTIVE)
*   `created_at` (Timestamp)
*   `updated_at` (Timestamp)

#### `roles`
*   `id` (UUID, Primary Key)
*   `name` (String, Unique)
*   `permissions` (String[], array of granular permission keys)

#### `users`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `email` (String, Unique)
*   `password_hash` (String)
*   `role_id` (UUID, Foreign Key to `roles`)
*   `employee_id` (UUID, Nullable, Foreign Key to `employees` - self-service link)
*   `status` (Enum: ACTIVE, INACTIVE)
*   `created_at` (Timestamp)
*   `updated_at` (Timestamp)

### 2.2 employee & hr
#### `employees`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `employee_code` (String, Unique within `company_id`)
*   `name` (String)
*   `department_id` (UUID, Nullable, Foreign Key to `departments`)
*   `designation_id` (UUID, Nullable, Foreign Key to `designations`)
*   `salary_structure_id` (UUID, Nullable, Unique, Foreign Key to `salary_structures`)
*   `joining_date` (Date)
*   `mobile` (String)
*   `email` (String)
*   `address` (Text)
*   `emergency_contact` (Text, Nullable)
*   `status` (Enum: ACTIVE, ON_LEAVE, INACTIVE, RESIGNED)
*   `created_at` (Timestamp)
*   `updated_at` (Timestamp)

#### `departments` & `designations`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `name` (String)
*   `deleted_at` (Timestamp, Nullable for soft deletes)

#### `salary_structures`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `employee_id` (UUID, Unique, Foreign Key to `employees` on delete cascade)
*   `base_salary` (Decimal(18,2))
*   `hra` (Decimal(18,2))
*   `conveyance` (Decimal(18,2))
*   `special_allowance` (Decimal(18,2))
*   `other_allowances` (Decimal(18,2))
*   `created_at` (Timestamp)
*   `updated_at` (Timestamp)

#### `employee_bank_accounts`
*   `id` (UUID, Primary Key)
*   `employee_id` (UUID, Foreign Key to `employees`)
*   `account_holder` (String)
*   `bank_name` (String)
*   `account_number` (String, encrypted/masked in UI)
*   `ifsc` (String)
*   `verification_status` (Enum: PENDING_VERIFICATION, VERIFIED, REJECTED)
*   `verified_by` (UUID, Nullable, Foreign Key to `users`)
*   `verified_at` (Timestamp, Nullable)
*   `created_at` (Timestamp)

### 2.3 financial accounts & transactions
#### `accounts`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `name` (String)
*   `type` (Enum: CASH, BANK, UPI, CARD, OTHER)
*   `bank_name` (String, Nullable)
*   `account_number` (String, Nullable)
*   `ifsc` (String, Nullable)
*   `opening_balance` (Decimal(18,2))
*   `current_balance` (Decimal(18,2))
*   `version` (Integer, default: 0 - for Optimistic Concurrency Control)
*   `status` (Enum: ACTIVE, INACTIVE)
*   `deleted_at` (Timestamp, Nullable)

#### `transactions` (Unified Ledger - Resolves Polymorphic Relations)
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `transaction_no` (String, Unique)
*   `type` (Enum: PAYMENT_IN, PAYMENT_OUT, TRANSFER_OUT, TRANSFER_IN, REVERSAL)
*   `category` (Enum: CLIENT_PAYMENT, OFFICE_EXPENSE, VENDOR_PAYMENT, STAFF_REIMBURSEMENT, STAFF_ADVANCE, SALARY_PAYMENT, LOAN_RECEIVED, LOAN_REPAYMENT, RECEIVABLE_RETURN, INTERNAL_TRANSFER, OTHER)
*   `date` (Timestamp)
*   `amount` (Decimal(18,2))
*   `account_id` (UUID, Foreign Key to `accounts` - balance-affected account)
*   `purpose` (String)
*   `payment_mode` (Enum: CASH, BANK_TRANSFER, UPI, CREDIT_CARD, DEBIT_CARD, CHEQUE, OTHER)
*   `reference_no` (String, Nullable - UTR, cheque number, UPI ref)
*   `transfer_group_id` (UUID, Nullable - groups matching TRANSFER_OUT and TRANSFER_IN entries)
*   `reversal_of_id` (UUID, Nullable, Unique, Foreign Key to `transactions` - links reversal to original)
*   `created_by` (UUID, Foreign Key to `users`)
*   `created_at` (Timestamp)

#### **Explicit Foreign Keys for Target Parties**
*   `client_id` (UUID, Nullable, Foreign Key to `clients`)
*   `vendor_id` (UUID, Nullable, Foreign Key to `vendors`)
*   `employee_id` (UUID, Nullable, Foreign Key to `employees`)
*   `loan_id` (UUID, Nullable, Foreign Key to `loans`)
*   `expense_id` (UUID, Nullable, Foreign Key to `expenses`)
*   `advance_id` (UUID, Nullable, Foreign Key to `advances`)
*   `receivable_id` (UUID, Nullable, Foreign Key to `receivables`)
*   `salary_id` (UUID, Nullable, Foreign Key to `salaries`)

### 2.4 operational modules
#### `expenses`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `expense_no` (String, Unique)
*   `employee_id` (UUID, Foreign Key to `employees`)
*   `category_id` (UUID, Foreign Key to `expense_categories`)
*   `amount` (Decimal(18,2))
*   `date` (Date)
*   `purpose` (String)
*   `payment_mode` (Enum: CASH, BANK_TRANSFER, UPI, CREDIT_CARD, DEBIT_CARD, CHEQUE, OTHER)
*   `status` (Enum: DRAFT, SUBMITTED, UNDER_REVIEW, RETURNED_FOR_CORRECTION, APPROVED, REJECTED, REIMBURSED, CLOSED)
*   `advance_id` (UUID, Nullable, Foreign Key to `advances` - links settlement)
*   `created_by` (UUID, Foreign Key to `users`)
*   `created_at` (Timestamp)

#### `advances`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `advance_no` (String, Unique)
*   `employee_id` (UUID, Foreign Key to `employees`)
*   `amount` (Decimal(18,2))
*   `purpose` (String)
*   `date` (Date)
*   `expected_settlement_date` (Date)
*   `status` (Enum: DRAFT, SUBMITTED, APPROVED, DISBURSED, PARTIALLY_SETTLED, FULLY_SETTLED, CANCELLED)
*   `disbursed_transaction_id` (UUID, Nullable, Foreign Key to `transactions` - tracks cash-out)
*   `created_at` (Timestamp)

#### `advance_settlements`
*   `id` (UUID, Primary Key)
*   `advance_id` (UUID, Foreign Key to `advances`)
*   `utilized_amount` (Decimal(18,2))
*   `returned_amount` (Decimal(18,2))
*   `additional_reimbursement_amount` (Decimal(18,2))
*   `settlement_date` (Date)
*   `status` (Enum: SUBMITTED, VERIFIED, APPROVED, REJECTED)
*   `notes` (Text, Nullable)

#### `receivables`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `origin_transaction_id` (UUID, Foreign Key to `transactions` - reference payment out)
*   `employee_id` (UUID, Nullable, Foreign Key to `employees`)
*   `vendor_id` (UUID, Nullable, Foreign Key to `vendors`)
*   `client_id` (UUID, Nullable, Foreign Key to `clients`)
*   `total_amount` (Decimal(18,2))
*   `returned_amount` (Decimal(18,2))
*   `outstanding_amount` (Decimal(18,2))
*   `expected_return_date` (Date)
*   `actual_return_date` (Date, Nullable)
*   `status` (Enum: PENDING, PARTIALLY_RETURNED, FULLY_RETURNED, OVERDUE)

#### `loans`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `loan_no` (String, Unique)
*   `lender` (String)
*   `principal` (Decimal(18,2))
*   `interest_rate` (Decimal(5,2))
*   `received_date` (Date)
*   `purpose` (String)
*   `receiving_account_id` (UUID, Foreign Key to `accounts`)
*   `status` (Enum: ACTIVE, FULLY_REPAID, DEFAULTED)

#### `loan_utilizations`
*   `id` (UUID, Primary Key)
*   `loan_id` (UUID, Foreign Key to `loans`)
*   `transaction_id` (UUID, Foreign Key to `transactions`)
*   `amount` (Decimal(18,2))
*   `purpose` (String)

#### `loan_repayments`
*   `id` (UUID, Primary Key)
*   `loan_id` (UUID, Foreign Key to `loans`)
*   `transaction_id` (UUID, Foreign Key to `transactions`)
*   `principal` (Decimal(18,2))
*   `interest` (Decimal(18,2))
*   `total` (Decimal(18,2))

#### `salaries`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `employee_id` (UUID, Foreign Key to `employees`)
*   `salary_month` (String, e.g. "2026-08")
*   `gross_salary` (Decimal(18,2))
*   `total_deductions` (Decimal(18,2))
*   `net_salary` (Decimal(18,2))
*   `status` (Enum: DRAFT, GENERATED, UNDER_REVIEW, APPROVED, PAYMENT_PENDING, PAID, CANCELLED)
*   `approved_by` (UUID, Nullable, Foreign Key to `users`)
*   `approved_at` (Timestamp, Nullable)
*   `paid_at` (Timestamp, Nullable)

#### `salary_components`
*   `id` (UUID, Primary Key)
*   `salary_id` (UUID, Foreign Key to `salaries` on delete cascade)
*   `name` (String)
*   `type` (Enum: EARNING, DEDUCTION)
*   `amount` (Decimal(18,2))

### 2.5 infrastructure & configuration
#### `approval_rules`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `module` (Enum: EXPENSE, ADVANCE, SALARY, BANK_ACCOUNT, PAYMENT_OUT)
*   `min_amount` (Decimal(18,2))
*   `max_amount` (Decimal(18,2))
*   `department_id` (UUID, Nullable, Foreign Key to `departments`)
*   `approver_roles` (String[], sequence of required Role names, e.g., `["ACCOUNT", "ADMIN"]`)

#### `approval_requests` & `approval_steps`
*   `id` (UUID, Primary Key)
*   `module` (String)
*   `record_id` (UUID)
*   `status` (Enum: PENDING, APPROVED, REJECTED, RETURNED)
*   `current_step` (Integer)

#### `idempotency_keys`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `key` (String, Unique within `company_id`)
*   `endpoint` (String)
*   `request_hash` (String)
*   `response_status` (Integer)
*   `response_body` (Text)
*   `created_at` (Timestamp)
*   `expires_at` (Timestamp)

#### `vouchers`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `voucher_no` (String, Unique)
*   `transaction_id` (UUID, Nullable, Foreign Key to `transactions`)
*   `file_path` (String, S3 key reference)

#### `attachments`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `module` (Enum: EXPENSE, ADVANCE, LOAN, SALARY, BANK_ACCOUNT)
*   `record_id` (UUID)
*   `file_name` (String)
*   `file_path` (String)
*   `uploaded_by` (UUID, Foreign Key to `users`)
*   `uploaded_at` (Timestamp)

#### `audit_logs`
*   `id` (UUID, Primary Key)
*   `company_id` (UUID, Foreign Key to `companies`)
*   `user_id` (UUID, Foreign Key to `users`)
*   `module` (String)
*   `record_id` (UUID)
*   `action` (String)
*   `old_data` (Json, Nullable)
*   `new_data` (Json, Nullable)
*   `ip_address` (String)
*   `user_agent` (String)
*   `created_at` (Timestamp)

---

## 3. Entity Relationships

The data schema utilizes strict 1-to-Many and 1-to-1 relationships to secure transaction tracking:

*   **Company Scoping**: Every business entity (Users, Employees, Accounts, Transactions, Expenses, Advances, Receivables, Loans, Salaries, Vouchers) references `company_id` (1:N relation), ensuring database queries include tenant boundaries.
*   **Users vs. Employees**: A `user` represents a system credential. An `employee` represents an payroll/HR profile. A `user` has an optional 1:1 relation to `employees` via `employee_id`. System admins do not link to employees; staff users must link to employees.
*   **Salary Structure**: An employee has exactly one `salary_structure` (1:1 relation via `employee_id` and `salary_structure_id`).
*   **Transactions to Parties**: Polymorphism is eliminated. The `transactions` table has direct nullable 1:N relations with `clients`, `vendors`, `employees`, and `loans`.

---

## 4. Financial Transaction Model

All updates to company cash flows are recorded as ledger entries in the `transactions` table:

*   **Ledger Invariance**: Once a transaction is written, it is immutable. Deletions and modifications are prevented.
*   **Transaction Categories**: Every transaction lists a category mapping its nature (e.g., `OFFICE_EXPENSE`, `CLIENT_PAYMENT`).
*   **Reversal Transactions**: Corrections create a reverse transaction where `reversal_of_id` links back to the original transaction. The original transaction status is set to `REVERSED`.

---

## 5. Account/Balance Handling

Account balances are updated via a centralized ledger execution pattern:

*   **Calculated Balance**: The authoritative balance of an account is the sum of ledger entries.
*   **Cached Balance**: The `accounts.current_balance` stores the cached state for fast retrieval, updated in the same transaction block as ledger writes.
*   **Pending Entries**: Expenses, salaries, or advances in draft/review/approved stages do not alter account balances. The balance decreases only when a transaction's status transitions to `PAID` / `DISBURSED` / `CONFIRMED`.
*   **Internal Transfers**: Executing a transfer (e.g., Bank to Cash) creates a dual-transaction ledger write within a single database transaction. 
    1.  Writes a `TRANSFER_OUT` record on the source account (debit).
    2.  Writes a `TRANSFER_IN` record on the target account (credit).
    3.  Binds both records with matching `transfer_group_id` UUIDs.

---

## 6. Approval Engine

Approvals utilize a dynamic, amount-driven routing engine:

*   **Configurable Rules**: Company admins map thresholds in `approval_rules` matching module, amounts, and sequence of roles (e.g. Accounts first, then Admin).
*   **Request Traversal**: Creating a record triggers `ApprovalService` to instantiate an `approval_request` with nested `approval_steps`.
*   **Verification & Sign-off**: Actions include `APPROVE`, `REJECT`, and `RETURN_FOR_CORRECTION`. Status changes propagate to the target record.

---

## 7. Role and Permission Model

Permissions are enforced server-side. Users cannot perform API actions unless their role contains the matching permission key:

*   **Super Admin**: Access to system configuration, user creation, master lists, audit trails, and global overrides.
*   **Admin**: Approvals, report viewing, dashboard aggregates, and employee status tracking.
*   **Accounts**: Data entry, transaction execution, verification checks, and salary processing.
*   **Staff**: Self-service profile editing, submission of own expenses, and advance requests.

---

## 8. Expense Workflow

```text
  [ DRAFT ] (Staff inputs details)
     │
     ▼
[ SUBMITTED ] (Staff uploads proofs, lock editing)
     │
     ▼
[ UNDER_REVIEW ] (Accounts verifies receipt, category, and tax codes)
     ├──► [ RETURNED_FOR_CORRECTION ] (Staff edits and resubmits)
     ├──► [ REJECTED ] (Terminates cycle)
     │
     ▼
[ APPROVED ] (Approval engine reviews limits: Auto-approved if <= ₹5,000; Admin signoff if higher)
     │
     ▼
  [ PAID ] (Accounts logs disbursement, Transaction Ledger executes cash decrease)
     │
     ▼
  [ CLOSED ] (Voucher PDF generated, S3 locked)
```

---

## 9. Advance Workflow

1.  **Request**: Staff requests amount, expected settlement date, and purpose.
2.  **Verify**: Accounts checks outstanding advances. A staff member is limited to 1 active advance.
3.  **Approval**: Admin approves. Accounts executes payout transaction (status = `DISBURSED`).
4.  **Settlement Outcomes**:
    *   **Case A (Exact Match)**: Staff submits expenses matching the advance amount. Accounts approves settlement. Status = `FULLY_SETTLED`.
    *   **Case B (Under Utilization)**: Staff spends less than advance. Staff returns excess funds. Accounts logs a `RECEIVABLE_RETURN` transaction to credit company accounts. Status = `FULLY_SETTLED`.
    *   **Case C (Over Utilization)**: Staff spends more than advance. Accounts approves settlement and issues an additional reimbursement payment (creates a linked Payment Out transaction). Status = `FULLY_SETTLED`.

---

## 10. Receivable/Returnable Workflow

*   **Marking Outflows**: Any Payment Out transaction can be flagged as `is_returnable = true` by Accounts.
*   **Tracking**: A record is created in the `receivables` table logging party, total amount, expected return date, and current outstanding.
*   **Partial Returns**: When returns are received, a payment-in transaction is recorded with a link to `receivable_id`. The receivable outstanding amount is updated.
*   **Overdue Cron**: A daily background checker flags any pending receivables that exceed `expected_return_date` as `OVERDUE` and alerts Admins.

---

## 11. Loan Workflow

*   **Loan Inflow**: Recording a loan registers a `LOAN_RECEIVED` ledger transaction, crediting the target account. Outstanding loan principal balance is initialized.
*   **Loan Utilizations**: Ledger transactions (outflows for equipment, stock, office expenses) can be linked to the loan via `loan_utilizations`. The system verifies total utilizations do not exceed the principal.
*   **Repayments**: Repayment transactions split calculations:
    *   `principal` portion (decreases outstanding loan balance).
    *   `interest` portion (tracked as interest expense).
    *   `total` payment decreases bank/cash account balance.

---

## 12. Salary Workflow

*   **Generation**: Accounts runs salary batch. Reads base employee structure from `salary_structures`.
*   **Manual Entry (Decision A & B)**:
    *   Leave/attendance deductions are manually inputted by Accounts during the review phase.
    *   Salary advance recovery deductions are manually reviewed and entered by Accounts.
*   **Verification Check**: System checks `employee_bank_accounts.status`. If the bank details are not `VERIFIED`, salary payments are blocked.
*   **Disbursement Modes (Decision C)**:
    *   *Bank Transfer*: Standard automatic generation.
    *   *Cash & Cheque*: Non-bank methods require explicit Admin override approval, voucher creation, and attachment of payment proof.
*   **Release**: Payout changes status to `PAID`. PDF salary slip generated and unlocked for employee self-service.

---

## 13. Voucher Workflow

*   **Generation**: Upon transition to `PAID` or `CONFIRMED`, `VoucherService` compiles the ledger details.
*   **Naming Scheme**: Unique, sequential numbers based on transaction prefixes (`EXP`, `PAY`, `REC`, `ADV`, `LOAN`).
*   **Storage**: PDF compiled via PDFKit, stored in private S3 bucket, linked to transaction records.

---

## 14. Audit Workflow

*   **Transaction Lock**: All financial updates write audit logs *inside* the Prisma `$transaction` block. If logging fails, the transaction rolls back.
*   **Immutability**: Normal users cannot update or delete entries. Middleware and DB constraints reject non-SELECT operations on the `audit_logs` table.
*   **Logging Details**: Captures user, timestamp, action, module, record ID, IP, user agent, and a JSON diff (`old_data` vs `new_data`).

---

## 15. Security/Tenant Isolation

*   **Scoped Middleware**: Express middleware verifies JWT and injects `req.user.company_id` into query contexts.
*   **Service Layer Checks**: Services validate that target entity `company_id` matches the user's logged-in company context.
*   **Private S3 Access**: Storage files are private. Access requests map to `/api/v1/attachments/:id/download`. The route performs company and record authorization, and returns S3 signed URLs with a short 15-minute expiration window.

---

## 16. Idempotency Strategy

*   **Keys Validation**: Critical POST requests (Payment In, Payment Out, Salary Payout, Refund) require an `Idempotency-Key` header.
*   **Database Check**: A middleware validates the key against `idempotency_keys` table.
    *   *New Key*: Logs key status as `PROCESSING`, executes service. On success, updates status to `COMPLETED` and caches the HTTP response.
    *   *Existing Key (Processing)*: Returns HTTP `409 Conflict` (request in progress).
    *   *Existing Key (Completed)*: Returns the cached HTTP response instantly without re-running transactions.

---

## 17. Concurrency Strategy

To prevent race conditions on balance updates:

*   **Optimistic Concurrency Control (OCC)**: The `accounts` table contains a `version` column. Balance updates verify the version matches:
    ```sql
    UPDATE accounts SET current_balance = new_balance, version = version + 1 WHERE id = account_id AND version = current_version
    ```
    If 0 rows are updated, the transaction retries.
*   **Row-Level Locking**: For high-concurrency flows, Prisma executes raw SQL transactions using locking keywords:
    ```sql
    SELECT * FROM accounts WHERE id = $1 FOR UPDATE
    ```

---

## 18. Notification Phases (Decision D)

Notifications are dispatched asynchronously via BullMQ:

*   **Phase 1 (MVP)**: strictly in-app notifications written to the `notifications` database table.
*   **Phase 2**: Email integration (using SMTP/Nodemailer).
*   **Phase 3**: WhatsApp and SMS gateway integrations.

---

## 19. MVP Scope

The first production launch includes:
1.  Full Authentication, Role-based Access Control (RBAC), and Tenant Scoping.
2.  Financial Accounts (Cash, Bank, UPI, Cards) and Transaction Ledger (Immutability & Reversals).
3.  Voucher generator (sequential naming, PDFKit compiles).
4.  Office Expense & Staff Expense submissions with S3 attachments.
5.  Threshold-based approval routing logic (<= ₹5,000 accounts-approved, > ₹5,000 admin-approved).
6.  Staff Advances & Settlement flows.
7.  Returnable Money/Receivable tracking.
8.  Loan Management (Principal, Repayments, Utilizations).
9.  Employee Management & Bank verification flows.
10. Salary batch generation, manual deduction inputs, alternate cash/cheque payouts, PDF slips.
11. Admin Dashboards & Basic Reports (Exports to CSV).
12. Append-only Audit Logging.

---

## 20. Future Scope

*   Double-entry general ledger integration.
*   OCR bill scanning and AI categorization.
*   Bank statement automated imports & reconciliation integrations.
*   Statutory compliance (PF, ESIC, Tax filing).
*   Department budgets and multi-company dashboards.

---

## 21. Final Checklist & Readiness Status

- [x] 1. `salary_structures` table defined in the schema.
- [x] 2. `advance_settlements` table defined in the schema.
- [x] 3. `receivables` table defined in the schema.
- [x] 4. `idempotency_keys` table defined in the schema.
- [x] 5. Configurable `approval_rules` table defined in the schema.
- [x] 6. Polymorphic `party_id` in transactions replaced with explicit foreign keys.
- [x] 7. Strict company isolation scopes resolved.
- [x] 8. Concurrency row-locking balances logic specified.
- [x] 9. Confirmed that pending payments do not affect balances.
- [x] 10. Financial record immutability and reversal logic defined.
- [x] 11. User and Employee separation resolved.
- [x] 12. Account transfers represented by linked dual ledger entries.
- [x] 13. Audit logs set as append-only.
- [x] 14. Leave/attendance salary deductions mapped to manual input.
- [x] 15. Advance recoveries mapped to manual run deductions.
- [x] 16. Salary disbursement alternatives defined with Admin signoff override.
- [x] 17. Notification lifecycle phased out.

READY FOR DEVELOPMENT
