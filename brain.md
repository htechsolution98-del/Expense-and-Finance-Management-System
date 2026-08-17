# BRAIN.md — Company Finance, Expense & Employee Management Portal

---

## ✅ Implementation Phase Tracker

> Yahan har phase ka status track kiya gaya hai — kya build hua, kya test hua, kya baaki hai.

---

### ✅ Phase 1 — Project Foundation & Infrastructure `[COMPLETE]`

**Database:** SQLite / Dynamic (Prisma ORM) — local dev, runtime connection is provider-agnostic.
**Backend:** Express.js + TypeScript, ts-node-dev, Pino logger, Zod validation.
**Frontend:** React + Vite + TypeScript, Tailwind-style custom CSS, Axios API client.
**Auth skeleton:** JWT access token + refresh token structure.

**Verified:**
- `GET /api/v1/health` returns `200 OK`
- SQLite `dev.db` created inside `backend/prisma/`
- Prisma connection provider is fully dynamic at runtime (auto-detects SQLite, PostgreSQL, MySQL, SQL Server, MongoDB from active `DATABASE_URL`)
- Shared `prisma` instance used across all controllers (no raw `new PrismaClient()` duplicates)
- Prisma validate + migrate + generate all clean
- TypeScript + ESLint zero errors

---

### ✅ Phase 2 — Authentication, Users, Roles & Permissions `[COMPLETE]`

**Models:** `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `RefreshToken`, `AuditLog`

**Roles seeded:**
| Role | Access |
|---|---|
| `SUPER_ADMIN` | All 28 permissions |
| `ADMIN` | Management + approval permissions |
| `ACCOUNTS` | Financial operations + expense approval |
| `STAFF` | Self-service: expense + advance only |

**APIs built:**
- `POST /auth/login` — password hash verify, JWT access token (15m) + refresh token (7d)
- `POST /auth/refresh` — rotate refresh token, issue new access token
- `POST /auth/logout` — revoke refresh token
- `GET /auth/me` — current authenticated user + role + permissions
- `POST /auth/change-password` — hashed password update

**User Management (Admin only):**
- Create user, activate/deactivate, assign role

**Security:**
- `authenticate` middleware — verifies JWT Bearer token
- `authorize(permission)` middleware — checks `req.user.permissions[]`
- `tenantScope` middleware — injects `companyId` from authenticated user

**Verified:** All auth flows tested, token rotation confirmed, permission blocks return `403`

---

### ✅ Phase 3 — Company Finance & Ledger `[COMPLETE]`

**Models:** `Account`, `Transaction`, `Voucher`, `Client`, `Vendor`, `Loan`

**Accounts:**
- Cash, Bank, UPI, Card, Other types
- Opening balance + current balance (OCC version field)
- Soft delete (`deletedAt`)

**Transactions (Unified Ledger):**
- Types: `PAYMENT_IN`, `PAYMENT_OUT`, `TRANSFER_OUT`, `TRANSFER_IN`, `REVERSAL`
- Categories: `CLIENT_PAYMENT`, `VENDOR_PAYMENT`, `OFFICE_EXPENSE`, `SALARY_PAYMENT`, `LOAN_RECEIVED`, `LOAN_REPAYMENT`, `STAFF_REIMBURSEMENT`, `INTERNAL_TRANSFER`, `OTHER`
- Every transaction generates a sequential `VCH-PAY-XXXXX` voucher

**APIs built:**
- `GET/POST /accounts` — manage company bank/cash accounts
- `GET/POST /payments` — payment in / payment out with balance update
- `POST /transfers` — internal account transfer (atomic debit + credit)
- `GET /ledger` — unified transaction log with filters
- `POST /ledger/:id/reverse` — transaction reversal
- `GET /masters/clients|vendors|employees|loans` — party registries

**Seeded:**
- Primary Cash Box (₹10,000 opening balance)
- HDFC Operating Bank Account (₹5,00,000 opening balance)
- 2 sample Clients, 2 sample Vendors, 1 Loan

**Verified:** 10/10 integration tests passed (including concurrent SQLite write test)

---

### ✅ Phase 4 — Office & Staff Expenses & Approval Workflow `[COMPLETE]`

**Models:** `Department`, `Designation`, `ExpenseCategory`, `Expense`, `ApprovalRule`, `ApprovalRequest`, `ApprovalStep`

**Expense Statuses:**
`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `RETURNED_FOR_CORRECTION` → `APPROVED` / `REJECTED` → `REIMBURSED`

**Sequential Approval Rules (seeded):**
| Amount Range | Approver Sequence |
|---|---|
| ₹0 – ₹5,000 | `ACCOUNTS` |
| ₹5,001 and above | `ACCOUNTS` → `ADMIN` |

**Approval Engine:**
- Active step locking — out-of-order approvals blocked (`403`)
- Return for correction — resets all steps on resubmission
- Immutability — editing blocked unless `DRAFT` or `RETURNED_FOR_CORRECTION`

**Payout:**
- `POST /expenses/:id/pay` — overdraft check, atomic balance deduct, `PAYMENT_OUT` ledger entry, `STAFF_REIMBURSEMENT` category, voucher generated

**APIs built:**
- `GET/POST /expenses/categories`
- `GET/POST /expenses` — scoped: STAFF sees own, ACCOUNTS/ADMIN see all
- `PATCH /expenses/:id` — update draft/returned
- `POST /expenses/:id/submit|approve|reject|return|pay`

**Frontend:** `ExpensesList.tsx` — claims grid, step timeline, reviewer action panel, settlement disburse widget

**Verified:** 9/9 integration tests passed
- Out-of-order block ✅, Sequential approval ✅, Return + Resubmit ✅, Payout ✅, Ledger voucher ✅

---

### ✅ Phase 5 — Salaries & Employee Payroll `[COMPLETE]`

**Models:** `SalaryStructure`, `Payroll`, `PayrollItem`

**Salary Structure:**
| Field | Type |
|---|---|
| Basic, HRA, Conveyance, Medical, Special | Earnings (Float) |
| PF, Professional Tax, TDS | Deductions (Float) |
| `grossEarnings` | Sum of all earnings |
| `totalDeductions` | Sum of all deductions |
| `netSalary` | `grossEarnings - totalDeductions` |

**Seeded Structures:**
| Employee | Basic | Net Monthly |
|---|---|---|
| John Doe | ₹40,000 | ₹59,000 |
| Jane Smith | ₹50,000 | ₹74,300 |

**Payroll Batch Engine:**
- One batch per `month + year` — duplicate blocked (`400`)
- Auto-generates `PayrollItem` slips for all active employees with active structures
- Batch statuses: `DRAFT` → `APPROVED` → `PAID`

**Payout:**
- Individual slip: `POST /salaries/items/:itemId/pay` — single employee disburse
- Full batch: `POST /salaries/payrolls/:id/pay` — settles all pending slips atomically
- Double-payment blocked (`400` if already `PAID`)
- Each payout: decrements account balance, creates `PAYMENT_OUT` + `SALARY_PAYMENT` ledger entry + voucher

