# Architecture Validation & Review — Company Finance, Expense & Employee Management Portal

This document provides a final architectural review of the portal's system design, highlighting critical gaps, business rule conflicts, missing entities, and security issues before coding begins.

---

## 1. Critical Issues

### 1.1 Race Conditions in Balance Updates
*   **Problem**: In high-concurrency environments (e.g., multiple accounts users recording payments simultaneously, or double-clicks on submit buttons), simultaneous reads and writes to `accounts.current_balance` can cause race conditions. If two transactions read the balance of ₹10,000 and attempt to deduct ₹8,000 and ₹7,000 respectively, both could succeed if they execute concurrently, leading to an undetected overdraft.
*   **Impact**: Financial inconsistency, negative account balances, and ledger-cache mismatch.
*   **Resolution**: 
    *   Implement row-level locking (`SELECT ... FOR UPDATE`) in the database transaction block when reading the account balance.
    *   Alternatively, implement Optimistic Concurrency Control (OCC) via a `version` integer column on the `accounts` table.

### 1.2 Polymorphic Relationships in Prisma ORM
*   **Problem**: The PRD suggests a unified `transactions` table with `party_type` (Client, Vendor, Employee, Lender) and a generic `party_id`. Prisma ORM does not support native polymorphic foreign keys. Storing `party_id` as a raw integer breaks referential integrity and makes cascading updates or database-level checks impossible.
*   **Impact**: Loss of database-level constraints; possible orphan transaction records.
*   **Resolution**: Use explicit, nullable foreign keys on the `transactions` model:
    *   `client_id` (FK to `clients`)
    *   `vendor_id` (FK to `vendors`)
    *   `employee_id` (FK to `employees`)
    *   `lender_id` (FK to `lender` / `loans`)

### 1.3 Tenant Security (Multi-Company Data Leakage)
*   **Problem**: The API routes (e.g., `GET /api/v1/expenses/:id`) require robust tenant boundaries. If a user harvests IDs and requests an expense belonging to a different company, standard route queries might return it unless the API layer strictly scopes all queries by `company_id`.
*   **Impact**: Severe security data breach.
*   **Resolution**: Build a global scoping middleware that resolves the user's `company_id` from their JWT, and dynamically injects `company_id` checks into all Prisma queries (e.g., via Prisma Client Middleware or custom Repository scope-injection).

---

## 2. Missing Requirements & Database Entities

Upon comparing the database relationships in Section 31 and Suggested Database Structure in Section 32 of the PRD with the requirements, the following entities and relations are missing:

### 2.1 Missing `salary_structures` Table
*   **Gap**: The `employees` table references a `salary_structure_id`, but the Suggested Database Structure does not define this table. We cannot generate draft salaries without knowing the base salary allocations (Basic, HRA, Allowance, etc.).
*   **Resolution**: Add a `salary_structures` table:
    *   `id` (PK)
    *   `company_id` (FK)
    *   `base_salary` (Decimal)
    *   `hra` (Decimal)
    *   `conveyance` (Decimal)
    *   `special_allowance` (Decimal)
    *   `other_allowances` (Decimal)

### 2.2 Missing `advance_settlements` Table
*   **Gap**: The PRD outlines a comprehensive advance settlement flow (utilization vs. return vs. additional reimbursement). However, there is no entity in the Suggested Database Structure to track settlements. 
*   **Resolution**: Add an `advance_settlements` table:
    *   `id` (PK)
    *   `advance_id` (FK to `advances`)
    *   `utilized_amount` (Decimal)
    *   `returned_amount` (Decimal)
    *   `additional_reimbursement_amount` (Decimal)
    *   `settlement_date` (Date)
    *   `status` (Enum: SETTLED, PARTIAL)
    *   `notes` (Text)

### 2.3 Missing `receivables` (Returnables) Table
*   **Gap**: "Returnable Money" is an MVP requirement. Outgoing payments marked as returnable must track due dates, overdue statuses, outstanding balances, and returns. No such table exists in the database design.
*   **Resolution**: Add a `receivables` table:
    *   `id` (PK)
    *   `company_id` (FK)
    *   `transaction_id` (FK to `transactions` representing origin outflow)
    *   `party_type` & `party_id` (or specific FKs for Employee/Vendor)
    *   `total_amount` (Decimal)
    *   `returned_amount` (Decimal)
    *   `outstanding_amount` (Decimal)
    *   `expected_return_date` (Date)
    *   `actual_return_date` (Date, Nullable)
    *   `status` (Enum: PENDING, PARTIALLY_RETURNED, FULLY_RETURNED, OVERDUE)