**APIs built:**
- `GET/POST /salaries/structures` — configure employee salary packages
- `GET /salaries/payrolls` — list all monthly batches
- `GET /salaries/payrolls/:id` — batch detail + slips
- `POST /salaries/payrolls` — generate draft batch
- `POST /salaries/payrolls/:id/approve` — approve batch
- `POST /salaries/payrolls/:id/pay` — settle entire batch
- `POST /salaries/items/:itemId/pay` — settle individual slip

**Frontend:** `SalaryStructures.tsx` + `PayrollList.tsx` — structures config modal, batch list, slips inspector, disburse widgets

**Verified:** 9/9 integration tests passed
- Draft generation ✅, Duplicate block ✅, Approval ✅, Net salary calculations ✅, Single slip payout ✅, Double-pay block ✅, Ledger + voucher ✅

---

### ✅ Phase 6 — Staff Advances `[COMPLETE]`

**Models:** `Advance`, `AdvanceSettlement`

**Lifecycle State Machine:**
`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` (Sequential Approval) → `APPROVED` → `DISBURSED` → `SETTLEMENT_PENDING` → `SETTLED`

**Sequential Approval Rules (seeded):**
| Amount Range | Approver Sequence |
|---|---|
| ₹0 – ₹5,000 | `ACCOUNTS` |
| ₹5,001 and above | `ACCOUNTS` → `ADMIN` |

**Settlement Handling (3 Cases):**
- **Case A (Exact Match):** Advances used = Advance amount → Status `SETTLED`
- **Case B (Surplus Return):** Advances used < Advance amount → `outstandingAmount` tracks surplus. Cash returned into Cash/Bank account via `POST /advances/:id/return-cash` (`PAYMENT_IN` category `ADVANCE_RETURN`) → Status `SETTLED`
- **Case C (Overspent):** Advances used > Advance amount → Extra amount tracked for reimbursement

**APIs built:**
- `GET/POST /advances` — list/create (scoped: STAFF sees own, ACCOUNTS/ADMIN see all)
- `PATCH /advances/:id` — edit draft/returned advance
- `POST /advances/:id/submit|approve|reject|return` — approval workflow
- `POST /advances/:id/disburse` — payout advance from bank/cash account (`PAYMENT_OUT` category `STAFF_ADVANCE`)
- `POST /advances/:id/settle` — submit usage settlement line items
- `POST /advances/:id/return-cash` — record returned surplus cash

**Frontend:** `AdvancesList.tsx` + `advances.css` — requests grid, stats pills, approval timeline drawer, disburse/settlement/cash-return modals.

**Verified:** 9/9 integration tests passed
- Request creation ✅, Out-of-order approval block ✅, Sequential approval ✅, Disburse from HDFC ✅, Settlement recording (Case B) ✅, Cash return into Cash Box ✅, Double return block ✅

### ✅ Phase 7 — Employee Portal & Self-Service `[COMPLETE]`

**Model:** `EmployeeBankAccount`

**Bank Account Verification Lifecycle:**
`SUBMITTED / PENDING_VERIFICATION` → [Accounts / Admin Review] → `VERIFIED` / `REJECTED`
*(Safety rule: Updating bank details automatically resets status to PENDING_VERIFICATION)*

**APIs built:**
- `GET /employees/me` — fetch current logged-in employee profile
- `GET/POST/PUT /employees/me/bank-account` — view & submit/update bank account details
- `GET /employees/bank-accounts/pending` — queue of pending bank accounts for Accounts/Admin review
- `POST /employees/bank-accounts/:id/verify` — mark bank account as VERIFIED
- `POST /employees/bank-accounts/:id/reject` — mark bank account as REJECTED with reason
- `GET /employees/me/salary-slips` — list paid monthly payslips for logged-in employee
- `GET /employees/me/salary-slips/:id` — fetch complete payslip breakdown (earnings, deductions, gross, net, UTR reference)

**Frontend:** `EmployeePortal.tsx` + `employeePortal.css` — Profile card, Bank verification widget, Accounts/Admin review banner, interactive printable Payslip statement modal with `@media print` CSS rules.

**Verified:** 9/9 integration tests passed
- Profile self-service ✅, Bank details submission ✅, Status check ✅, Pending queue lookup ✅, Verification by Accounts ✅, Auto-reset status on edit ✅, Paid payslips retrieval ✅, Detailed payslip renderer ✅, Privacy enforcement block ✅

### ✅ Phase 8 — Reports & Analytics Dashboard `[COMPLETE]`

**Analytics & Aggregation Engine:**
Executive KPIs derived in real-time from transaction ledgers, accounts, expenses, payrolls, advances & loans.

**APIs built:**
- `GET /reports/dashboard-summary` — executive KPIs (Total Money In, Total Money Out, Net Company Liquidity, Pending Approvals queue)
- `GET /reports/cash-flow` — cash flow analysis & payment mode distribution (Cash, Bank, UPI, Card)
- `GET /reports/expenses-by-category` — category-wise expense aggregations & percentage breakdown
- `GET /reports/expenses-by-employee` — employee & department expense breakdown
- `GET /reports/salary-register` — monthly payroll summaries & statutory deductions (PF, TDS, Professional Tax)
- `GET /reports/advances-and-loans` — staff advance metrics & loan principal/utilization metrics
- `GET /reports/export` — standard CSV file download stream (`ledger`, `expenses`, `salaries`)

**Frontend:** `ReportsDashboard.tsx` + `reports.css` — KPI cards, Payment mode breakdown, Expense category progress bars, Salary register table, Advances & Loans metrics, and CSV Data Exporter buttons.

**Verified:** 8/8 integration tests passed
- Executive summary ✅, Cash flow breakdown ✅, Expense category analytics ✅, Employee/Department analytics ✅, Salary register report ✅, Advances & Loans metrics ✅, CSV Exporter ✅, Permission check (Staff HTTP 403 block) ✅

### ✅ Audit History Module `[COMPLETE]`

**Model:** `AuditLog`

**APIs built:**
- `GET /reports/audit-logs` — read-only immutable audit trail (module & action filters, user email search, pagination)

**Frontend:** `AuditHistory.tsx` + `auditHistory.css` — KPI cards, color-coded module & action pills, filter controls, JSON diff event inspector modal.

**Verified:** 4/4 integration tests passed
- Audit logs retrieval ✅, Module filter (AUTH) ✅, Permission check (Staff HTTP 403 block) ✅, Frontend build ✅

---

### ✅ Phase 9 — User Directory & Role-Based Access Control `[COMPLETE]`

**Database:** Works with existing `User`, `Role`, `Permission`, `UserRole`, and `RolePermission` models.

**APIs built:**
- `GET /users/roles` — Retrieve all roles and their associated permissions
- `GET /users/permissions` — Retrieve all available system-wide permissions
- `PUT /users/roles/:id/permissions` — Dynamically configure permission associations for a specific role

**Frontend:** `Users.tsx` — Complete User Directory (User lists, status activate/deactivate, inline role selection, and user creation) and dynamic Role & Permissions configurations matrix.

**Verified:** 7/7 Dynamic role permission enforcement integration tests passed successfully.

---

### ✅ Phase 10 — SaaS Theme & UI/UX Redesign `[COMPLETE]`

**Overview:** Redesigned the entire frontend styling to support a clean, professional SaaS-style Finance Management portal.

**Styling Tokens & Framework:**
- Centralized Design Tokens/CSS variables inside `index.css` mapped in Tailwind v4 `@theme`.
- Redesigned inputs, selects, textareas, buttons, and tables globally.
- Redesigned Sidebar navigation (navy theme) and Header navigation (white theme with status indicators).
- Responsive grid and card templates.
- Dynamically integrated dashboard reports (`/reports/dashboard-summary`, `/reports/cash-flow`, `/reports/expenses-by-category`) with custom comparative bar charts, and created a scoped fallback dashboard for staff roles.

**Verified:** Full compilation check, routing verification, and role authentication checks passed successfully.

---

### ✅ Phase 11 — Super Admin Deletions, Custom Role Creation & Resilient Queries `[COMPLETE]`

---

### ✅ Phase 12 — Leave Management System Module `[COMPLETE]`

**Models:** `LeaveType`, `LeavePolicy`, `LeaveBalance`, `LeaveRequest`, `LeaveApproval`, `Holiday`

**Key Features & Engines:**
- **Leave Application Engine:** Auto-calculates total working days between `fromDate` and `toDate` excluding weekends & company holidays based on policy, supports `FULL_DAY` and `HALF_DAY` (0.5 days), file attachment upload, overlap validation, and over-draw balance validation.
- **Atomic Balance & Approval Engine:** Prisma transactions for applying, approving, rejecting, and cancelling leave requests. Auto updates `allocated`, `used`, `pending`, `remaining` balances (`remaining = allocated + carriedForward - used - pending`).
- **Configurable Leave Types & Policies:** Configurable quotas for CL, SL, EL, Paid, LWP, Optional, Half Day, carry-forward limits, and working day rules.
- **Unified Frontend (`LeaveManagement.tsx`):**
  - **My Leaves:** Self-service employee quota cards, Apply modal with live calculator, My History table, and cancel action.
  - **Approvals Queue:** Admin/SuperAdmin queue for pending team leave requests with approve/reject modals.
  - **Leave Calendar:** Team leave calendar view of approved leaves & holidays.
  - **Team Balances & Policies:** Super Admin matrix of all employee balances with manual adjustment modal and policy settings.
  - **Holidays Manager:** Company holiday list manager.
- **Permissions:** 9 new granular leave permissions (`LEAVE_VIEW`, `LEAVE_APPLY`, `LEAVE_APPROVE`, `LEAVE_REJECT`, `LEAVE_CANCEL`, `LEAVE_MANAGE`, `LEAVE_BALANCE_MANAGE`, `LEAVE_REPORT_VIEW`, `LEAVE_POLICY_MANAGE`).

**Verified:** 5/5 Automated integration tests passed (`scratch/run_leave_tests.ts`). Both frontend and backend TypeScript compilation checked clean with 0 errors.

**Overview:** Implemented secure user soft-deletions restricted exclusively to `SUPER_ADMIN` to preserve relational financial histories, enabled dynamic custom role creation via UI/API, restricted self role-permissions updates, filtered out `SUPER_ADMIN` accounts/roles from Admin views, enabled instant permission updates on the fly without logout, and updated frontend pages (`AdvancesList.tsx`, `Payments.tsx`, `ExpensesList.tsx`) to query auxiliary metadata with graceful fallbacks (so pages load successfully even for highly restricted user roles).

**APIs built / updated:**
- `DELETE /users/:id` — Soft-deletes a user (updates status to `'DELETED'` and appends `_deleted_timestamp` to email), preserving transaction history. Requires role `SUPER_ADMIN`.
- `POST /users/roles` — Creates a new custom role with uppercase name mapping, description, and empty permissions mapping. Requires `ROLE_CREATE` permission.
- `GET /users/roles` & `GET /users` — Exclude `'SUPER_ADMIN'` role and users if requested by a non-Super-Admin user.
- `PUT /users/roles/:id/permissions` — Blocks any non-Super-Admin from modifying their own role's permissions or the `SUPER_ADMIN` role permissions.
- `POST /users` & `PATCH /users/:id/roles` — Blocks any non-Super-Admin from assigning the `SUPER_ADMIN` role or editing a Super Admin user.
- **Dynamic Session Resolution**: Re-queries user roles/permissions dynamically in the `authenticate` middleware on every API call to ensure changes apply instantly.

**Frontend:**
- `Users.tsx` — Disables checkbox selections and shows a self-modification warning when the logged-in user's own role is selected. Adds a "+ Create Custom Role" button and form modal inside the Roles & Permissions panel (visible to users with `ROLE_CREATE` permission) to add new roles dynamically. Dynamically filters out `SUPER_ADMIN` from role/user views and edit controls for non-Super-Admins.
- `DashboardLayout.tsx` — Performs a silent `/auth/me` fetch on every route change (page navigation) to dynamically sync the logged-in user context in `localStorage` without requiring logout.
- **Resilient Multi-Query Handling**: Updated `AdvancesList.tsx`, `Payments.tsx`, and `ExpensesList.tsx` to handle auxiliary queries (such as employee directory lists or account balances) using `.catch(() => ({ data: { data: [] } }))` fallbacks. This prevents a `403 Forbidden` response on non-permitted endpoints from crashing the main page loading sequences.

**Verified:** 15/15 Integration tests passed successfully, verifying custom role creation permissions, role restrictions, self-modification blocks, role filtering, status edits, and soft deletes.

---

### ✅ Phase 12 — User Details & Phone Authentication `[COMPLETE]`

**Database:** Added optional `name` and `phone` to `User` model, with `phone` being a unique index.

**APIs updated:**
- `POST /users` (Create User) — Now accepts and stores `name` and `phone`.
- `GET /users` & `GET /users/:id` — Return `name` and `phone`.
- `POST /auth/login` — Allows passing either `email` or `phone` as the login identifier.

**Frontend:**
- `Users.tsx` — Form captures Name and Phone Number; User table displays them.
- `Login.tsx` — Updated to prompt for "Email or Phone Number".

**Verified:** 100% TypeScript checks passed; DB migration successfully pushed.

---

### ✅ Phase 13 — Employee Portal Auto-Sync & Profile Edits `[COMPLETE]`

**Database:** Added `photo` to `Employee` model.

**APIs updated:**
- `GET /employees/me` — Auto-creates an `Employee` record if one is not linked to the logged-in user, pulling `name`, `email`, and `phone` from their `User` account.
- `PUT /employees/me` — New endpoint allowing users to update their profile (`name`, `address`, `photo`). Also syncs the updated name back to the `User` account.

**Frontend:**
- `EmployeePortal.tsx` — Displays a new "Edit Profile Details" modal form.
- Locked `email` and `mobile` fields in the form to prevent employees from changing them directly.

**Verified:** 100% TypeScript checks passed; DB migration successfully pushed.

---

### ✅ Phase 14 — Super Admin Account Management `[COMPLETE]`