### 2.4 Missing `idempotency_keys` Table
*   **Gap**: While the architecture recommends idempotency for financial safety, the table to persist keys and response cache values is missing from the database schema.
*   **Resolution**: Create the `idempotency_keys` table as described in Section 64 of the Architecture.

### 2.5 Missing `system_settings` or `approval_rules` Table
*   **Gap**: PRD requires configurable approval thresholds (e.g., Accounts approves up to ₹5,000, Admin approves up to ₹50,000, etc.). These rules cannot be hard-coded if they are configurable by company admins.
*   **Resolution**: Add an `approval_rules` table:
    *   `id` (PK)
    *   `company_id` (FK)
    *   `module` (Enum: EXPENSE, ADVANCE, SALARY, BANK_ACCOUNT, PAYMENT_OUT)
    *   `min_amount` (Decimal)
    *   `max_amount` (Decimal)
    *   `approver_roles` (Array of role permissions required, e.g., `['ACCOUNT', 'ADMIN']`)

---

## 3. Business Rule Conflicts

1.  **Deletion vs. Reversal Conflict**:
    *   *Conflict*: PRD Section 4.1 gives Super Admin permission to "Create/edit/delete master data" and Section 8.7 permits full CRUD. However, Brain Golden Rule 5 states "Never Silently Delete Financial History".
    *   *Resolution*: Master data (Categories, Employees, Accounts) supports soft-deletion (`deleted_at`). Financial entities (Ledger transactions, payment records, loans, salaries, vouchers, audit logs) **must block hard-deletion and soft-deletion** at the database level. Reversal and cancellation entries must be the sole mechanism for corrections.
2.  **Approved vs. Paid Balances**:
    *   *Conflict*: PRD Section 9 states "The HDFC balance decreases by ₹10,000" upon recording vendor payment, but Section 18 says "for approval-based payments, do not reduce the real account balance until the transaction is confirmed/paid."
    *   *Resolution*: Outgoing transactions created in `PENDING_APPROVAL` status must NOT deduct balance. Only when status transitions to `PAID`/`CONFIRMED` does the ledger service execute the balance deduction in a DB transaction.

---

## 4. Recommended Changes

1.  **Separate Users and Employees**:
    *   *Recommendation*: Model `users` and `employees` as distinct entities. Not all Users are Employees (e.g., an external Super Admin or auditor accounts do not have designations, designations, or salary structures). An employee record should have an optional nullable `user_id` to link their self-service login.
2.  **Account Transfer Representation**:
    *   *Recommendation*: For internal account transfers, the ledger must log two separate lines: a debit transaction (decrease) from the source account, and a credit transaction (increase) to the destination account. These lines should share a common `transfer_id` to link them together for balance reconciliation.
3.  **Audit Logs Immutability**:
    *   *Recommendation*: Implement database-level triggers or Prisma middlewares that intercept and throw errors on any `update` or `delete` statement targeting the `audit_logs` table, securing its append-only promise.

---

## 5. Questions/Decisions Required (Clarifications)

1.  **Leave and Attendance Deductions**:
    *   *Question*: The salary generation structure includes leave/attendance deductions. Since leave management is a non-goal for the MVP, should we provide manual inputs in the "Generate Salary" API for the Accounts user to input deduction amounts?
2.  **Salary Advance Recovery Logic**:
    *   *Question*: If an employee has an outstanding advance balance, should the monthly salary generation automatically deduct the outstanding advance (up to a configurable percentage/amount), or is the deduction amount manually entered during monthly run reviews?
3.  **Salary Disbursement Alternative Modes**:
    *   *Question*: PRD allows salary to be paid without a verified bank account via "authorized alternative payment methods." Which alternate modes are allowed (e.g., Cash, Check)? How are these alternative methods authorized?
4.  **Notifications Trigger Scope**:
    *   *Question*: PRD lists SMS/WhatsApp/Email notifications. Should we implement in-app notifications in Phase 2 and defer external channels (SMS/WhatsApp) strictly to Phase 3, or is Email required in Phase 2?

---

## 6. Final Readiness Status

Due to the lack of central database entities (`salary_structures`, `advance_settlements`, `receivables`, `approval_rules`) and the unresolved polymorphic relationships in the transaction schemas, starting backend implementation immediately would result in significant database schema migrations and code refactoring.

NOT READY FOR DEVELOPMENT