**APIs updated:**
- `DELETE /accounts/:id` — Added `deleteAccount` to softly delete accounts (marks `deletedAt`).
- Security tightened: `PATCH` (edit) and `DELETE` (delete) endpoints on `/accounts/:id` are now secured with `authorize('SUPER_ADMIN_ONLY')`. Because only Super Admin holds the wildcard `*` permission, ONLY Super Admins can access these endpoints.

**Frontend:**
- `Accounts.tsx` — Added Edit (Pencil) and Delete (Trash) buttons to each account card.
- Built an Edit Account modal that allows Super Admins to change the account display name and toggle status (Active/Inactive).
- Buttons only render for Super Admin users.

**Verified:** 100% TypeScript compilation check on backend and frontend successfully passed.

---

### ✅ Phase 15 — Custom Role Management `[COMPLETE]`

**APIs updated:**
- `PUT /users/roles/:id` — Added `updateRole` to allow renaming and changing descriptions of custom roles.
- `DELETE /users/roles/:id` — Added `deleteRole` to permanently delete a custom role, provided no users are currently assigned to it.
- **Security:** Added strict checks preventing `SUPER_ADMIN`, `ADMIN`, `ACCOUNTS`, `HR`, `STAFF`, and `MANAGER` system roles from being modified or deleted.

**Frontend:**
- `Users.tsx` — Hovering over any non-system role in the Role Matrix panel now reveals Edit and Delete action buttons.
- Integrated a new "Edit Custom Role" modal form.
- Added deletion confirmation prompt that refreshes the interface seamlessly on success.

**Verified:** 100% TypeScript compilation check on backend and frontend successfully passed.

---

### ✅ Phase 16 — Custom Role Refinements, Admin User Edits & Tenant Scoping Fixes `[COMPLETE]`

**Overview:** 
Cleaned up role protections to allow editing/deleting standard roles like ADMIN, ACCOUNTS, and STAFF, resolved database soft-deleted user constraint blockages on role removal, restricted user management actions entirely to `SUPER_ADMIN`, added user profile details editing for Super Admins, fixed role selection dropdowns for user creations by ADMIN, and fixed missing company ID isolation for payment category creations.

**APIs updated:**
- `DELETE /users/roles/:id` — Updated logic to exclude soft-deleted users when checking if a role is in use (only blocks deletion if active/inactive users are assigned).
- `PATCH /users/:id` — Upgraded endpoint validation and database transactions to support updating the operator's name and phone number (synchronized atomically with their Employee profile details).
- `GET /users/roles` — Updated `authorize` route parameters to permit access to users with either `ROLE_VIEW` or `USER_CREATE` permission, resolving empty dropdown lists on user creations.
- `GET /payment-categories` — Updated `authorize` route parameters to accept `SETTINGS_VIEW`, `PAYMENT_VIEW`, or `PAYMENT_CREATE` permissions, allowing non-admin payment users to load dynamic categories in payment forms.
- `PATCH /payment-categories/:id` & `DELETE /payment-categories/:id` — Restricted access strictly to `SUPER_ADMIN_ONLY`, preventing non-Super-Admins from editing or deleting existing categories.
- `PUT /approval-rules/:id` & `DELETE /approval-rules/:id` — Restricted access strictly to `SUPER_ADMIN_ONLY`, preventing non-Super-Admins from editing or deleting approval rules.
- Approval Rules API routes (`/approval-rules` GET/POST/PUT/DELETE) — Fully locked down under a global `SUPER_ADMIN_ONLY` guard.
- `PUT /expenses/categories/:id` & `DELETE /expenses/categories/:id` — Restricted access strictly to `SUPER_ADMIN_ONLY` (Wildcard `*` only) to secure expense category modification from backend.
- `POST /expenses/categories` — Restricted access strictly to `SUPER_ADMIN` and `ACCOUNTS` / `ACCOUNT_I` roles, preventing standard roles (like `STAFF` or `ADMIN`) from adding new categories via API.
- `POST /expenses` (triggerWorkflow default flow) — Set default fallback sequence to `['SUPER_ADMIN', 'ADMIN', finalAccountsRoleName]` so standard claims follow this hierarchy, dynamically resolving the exact Accounts role name (like `ACCOUNT_I` or `ACCOUNTS`) from the database to map workflow steps accurately. Updated approval/reject/return steps verification logic in `expense.controller.ts` and `advance.controller.ts` to cleanly match custom roles (e.g. `ACCOUNT_I` to `ACCOUNTS`, `ADMIN_II` to `ADMIN`).

**Frontend:**
- `Users.tsx` — Restricted the "Actions" column (Edit Info, Change Role, Extra Perms, Activate/Deactivate, Delete) strictly to `SUPER_ADMIN` context.
- Added a new Edit User Details modal panel for Super Admins to seamlessly modify name, phone number, and email.
- Resolved hardcoded fallback properties defaults that caused creation crashes when standard roles were missing.
- `App.tsx` & `ProtectedRoute.tsx` — Updated router guards to accept permission lists, aligning them with the sidebar configuration to prevent Access Denied errors on pages where users hold creation/approval rights (e.g. `EXPENSE_CREATE`) but not general view rights.
- `PaymentCategories.tsx`, `Sidebar.tsx`, `App.tsx` & Backend Routes — Migrated ad-hoc `SETTINGS_VIEW`/`SETTINGS_UPDATE` permissions to existing database-assignable `COMPANY_VIEW`/`COMPANY_UPDATE` permissions. Added UI permission guards in `PaymentCategories.tsx` using `COMPANY_UPDATE` to conditionally display "+ Add Category" button, and `isSuperAdmin` to conditionally display Edit/Delete action buttons.
- `ApprovalRules.tsx`, `Sidebar.tsx` & `App.tsx` — Completely restricted the entire Approval Rules module (route paths, sidebar link rendering, dynamic lists fetching) to `SUPER_ADMIN` role context only. Non-Super-Admins can no longer see the item in the sidebar or access `/approval-rules` manually. Updated `ApprovalRules.tsx` to dynamically query and load all existing database roles from `/users/roles` rather than relying on a hardcoded list, enabling instant mapping of custom user roles (such as `ACCOUNT_I` and `ACCOUNT_II`) and filtering out non-existent ones.
- `Sidebar.tsx` & `App.tsx` — Restricted the "Company Profile" sidebar menu link and `/company-settings` route path exclusively to the `SUPER_ADMIN` role context.
- `user.controller.ts` & `Users.tsx` — Upgraded the 'Create User Account' form and backend schemas to support entering a custom employee code or checking a box to generate it automatically, checking for code duplicate conflicts inside the database transaction. Also enabled editing the employee code inside the 'Edit User Details' modal, validating its uniqueness during updates, and updated soft-deletions to set `phone: null` to free up unique phone numbers.
- `employeeCode.ts`, `user.controller.ts` & `employee.controller.ts` — Built a smart sequential generator helper that dynamically parses the company's existing employee codes list, selects the most active pattern series prefix (e.g. `Htech-`), and automatically increments the counter (e.g. `Htech-005` -> `Htech-006`), ignoring outliers.
- `ExpensesList.tsx` — Updated categories action buttons rendering inside the Expense Claim modal. The `+` (Add) icon is displayed only for `SUPER_ADMIN` and `ACCOUNTS` / `ACCOUNT_I` roles, whereas `Edit` (pencil) and `Delete` (trash) options are hidden for non-Super-Admins.
- `ExpensesList.tsx` & `AdvancesList.tsx` — Updated disbursement/payout eligibility guards (`canPay` and `canDisburse`) to support custom Accounts roles (starting with `ACCOUNT`, like `ACCOUNT_I`), allowing them to disburse funds after approvals are completed.
- `Sidebar.tsx`, `AdvancesList.tsx` & Backend Controllers (`expense.controller.ts`, `advance.controller.ts`, `employee.controller.ts`) — Generalized the user role classification so that custom employee/staff roles (like `EMPLOYER`) are correctly classified as non-administrative staff. This automatically hides administrative navigation pages (`Salaries`, `Payroll Batches`, `Staff Advances`) from their sidebar layout and restricts query results/permissions strictly to their own self-service data scope.

**Verified:** Zero TypeScript compilation errors. All API routes compiled and verified successfully.

---

### ✅ Phase 17 — Dynamic Leave Policy & Custom Rules Engine `[COMPLETE]`

**Overview:**
Replaced fixed/hardcoded Leave Policy modal checkboxes with a fully dynamic Custom Policy Rules Builder. Super Admins can now add custom leave policy rules with custom titles, toggle them ON/OFF, delete unwanted rules, and use 1-click quick suggestion badges.

**Key Technical Details:**
- **Database:** Added `customRules String? @map("custom_rules")` to `LeavePolicy` Prisma schema and synced via `prisma db push`.
- **Backend APIs:** Updated `GET`, `POST`, `PUT` policy endpoints in `leave.controller.ts` to parse/serialize dynamic `customRules` array while preserving backward calculation compatibility for working days.
- **Frontend Dashboard:** Updated `LeaveManagement.tsx` with dynamic custom rules builder modal and styled rule badges in Settings tab view.

**Verified:** Both frontend and backend TypeScript compilation checked clean with zero errors (`npx tsc --noEmit`).

---

### ✅ Phase 18 — Super Admin Interactive Leave Quotas & Sync Engine `[COMPLETE]`

**Overview:**
Super Admin can now directly manage, adjust, and bulk sync Leave Quotas per employee and per leave type directly from the UI.

**Key Technical Details:**
- **Quota Adjustments Modal & APIs:** Added `POST /leaves/balance/adjust` endpoint and frontend adjustment modal allowing Super Admin to edit Allocated Days, Used Days, and Carried Forward Days with live balance previews.
- **Bulk Quota Sync Engine:** Built `POST /leaves/balance/sync` to bulk update/create all active employees' leave quota balances to match active Leave Type annual quotas in 1 click.
- **Auto-Sync on Quota Edit:** Updating a Leave Type's `annualQuota` automatically updates all employee balances for that leave type.
- **Un-used Quota Cleanup:** Deactivating a Leave Type (e.g. test leave type `aa (AA)`) automatically purges un-used quota balances so they disappear from cards.
- **Super Admin Employee Selector:** Added employee filter dropdown to view/adjust any specific employee's leave quotas or own personal quotas.

**Verified:** Both frontend and backend TypeScript compilation checked clean with zero errors (`npx tsc --noEmit`).

---

### ✅ Phase 19 — Geofencing & Selfie-based Attendance System `[COMPLETE]`

**Overview:**
A complete geofenced and selfie-verified attendance system mapping office timings, grace periods, allowed breaks, and location radius restrictions with dynamic admin configurations and employee dashboard logs.

**Key Technical Details:**
- **Database Schema:** Added `AttendanceConfig` (timings + location coordinates + `halfDayMinutes`), `AttendanceRecord` (check-in/out stamps + `isHalfDay` flag), and `AttendanceBreak` (break timers) Prisma models.
- **Backend APIs:** Created 10 Express API endpoints verifying geolocation coordinates via Haversine distance formula, calculating late status / early departures, tracking cumulative breaks, computing half-day penalties on total net working hours, and generating monthly present/late stats. Added multer to handle selfie uploads stored in the `/uploads` directory.
- **Frontend Dashboard:** Built `AttendanceManagement.tsx` (live clock, timeline tracking, check-in/out circle triggers, active break controllers, history grid with Half Day status badges, admin dashboard reporting tables and KPIs) and `AttendanceConfig.tsx` (timings inputs, half-day work hours threshold input, selfie toggling, geofence radius settings, and 1-click GPS populate tool).
- **Interactive KPI Filters:** Made the top dashboard KPI cards (Present, Late, Absent, Total) act as functional filter buttons on the frontend. Clicking a card dynamically filters the employee attendance list below it and shows visual glowing active indicator borders.
- **Absent Records Integration:** Enhanced backend endpoint `GET /attendance/all` to generate virtual `ABSENT` records for all active employees who haven't checked in for the queried date.
- **Date Range Filtering:** Added a "Single Date" vs "Date Range" filter toggle widget next to the attendance table, with custom From Date and To Date selectors for monthly/custom duration reporting.
- **CSV/Excel Export:** Integrated an "Export CSV" option next to filters, allowing admins to instantly download the active filtered list as a clean, spreadsheet-compatible CSV file with support for Half-Day status details.
- **Work From Home (WFH) Controls:** Implemented employee-specific WFH settings. Super Admin can toggle 'Allow WFH' for any employee in a new 'WFH Settings' dashboard tab. If WFH is allowed, coordinates/geofence checks are bypassed on both frontend (check-in action button and GPS dot status are enabled) and backend (check-ins allowed from anywhere). Otherwise, check-ins from outside the office radius are strictly blocked.
- **Flexible Break Triggering:** Removed strict backend time-of-day checks during `startBreak` so employees can click the break button at any point during their shift (while still calculating total break durations correctly against limits).
- **Manual Attendance Overrides:** Built manual attendance backend endpoints and frontend overlays. Super Admin can click "+ Manual Attendance" to select an employee and input check-in/out timings for any date. The backend automatically calculates work hours, late minutes, early exit, and half-day status relative to shift timings config. Resolved overlay HTML div tag balancing errors.
- **Mobile web selfie:** Integrated native camera stream capture via `navigator.mediaDevices.getUserMedia` for selfie-verified check-in validation.

**Access Restrictions:** Restricted visibility and routing access for the global Attendance Settings page/sidebar menu strictly to `SUPER_ADMIN` role and wildcard (`*`) permission holders. Standard `ADMIN` users can access the main Attendance Dashboard, WFH Settings tabs, and Manual overrides. Standard employees are fully blocked from accessing any admin-related dashboard layouts.

**Verified:** Both frontend and backend TypeScript compilation checked clean with zero errors (`npx tsc --noEmit`).

---

### ✅ Phase 20 — Password Management, Live Polling & Auto-Checkout `[COMPLETE]`

**Overview:**
Security enhancements, real-time background synchronization, and automatic shift closing features.

**Key Technical Details:**
- **Auto-Checkout Cron Job:** Scheduled a daily midnight cron job (`node-cron`) at 00:01 AM that checks out any employee who forgot to check out the previous day, calculating exact work hours, closing active breaks, and setting appropriate half-day or early exit statuses.
- **Universal Change Password:** Created a Change Password modal triggered directly from the global layout Header (`Header.tsx`) accessible by any user role (Admin, Accounts, Staff, etc.) to update their password securely via dynamic JWT checks.
- **Super Admin Password Reset:** Built a backend endpoint (`POST /users/:id/reset-password`) and a custom frontend modal in the Users Directory (`Users.tsx`) enabling Super Admins to reset the password of any user in case they forget it.
- **Real-Time Data Polling:** Added a lightweight `useAutoRefresh` hook running silent background syncs (every 30s) across all dashboard pages (Expenses, Payments, Ledger, Attendance, Leaves, Users, Payroll, etc.) to guarantee real-time updates across multiple users without page flicker.

**Verified:** Both frontend and backend compilation checked clean with zero errors.

---

## 🏆 ALL PHASES & MODULES FULLY UNLOCKED, IMPLEMENTED & VERIFIED! 🏆

---

## 1. Purpose

This document defines the business brain of the system.

The system must always answer:

> Paisa kahan se aaya, kis account me aaya, kahan gaya, kisliye gaya, kisne use kiya, proof kya hai, kisne approve kiya, aur kitna paisa abhi receive/pay/return hona baaki hai?

The application is not only an expense tracker. It is a financial-control and employee-management system.

---

# 2. Core Mental Model

Everything revolves around five concepts:

```text
PEOPLE
  ↓
MONEY
  ↓
PURPOSE
  ↓
PROOF
  ↓
APPROVAL
```

Every important financial event must be traceable.

```text
Source
→ Account
→ Transaction
→ Purpose
→ Person/Party
→ Proof
→ Approval
→ Settlement
→ Report
```

---

# 3. Golden Rules

## Rule 1 — Every Money Movement Has a Reason

A transaction must have a meaningful purpose.

Bad:

```text
Amount: ₹10,000
```

Good:

```text
Amount: ₹10,000
Purpose: Office stationery purchase
```

---

## Rule 2 — Every Outgoing Payment Has a Source

The system must know where the money came from:

- Cash
- Bank
- UPI
- Card
- Other company account

---

## Rule 3 — Approved and Paid Are Different

An expense can be approved but not yet paid.

```text
Approved ≠ Paid
```

This is important for correct reporting.

---

## Rule 4 — Money Movement Must Use the Ledger

No module should independently invent or modify financial balances.

All confirmed money movement must go through the central transaction/ledger service.

---

## Rule 5 — Never Silently Delete Financial History

If a confirmed transaction is wrong:

```text
Reverse / Cancel
```

Do not permanently delete it.

---

## Rule 6 — Every Sensitive Action Is Audited

Examples:

- Expense approval
- Payment confirmation
- Salary approval
- Bank account verification
- Loan repayment
- Transaction reversal

---

# 4. Financial Brain

The system maintains accounts.

Example:

```text
HDFC Bank
Office Cash
ICICI Bank
UPI
Company Card
```

Every account has a balance.

Money In:

```text
Balance + Amount
```

Money Out:

```text
Balance - Amount
```

Transfer:

```text
Source - Amount
Destination + Amount
```

A transfer is not income or expense.

---

# 5. Transaction Classification

Every financial movement should be classified.

## Money In

```text
CLIENT_PAYMENT
INTEREST_INCOME
LOAN_RECEIVED
REFUND_RECEIVED
CUSTOMER_ADVANCE
OTHER_INCOME
```

## Money Out

```text
OFFICE_EXPENSE
VENDOR_PAYMENT
STAFF_REIMBURSEMENT
STAFF_ADVANCE
SALARY_PAYMENT
LOAN_REPAYMENT
ASSET_PURCHASE
CLIENT_REFUND
OTHER_PAYMENT
```

## Internal

```text
ACCOUNT_TRANSFER
ADJUSTMENT
REVERSAL
```

---

# 6. Money In Brain

When money is received:

```text
Who paid?
↓
Why?
↓
How much?
↓
How was it received?
↓
Which company account received it?
↓
Reference/proof?
↓
Confirm
```

Example:

```text
Client ABC
₹50,000
Bank Transfer
HDFC Bank
Invoice INV-1001
UTR attached
```

After confirmation:

```text
HDFC Balance +₹50,000
```

---

# 7. Money Out Brain

Before payment:

```text
Who will receive?
↓
Why?
↓
Amount?
↓
Payment mode?
↓
Which account?
↓
Proof/bill?
↓
Approval required?
↓
Approval complete?
↓
Pay
```

After payment:

```text
Account Balance - Amount
```

---

# 8. Expense Brain

An expense has two separate stages:

```text
Expense Event
+
Financial Payment
```

Example:

Staff spends ₹2,000 personally.

First:

```text
Expense Created
```

Then:

```text
Expense Approved
```

Then:

```text
Reimbursement Paid
```

Finally:

```text
Expense Closed
```

The expense record and Payment Out record should be linked.

---

# 9. Staff Expense Brain

Staff should be able to submit:

```text
Date
Category
Amount
Purpose
Payment Mode
Bill/Screenshot
Remarks
```

Examples:

```text
UPI → Screenshot
Card → Card Bill
Cash → Receipt/Voucher
```

Workflow:

```text
STAFF
 ↓
SUBMIT
 ↓
ACCOUNTS VERIFY
 ↓
ADMIN APPROVE
 ↓
REIMBURSE
 ↓
CLOSE
```

---

# 10. Expense Decision Brain

When staff submits an expense, ask:

### Is it a company/business expense?

If no:

```text
Reject
```

If yes:

### Is proof required?

If yes and missing:

```text
Return for Correction
```

If proof is acceptable:

```text
Verify
```

### Does this require admin approval?

If yes:

```text
Send to Admin
```

Otherwise:

```text
Approve
```

---

# 11. Staff Advance Brain

Advance is not automatically an expense.

Example:

```text
Staff receives ₹10,000 advance
```

Initially:

```text
Advance Outstanding = ₹10,000
```

Staff submits:

```text
₹7,500 valid expenses
```

System calculates:

```text
Advance = ₹10,000
Used = ₹7,500
Balance = ₹2,500
```

Then:

```text
₹2,500 returned
```

Final:

```text
Outstanding = ₹0
```

---

# 12. Advance Settlement Brain

Possible outcomes:

## Case A — Exact Usage

```text
Advance ₹10,000
Expense ₹10,000
```

Result:

```text
Closed
```

## Case B — Less Usage

```text
Advance ₹10,000
Expense ₹7,500
```

Result:

```text
Staff returns ₹2,500
```

## Case C — More Usage

```text
Advance ₹10,000
Expense ₹12,000
```

Result:

```text
Additional reimbursement ₹2,000
```

The system should not simply increase the advance. It should create an additional reimbursement/payment.

---

# 13. Returnable Money Brain

Some payments are expected to come back.

Example:

```text
₹20,000 given to employee/vendor
Purpose: Temporary business requirement
Return date: 20 Aug 2026
```

System creates a receivable.

Track:

```text
Original Amount
Returned Amount
Outstanding
Expected Date
Actual Date
Status
```

Status:

```text
PENDING
PARTIALLY_RETURNED
RETURNED
OVERDUE
```

---

# 14. Loan Brain

Loan received is not company income.

It is a liability.

Example:

```text
Loan Received = ₹5,00,000
```

System records:

```text
Loan Outstanding = ₹5,00,000
```

The money may then be used for:

```text
Equipment
Stock
Office
Business Expenses
Other
```

Each utilization should be linked to the loan.

---

# 15. Loan Utilization Brain

Example:

```text
Loan Received ₹5,00,000

Equipment ₹1,50,000
Stock ₹1,00,000
Office ₹50,000
Other ₹50,000
```

System calculates:

```text
Total Loan = ₹5,00,000
Utilized = ₹3,50,000
Unallocated = ₹1,50,000
```

Utilization cannot exceed the available loan amount.

---

# 16. Loan Repayment Brain

Loan repayment contains:

```text
Principal
+
Interest
```

Example:

```text
Repayment ₹20,000
Principal ₹17,000
Interest ₹3,000
```

Loan principal outstanding decreases by:

```text
₹17,000
```

Interest is recorded separately.

---

# 17. Employee Brain

Employee is a core entity.

Employee has:

```text
Profile
Department
Designation
Salary
Bank Account
Expenses
Advances
Salary History
Documents
User Login
```

Employee can only see their own sensitive information unless role permissions allow otherwise.

---

# 18. Employee Bank Account Brain

Bank account lifecycle:

```text
SUBMITTED
↓
PENDING_VERIFICATION
↓
VERIFIED
```

or:

```text
REJECTED
```

If employee changes account:

```text
Old Account = Historical
New Account = Pending Verification
```

Salary should not be paid to an unverified bank account.

---

# 19. Salary Brain

Salary processing is monthly.

```text
Employee
↓
Salary Structure
↓
Generate Salary
↓
Calculate Earnings
↓
Calculate Deductions
↓
Net Salary
↓
Accounts Review
↓
Admin Approval
↓
Payment
↓
Salary Slip
```

---

# 20. Salary Calculation Brain

Basic structure:

```text
Gross Salary
= Total Earnings
```

Then:

```text
Net Salary
= Gross Salary - Total Deductions
```

Possible earnings:

```text
Basic
HRA
Conveyance
Special Allowance
Other Allowance
```

Possible deductions:

```text
Advance Recovery
Attendance/Leave Deduction
Other Configured Deduction
```

Statutory deductions can be added later.

---

# 21. Salary State Machine

```text
DRAFT
 ↓
GENERATED
 ↓
UNDER_REVIEW
 ↓
APPROVED
 ↓
PAYMENT_PENDING
 ↓
PAID
```

Alternative:

```text
UNDER_REVIEW
 ↓
RETURNED
 ↓
GENERATED / EDITED
```

Rejection/cancellation must retain history.

---

# 22. Salary Slip Brain

Salary slip should become available after salary is finalized according to company policy.

Minimum data:

```text
Company
Employee
Employee ID
Department
Designation
Month
Earnings
Deductions
Gross
Net
Payment Date
Payment Status
```

Employee can:

```text
View
Download
Print
```

---

# 23. Approval Brain

Approval is a generic engine.

It should not be hard-coded separately for every module.

Possible modules:

```text
Expense
Payment Out
Advance
Salary
Bank Account
Loan
```

Approval decision:

```text
APPROVE
REJECT
RETURN
```

---

# 24. Approval by Amount

Example configurable rules:

```text
₹0–₹5,000
→ Accounts

₹5,001–₹50,000
→ Accounts + Admin

Above ₹50,000
→ Admin/Super Admin
```

These values must be configurable.

---

# 25. Role Brain

## SUPER_ADMIN

Everything.

## ADMIN

Management and approval.

## ACCOUNT

Financial operations.

## STAFF

Self-service only.

Permissions must be granular.

Do not use only:

```text
if role === "ADMIN"
```

Use permissions where possible:

```text
expense.approve
salary.approve
payment_out.create
```

---

# 26. Dashboard Brain

Dashboard is an aggregation of system truth.

Important numbers:

```text
Money In
Money Out
Cash
Bank
Expenses
Receivables
Advances
Loans
Salary Payable
Salary Paid
Pending Approvals
```

Dashboard must not maintain a separate fake balance.

It should derive values from authoritative records.

---

# 27. Balance Brain

The transaction ledger is the source of truth.

For an account:

```text
Opening Balance
+
Confirmed Money In
-
Confirmed Money Out
+
Transfers In
-
Transfers Out
+
Adjustments
=
Current Balance
```

Cached balance can be stored for performance, but it must remain consistent with the ledger.

---

# 28. Transfer Brain

If:

```text
HDFC → Cash ₹10,000
```

Then:

```text
HDFC -₹10,000
Cash +₹10,000
```

But:

```text
Total Company Funds = Same
```

Never classify account transfer as an expense.

---

# 29. Voucher Brain

Every approved/confirmed expense or payment can produce a voucher.

Voucher:

```text
Unique Number
Date
Party
Amount
Purpose
Payment Mode
Account
Reference
Proof
Created By
Verified By
Approved By
```

Voucher number must never duplicate.

---

# 30. Document Brain

Documents are evidence.

Examples:

```text
Invoice
Receipt
UPI Screenshot
Card Bill
Bank Proof
Loan Agreement
Salary Document
```

Document access must follow the same permission as the linked record.

A staff member must not be able to guess a file URL and access another employee's document.

---

# 31. Audit Brain

Every important change answers:

```text
Who?
What?
When?
Which record?
Old value?
New value?
```

Examples:

```text
Harikesh approved EXP-0012
Accounts verified bank account BA-003
Admin approved salary SAL-2026-08-001
```

Audit logs are append-only for normal users.

---

# 32. Financial Safety Brain

Before any outgoing payment:

```text
Is account active?
↓
Is amount valid?
↓
Is purpose present?
↓
Is payee present?
↓
Is approval required?
↓
Is approval complete?
↓
Is sufficient balance available?
↓
Has this request already been processed?
↓
Confirm payment
```

---

# 33. Duplicate Payment Brain

Critical financial requests should use an idempotency key.

If the same request is received twice:

```text
First Request → Create Payment
Second Request → Return Existing Payment
```

Never create duplicate money movement because of a network retry.

---

# 34. Reversal Brain

If a payment is wrong:

```text
Original Payment
      ↓
Reversal
```

Do not delete the original.

The reversal must reference:

```text
original_transaction_id
reason
created_by
approved_by
date
```

---

# 35. Status Brain

Use explicit statuses.

Do not use only:

```text
true / false
```

Examples:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
RETURNED
REJECTED
APPROVED
PAYMENT_PENDING
PAID
REIMBURSED
CLOSED
CANCELLED
REVERSED
```

---

# 36. Notification Brain

Notifications are event-driven.

Examples:

```text
Expense Submitted
→ Accounts Notification

Expense Approved
→ Staff Notification

Salary Approved
→ Accounts Notification

Salary Paid
→ Employee Notification

Returnable Overdue
→ Admin Notification

Loan Due
→ Accounts/Admin Notification
```

Notifications should not block critical financial transactions.

Use background jobs where appropriate.

---

# 37. Reporting Brain

Reports should be based on authoritative financial records.

Examples:

```text
Daily Cash Flow
Monthly Cash Flow
Expense by Category
Expense by Employee
Account-wise Payment
Salary Register
Loan Utilization
Receivables
Advance Outstanding
```

Reports must respect permissions.

Staff should never receive the entire company financial report.

---

# 38. Date Brain

Financial records must store exact timestamps.

Also store business dates separately where needed.

Use one configured company timezone.

Do not depend blindly on server timezone.

---

# 39. Amount Brain

All financial amounts must use exact decimal arithmetic.

Never rely on binary floating-point for final money calculations.

Database:

```text
DECIMAL(18,2)
```

or suitable higher precision when required.

---

# 40. Data Ownership Brain

Every record belongs to a company.

```text
company_id
```

must be used for company-level records.

Authorization must always verify:

```text
user.company_id === record.company_id
```

Never trust IDs supplied by the frontend.

---

# 41. Employee Privacy Brain

Sensitive employee information includes:

```text
Salary
Bank Account
Personal Documents
Personal Contact Details
```

Access must be permission-controlled.

Staff:

```text
Own data only
```

Accounts:

```text
Financial information needed for work
```

Admin:

```text
Management information
```

Super Admin:

```text
Full access
```

---

# 42. Important Business Distinctions

The system must keep these concepts separate:

```text
Expense ≠ Payment
Approved ≠ Paid
Advance ≠ Expense
Loan ≠ Income
Transfer ≠ Expense
Receivable ≠ Income
Salary Generated ≠ Salary Paid
Bank Account Submitted ≠ Bank Account Verified
```

These distinctions prevent incorrect reporting.

---

# 43. Example — Complete Money Journey

Client pays:

```text
₹1,00,000
```

Into:

```text
HDFC Bank
```

Then company spends:

```text
₹20,000 Office Equipment
₹10,000 Staff Advance
₹15,000 Vendor Payment
```

System should show:

```text
Received = ₹1,00,000
Used = ₹45,000
Remaining = ₹55,000
```

If ₹5,000 of staff advance is returned:

```text
Net utilization = ₹40,000
```

The transaction history must show every step.

---

# 44. Example — Staff Expense

Staff pays:

```text
Petrol ₹1,200
```

Using UPI.

Staff uploads screenshot.

Flow:

```text
Create Expense
↓
Upload Screenshot
↓
Submit
↓
Accounts Verify
↓
Admin Approve
↓
Company Reimburses ₹1,200
↓
Payment Out
↓
Staff Expense = Reimbursed
```

---

# 45. Example — Salary

Employee:

```text
Net Salary ₹30,000
```

Flow:

```text
Bank Account Added
↓
Accounts Verify
↓
Admin Approve
↓
Salary Generated
↓
Accounts Review
↓
Admin Approve
↓
₹30,000 Paid
↓
UTR Saved
↓
Salary = PAID
↓
Salary Slip Generated
↓
Employee Downloads
```

---

# 46. Example — Loan Utilization

Loan:

```text
₹5,00,000
```

Received in:

```text
ICICI Bank
```

Utilization:

```text
Equipment ₹2,00,000
Office ₹50,000
Stock ₹1,00,000
```

System:

```text
Loan = ₹5,00,000
Utilized = ₹3,50,000
Unallocated = ₹1,50,000
```

The utilization records should link to actual transactions.

---

# 47. What the System Should Never Allow

1. Payment without an account/source.
2. Financial record without company ownership.
3. Staff viewing another staff member's salary.
4. Salary payment to an unverified bank account.
5. Duplicate critical payment from retry.
6. Loan utilization above available amount.
7. Advance settlement above outstanding without a valid flow.
8. Silent deletion of confirmed transactions.
9. Client-side-only authorization.
10. Public access to private financial documents.
11. Editing paid salary through a normal edit endpoint.
12. Balance changes outside the transaction/ledger service.

---

# 48. Brain Decision Tree

When any financial action arrives:

```text
START
 │
 ├─ Who is doing it?
 │     ↓
 │   Authenticate
 │
 ├─ Are they allowed?
 │     ↓
 │   Authorize
 │
 ├─ Which company?
 │     ↓
 │   Verify company scope
 │
 ├─ What type of action?
 │     ↓
 │   Payment / Expense / Salary / Loan / Advance
 │
 ├─ What is the purpose?
 │     ↓
 │   Validate
 │
 ├─ Is proof required?
 │     ↓
 │   Validate attachment
 │
 ├─ Is approval required?
 │     ├─ YES → Approval Workflow
 │     └─ NO
 │
 ├─ Is money moving?
 │     ↓
 │   Transaction Service
 │
 ├─ Update ledger/account
 │
 ├─ Create voucher if required
 │
 ├─ Create audit log
 │
 ├─ Send notification
 │
 └─ Return result
```

---

# 49. Development Principle

Develop modules around business capabilities, not just database tables.

Good:

```text
ExpenseService
PaymentService
SalaryService
LoanService
AdvanceService
ApprovalService
```

Avoid building the whole application as:

```text
Controller → Prisma → Response
```

Business rules belong in services.

---

# 50. Final Brain

The system's brain can be summarized as:

```text
             COMPANY MONEY
                   │
       ┌───────────┴───────────┐
       │                       │
     MONEY IN               MONEY OUT
       │                       │
 Client / Loan /           Expense / Salary /
 Interest / Other          Vendor / Advance
       │                       │
       └───────────┬───────────┘
                   │
              ACCOUNT
                   │
             TRANSACTION
                   │
             PURPOSE + PARTY
                   │
                PROOF
                   │
              APPROVAL
                   │
             CONFIRM/PAY
                   │
             LEDGER UPDATE
                   │
          VOUCHER + AUDIT
                   │
          SETTLEMENT/RETURN
                   │
               REPORT
```

For employees:

```text
EMPLOYEE
 ↓
EXPENSE / ADVANCE
 ↓
PROOF
 ↓
ACCOUNTS
 ↓
ADMIN
 ↓
PAYMENT / ADJUSTMENT
 ↓
STATUS
```

For salary:

```text
EMPLOYEE
 ↓
BANK ACCOUNT
 ↓
VERIFY
 ↓
APPROVE
 ↓
SALARY GENERATE
 ↓
SALARY APPROVE
 ↓
PAY
 ↓
LEDGER
 ↓
SALARY SLIP
```

For loans:

```text
LOAN
 ↓
RECEIVE
 ↓
ACCOUNT
 ↓
UTILIZE
 ↓
LINK TO TRANSACTIONS
 ↓
REPAY
 ↓
OUTSTANDING
 ↓
CLOSE
```

The single source-of-truth principle is:

> **No money should move without a trace, and no important trace should exist without knowing who, why, where, when and under whose approval.**
