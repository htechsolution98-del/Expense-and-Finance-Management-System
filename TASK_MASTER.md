# Master Task List — Company Finance, Expense & Employee Management Portal

---

## 🏆 COMPLETED PHASES & MODULES (Phases 1 – 8 + Audit History)

### ✅ Phase 1: Infrastructure & Foundation `[COMPLETE]`
- [x] Setup Express.js + TypeScript backend framework (`backend/`)
- [x] Configure SQLite database with Prisma ORM (`dev.db`) (Runtime database connection made fully dynamic & provider-agnostic)
- [x] Setup React + Vite + TypeScript frontend framework (`frontend/`)
- [x] Configure Pino structured logger and Zod request validation
- [x] Build `/api/v1/health` endpoint and verify health checks
- [x] Validate TypeScript compilation (`npx tsc --noEmit`) with zero errors
- [x] Implement Company Branding & Profile Management (Company Name, Logo, Address, Phone, Email, GSTIN)
- [x] Integrate Company Header Branding into Printable Vouchers & Official Salary Slips

---

### ✅ Phase 2: Authentication, Users, Roles & Permissions `[COMPLETE]`
- [x] Implement User, Role, Permission, UserRole, RolePermission, and RefreshToken Prisma models
- [x] Seed 28 granular system permissions across 4 standard roles (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTS`, `STAFF`)
- [x] Build JWT Access Token (15m expiry) + Refresh Token (7d rotation) authentication system
- [x] Implement password hashing with `bcrypt` (cost factor 12)
- [x] Build Auth APIs (`/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/change-password`)
- [x] Build Admin User Management APIs (`/users`, `/users/:id/disable`, `/users/:id/role`)
- [x] Create `authenticate`, `authorize(permission)`, and `tenantScopeMiddleware` security middlewares

---

### ✅ Phase 3: Company Finance & Unified Transaction Ledger `[COMPLETE]`
- [x] Implement Account, Transaction, Voucher, Client, Vendor, and Loan models
- [x] Implement Financial Accounts management (Cash, Bank, UPI, Card) with Optimistic Concurrency Control (`version`)
- [x] Build Unified Transaction Ledger (`PAYMENT_IN`, `PAYMENT_OUT`, `TRANSFER_OUT`, `TRANSFER_IN`, `REVERSAL`)
- [x] Build Auto-Increment Voucher Generation Engine (`VCH-PAY-XXXXX`)
- [x] Build Accounts APIs (`GET/POST /accounts`, `GET/POST /payments`, `POST /transfers`, `GET /ledger`, `POST /ledger/:id/reverse`)
- [x] Seed default company accounts (Primary Cash Box ₹10,000, HDFC Operating Bank Account ₹5,00,000)
- [x] Run automated integration test suite (10/10 tests passed)

---

### ✅ Phase 4: Office & Staff Expenses & Approval Engine `[COMPLETE]`
- [x] Implement ExpenseCategory, Expense, ApprovalRule, ApprovalRequest, and ApprovalStep models
- [x] Build Expense State Machine (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED`/`REJECTED`/`RETURNED` → `REIMBURSED`)
- [x] Build Tiered Sequential Approval Engine (≤ ₹5,000 → ACCOUNTS; > ₹5,000 → ACCOUNTS → ADMIN)
- [x] Implement active step locking (out-of-order approval prevention returning HTTP 403)
- [x] Implement Return for Correction flow (resets steps on resubmission)
- [x] Build Expense Payout API (`POST /expenses/:id/pay`) — balance deduction, `PAYMENT_OUT` ledger entry, voucher creation
- [x] Build frontend `ExpensesList.tsx` claims grid, timeline drawer, and reviewer action panel
- [x] Run automated integration test suite (9/9 tests passed)

---

### ✅ Phase 5: Employee Payroll & Salary Processing `[COMPLETE]`
- [x] Implement SalaryStructure, Payroll, and PayrollItem models
- [x] Build Salary Package configuration (Basic, HRA, Conveyance, Medical, Special earnings; PF, TDS, Professional Tax deductions)
- [x] Build Monthly Payroll Batch Engine (`DRAFT` → `APPROVED` → `PAID`) with duplicate batch prevention (HTTP 400)
- [x] Implement atomic batch payout and individual slip payout transactions
- [x] Implement double-payment blocking on paid slips
- [x] Build Salary APIs (`/salaries/structures`, `/salaries/payrolls`, `/salaries/payrolls/:id/approve`, `/salaries/payrolls/:id/pay`, `/salaries/items/:itemId/pay`)
- [x] Build frontend `SalaryStructures.tsx` & `PayrollList.tsx`
- [x] Run automated integration test suite (9/9 tests passed)

---

### ✅ Phase 6: Staff Advances & Settlement Engine `[COMPLETE]`
- [x] Implement Advance and AdvanceSettlement models
- [x] Build Advance State Machine (`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` → `DISBURSED` → `SETTLEMENT_PENDING` → `SETTLED`)
- [x] Enforce Tiered Sequential Approvals for advance requests
- [x] Implement Disbursement API (`POST /advances/:id/disburse`) with `PAYMENT_OUT` category `STAFF_ADVANCE`
- [x] Implement 3-Case Settlement Engine (Exact, Surplus Return, Overspent)
- [x] Build frontend `AdvancesList.tsx` + `advances.css`
- [x] Run automated integration test suite (9/9 tests passed)

---

### ✅ Phase 7: Employee Portal & Bank Account Verification `[COMPLETE]`
- [x] Implement EmployeeBankAccount model
- [x] Build Employee Self-Service profile API (`GET /employees/me`)
- [x] Build Bank Account Submission API (`POST/PUT /employees/me/bank-account`) with status `PENDING_VERIFICATION`
- [x] Implement Safety Rule: Editing bank details automatically resets status to `PENDING_VERIFICATION`
- [x] Build Bank Verification Queue APIs for Accounts/Admin (`GET /employees/bank-accounts/pending`, `POST /employees/bank-accounts/:id/verify|reject`)
- [x] Build Self-Service Payslip APIs (`GET /employees/me/salary-slips`, `GET /employees/me/salary-slips/:id`)
- [x] Build frontend `EmployeePortal.tsx` + `employeePortal.css` with interactive printable Payslip renderer (`@media print`)
- [x] Enforce strict privacy checks (staff cannot view other employees' payslips)
- [x] Run automated integration test suite (9/9 tests passed)

---

### ✅ Phase 8: Reports & Analytics Dashboard `[COMPLETE]`
- [x] Build Real-Time Executive KPI Summary API (`GET /reports/dashboard-summary` — Money In, Money Out, Liquidity, Pending Queues)
- [x] Build Cash Flow & Payment Mode Breakdown API (`GET /reports/cash-flow` — CASH, BANK, UPI, CARD)
- [x] Build Category Expense Analytics API (`GET /reports/expenses-by-category`)
- [x] Build Employee & Department Expense Analytics API (`GET /reports/expenses-by-employee`)
- [x] Build Monthly Salary & Statutory Deduction Register API (`GET /reports/salary-register` — Gross, Net, PF, TDS, PT)
- [x] Build Advances & Loans Metrics API (`GET /reports/advances-and-loans`)
- [x] Build Standard CSV Data Exporter API (`GET /reports/export?type=ledger|expenses|salaries`)
- [x] Build frontend `ReportsDashboard.tsx` + `reports.css` with KPI cards, progress bars, interactive tabs, and CSV exporter
- [x] Run automated integration test suite (8/8 tests passed)

---

### ✅ Audit History Module `[COMPLETE]`
- [x] AuditLog Prisma model & automated audit logging across all backend controllers
- [x] Read-Only Audit History API (`GET /reports/audit-logs` — search, module/action filters, pagination)
- [x] Frontend `AuditHistory.tsx` + `auditHistory.css` (KPI cards, module badges, JSON diff payload viewer modal)
- [x] Unlocked Audit History link in `Sidebar.tsx` and registered `/audit` protected route in `App.tsx`
- [x] Run automated integration test suite (4/4 tests passed)

---

### ✅ Phase 9: User Directory & Role-Based Access Control `[COMPLETE]`
- [x] Add getRoles, getPermissions, and updateRolePermissions controllers in `user.controller.ts`
- [x] Define `/users/roles`, `/users/permissions` and `/users/roles/:id/permissions` routes in `user.routes.ts`
- [x] Register `/users` protected route in React frontend `App.tsx`
- [x] Add "Users" link in the sidebar (`Sidebar.tsx`) visible only to users with `USER_VIEW` permission
- [x] Map `/users` path to "User Directory & Access Control" page title in `DashboardLayout.tsx`
- [x] Build the premium dark-themed `Users.tsx` dashboard page (User list directory & Roles/Permissions config matrix)
- [x] Run automated dynamic role-permission integration test suite (`scratch/run_role_permission_tests.ts`, 7/7 tests passed)

---

### ✅ Phase 10: SaaS Theme & UI/UX Redesign `[COMPLETE]`
- [x] Configure global CSS Variables/Design Tokens in `index.css`
- [x] Connect variables to Tailwind `@theme` configuration inside `index.css`
- [x] Map form fields (inputs, selects, textareas) and tables globally to light theme style
- [x] Map primary, secondary, danger, and warning buttons to emerald-green theme variants
- [x] Redesign Sidebar component (`Sidebar.tsx`) to support navy style, active menu markers, and hover states
- [x] Redesign Header component (`Header.tsx`) to support light card layouts and active indicators
- [x] Implement dynamic report dashboards calling backend endpoints inside `Dashboard.tsx` for admin/accounts roles
- [x] Create scoped self-service fallback dashboard inside `Dashboard.tsx` for staff users to prevent permission errors
- [x] Verify layout responsiveness across desktop, laptop, tablet, and mobile dimensions
- [x] Build and compile frontend codebase successfully with zero errors

---

### ✅ Phase 11: Super Admin Deletions, Custom Role Creation & Resilient Queries `[COMPLETE]`
- [x] Restrict `deleteUser` soft-delete controller action to `SUPER_ADMIN` in `user.controller.ts`
- [x] Map `updateUser`, `updateStatus`, and `updateRoles` to granular permission controls (`USER_UPDATE`, `USER_DISABLE`, `ROLE_UPDATE`) rather than role checks
- [x] Filter out `DELETED` users inside `getUsers` controller
- [x] Declare `/users/:id` DELETE endpoint in `user.routes.ts`
- [x] Update `Users.tsx` frontend page to check permissions for adding users, editing roles, deactivating accounts, and saving role permissions
- [x] Add a Delete user button in `Users.tsx` (visible only to `SUPER_ADMIN`) calling the DELETE API
- [x] Prevent non-Super-Admins from modifying `SUPER_ADMIN` permissions or their own role permissions
- [x] Filter out `SUPER_ADMIN` role and Super Admin users from Admin views
- [x] Block non-Super-Admins from assigning `SUPER_ADMIN` role or editing a Super Admin user
- [x] Create POST `/users/roles` endpoint to support dynamic custom role creation (requires `ROLE_CREATE` permission)
- [x] Add "+ Create Custom Role" button and input form modal in the frontend Roles selection panel
- [x] Fetch roles/permissions dynamically from database in `authenticate` middleware on every API call to apply permission changes instantly without logout
- [x] Perform silent `/auth/me` sync in `DashboardLayout.tsx` on every route change (page navigation) to dynamically sync frontend user info
- [x] Gracefully catch auxiliary query failures (like employees directories or bank accounts) in `AdvancesList.tsx`, `Payments.tsx`, and `ExpensesList.tsx` to support highly restricted roles
- [x] Update integration tests in `scratch/run_role_permission_tests.ts` to verify 15/15 test cases (including role creation permission checks, self-update blocks, role filtering, and Super Admin safeguards)
- [x] Compile code and verify all tests pass
- [x] Sync docs and update phase completion report `PHASE_11_REPORT.md`

---

### ✅ Phase 12: User Details & Phone Authentication `[COMPLETE]`
- [x] Add optional `name` and `phone` fields to `User` Prisma schema model.
- [x] Make `phone` a unique index to allow use as a login identifier.
- [x] Migrate database schema and generate Prisma client.
- [x] Update `user.controller.ts` to accept and validate `name` and `phone` fields during user creation (`createUser` API).
- [x] Add `name` and `phone` field responses to `getUserById` and `getUsers` APIs.
- [x] Update `auth.controller.ts` login API to accept either `email` or `phone` as an `identifier` for authentication.
- [x] Update frontend User model interface with `name` and `phone`.
- [x] Add "Name" and "Phone" input fields to the "Add User Account" form in `Users.tsx`.
- [x] Display name and phone number alongside email in the user directory list in `Users.tsx`.
- [x] Update `Login.tsx` frontend to support "Email or Phone Number" input.
- [x] Run frontend and backend Typescript static analysis checks (100% pass).

---

### ✅ Phase 13: Employee Portal Auto-Sync & Profile Edits `[COMPLETE]`
- [x] Add optional `photo` field to `Employee` Prisma model.
- [x] Update `employee.controller.ts` to auto-create `Employee` records for Users accessing the Employee Portal for the first time, syncing their name, email, and phone.
- [x] Create `PUT /employees/me` API endpoint for handling self-service profile updates (name, address, photo).
- [x] Update `EmployeePortal.tsx` to include an "Edit Profile Details" modal.
- [x] Lock `email` and `mobile` fields in the frontend edit form so they cannot be changed by the employee.
- [x] Synchronize updated name back to the `User` account automatically.
- [x] Ensure 100% TypeScript compilation on frontend and backend.

---

### ✅ Phase 14: Super Admin Account Management `[COMPLETE]`
- [x] Create `deleteAccount` API in `account.controller.ts` to soft-delete (mark inactive and set `deletedAt`) financial accounts.
- [x] Update `account.routes.ts` to restrict `PATCH /accounts/:id` (edit) and `DELETE /accounts/:id` (delete) strictly to `SUPER_ADMIN` role (by requiring wildcard permission).
- [x] Update `Accounts.tsx` frontend to dynamically detect `SUPER_ADMIN` privileges.
- [x] Add conditional UI Edit and Delete action buttons on Account cards for Super Admins.
- [x] Build an Edit Account Modal allowing Super Admins to update Account display names and status.
- [x] Implement frontend handler to prompt confirmation and hit the DELETE API for account removal.

---

### ✅ Phase 15: Custom Role Management `[COMPLETE]`
- [x] Create `PUT /users/roles/:id` API to rename and change descriptions of custom roles.
- [x] Create `DELETE /users/roles/:id` API to delete custom roles.
- [x] Implement robust backend guards to strictly protect System Roles (`SUPER_ADMIN`, `ADMIN`, `ACCOUNTS`, `HR`, `STAFF`, `MANAGER`) from being renamed, modified or deleted.
- [x] Prevent deletion of custom roles if they are currently assigned to any users.
- [x] Add `Edit2` and `Trash2` buttons next to custom roles in the Roles & Permissions panel (`Users.tsx`).
- [x] Build an Edit Custom Role modal interface.
- [x] 100% TypeScript compilation check on backend and frontend successfully passed.
---

### ✅ Phase 16: Custom Role Refinements, Admin User Edits & Tenant Scoping Fixes `[COMPLETE]`
- [x] Remove edit/delete protection from default roles (ADMIN, ACCOUNTS, STAFF) allowing full customization, while keeping only SUPER_ADMIN protected.
- [x] Update role deletion query to exclude soft-deleted users (`status: 'DELETED'`) so roles can be deleted after their active users are removed.
- [x] Implement User Details Edit Info API and modal in frontend allowing SUPER_ADMIN to edit operators' Name, Phone, and Email (synced to Employee).
- [x] Restrict user directory actions (Edit Info, Change Role, Extra Perms, Deactivate, Delete) strictly to SUPER_ADMIN.
- [x] Fix empty "Assign Role" dropdown for ADMIN users by allowing `USER_CREATE` permission (in addition to `ROLE_VIEW`) on the GET `/roles` API.
- [x] Fix missing `tenantScopeMiddleware` on `payment-category.routes.ts` preventing new payment category creation.
- [x] Align ProtectedRoute permissions with Sidebar.tsx configurations to prevent Access Denied errors on pages where users hold creation/approval rights (e.g. EXPENSE_CREATE or ADVANCE_CREATE) but not general view rights.
- [x] Allow users with `PAYMENT_VIEW` or `PAYMENT_CREATE` permissions to query `GET /payment-categories` (previously restricted strictly to `SETTINGS_VIEW`), so that payment forms can fetch categories for dropdowns successfully.
- [x] Add permission check logic inside `PaymentCategories.tsx` to display '+ Add Category' for users with `COMPANY_UPDATE` but hide Edit/Delete actions strictly for non-Super-Admins.
- [x] Migrate ad-hoc `SETTINGS_VIEW` / `SETTINGS_UPDATE` permissions (which were not assignable in the database) to use existing `COMPANY_VIEW` / `COMPANY_UPDATE` permissions across backend route handlers, frontend router configurations, sidebar menus, and category settings views, allowing Super Admin to configure category management permissions for roles dynamically from the UI.
- [x] Restrict backend PATCH and DELETE endpoints for payment categories to `SUPER_ADMIN_ONLY`, preventing non-Super-Admins from modifying category properties.
- [x] Restrict backend PUT and DELETE endpoints for approval rules to `SUPER_ADMIN_ONLY` (while allowing `COMPANY_UPDATE` on creation routes), and update frontend `ApprovalRules.tsx` to conditionally display '+ Add Rule' for users with `COMPANY_UPDATE` but hide Edit/Delete actions strictly for non-Super-Admins.
- [x] Completely restrict the entire Approval Rules module (backend routes, frontend routes, sidebar navigation link) exclusively to `SUPER_ADMIN` context (Wildcard `*` only).
- [x] Restrict backend PUT and DELETE endpoints for expense categories to `SUPER_ADMIN_ONLY`, and update frontend `ExpensesList.tsx` to conditionally display the `+` icon only for `SUPER_ADMIN` and `ACCOUNTS` / `ACCOUNT_I` roles while completely hiding `Edit` and `Delete` action icons from the dropdown for non-Super-Admins.
- [x] Restrict backend POST /categories route (creation) to `SUPER_ADMIN` and `ACCOUNTS`/`ACCOUNT_I` roles, blocking normal users (e.g. `STAFF` or `ADMIN`) from creating expense categories via the API.
- [x] Configure default fallback approval sequence for office/staff expenses to `['SUPER_ADMIN', 'ADMIN', 'ACCOUNTS']` so submissions follow this specific hierarchy, and update steps validation in `expense.controller.ts` and `advance.controller.ts` to support matching custom roles (like `ACCOUNT_I` to `ACCOUNTS`, `ADMIN_II` to `ADMIN`).
- [x] Implement database dynamic lookup for roles starting with `ACCOUNT` during workflow generation in `expense.controller.ts`, substituting custom role name (like `ACCOUNT_I`) in the approval step definition to match exact company roles schema.
- [x] Update frontend disbursement/payout permissions checks in `ExpensesList.tsx` and `AdvancesList.tsx` to support custom roles (like `ACCOUNT_I`), ensuring accounts users can successfully disburse funds and settle payout flows after approving claims.
- [x] Update frontend `ApprovalRules.tsx` to dynamically query and display all active database roles from `/users/roles` rather than relying on a hardcoded list, enabling selection of custom roles (such as `ACCOUNT_I` and `ACCOUNT_II`) and removing deleted/non-existent roles.
- [x] Restrict "Company Profile" sidebar navigation option and `/company-settings` routing path strictly to `SUPER_ADMIN` context (or wildcard `*` permission).
- [x] Integrate custom employee code input field and auto-generate checkbox toggle inside user creation form (`Users.tsx` & `user.controller.ts`).
- [x] Enable updating employee code inside the Edit User details form, with duplicate uniqueness validation checking (`Users.tsx` & `user.controller.ts`).
- [x] Implement dynamic sequential employee code pattern generator series continuation (e.g. `Htech-005` -> `Htech-006`) instead of a static default timestamp prefix (`employeeCode.ts` & `user.controller.ts` & `employee.controller.ts`).
- [x] Update `deleteUser` to nullify `phone` during soft-deletions and execute database migration/fix to free up existing deleted users' phone numbers.
- [x] Generalize role checks (admin vs employee) so that custom employee/staff roles (like `EMPLOYER`) are correctly restricted from seeing administrative items (`Salaries`, `Payroll`, `Advances`) in the sidebar and database query filters.

---

### ✅ Phase 17: Dynamic Leave Policy & Custom Rules Engine `[COMPLETE]`
- [x] Add `customRules String? @map("custom_rules")` to `LeavePolicy` Prisma schema model.
- [x] Migrate SQLite database schema via `prisma db push`.
- [x] Update `leave.controller.ts` `getLeavePolicy`, `createLeavePolicy`, and `updateLeavePolicy` handlers to parse and store `customRules` array.
- [x] Map dynamic rule toggles to legacy weekend, holiday, and over-draw policy fields for backward calculation compatibility.
- [x] Build dynamic custom rule builder UI in `LeaveManagement.tsx` modal replacing hardcoded options.
- [x] Add quick suggestion badges (+ Weekends Excluded, + Holidays Excluded, + Allow Over-draw, + Medical Certificate Required) for fast 1-click rule additions.
- [x] Enable adding custom policy rules with custom titles, toggling ON/OFF, and deleting rules.
- [x] Update Settings tab policy view to display custom policy rules badges dynamically.
- [x] Run frontend and backend TypeScript compilation checks (`npx tsc --noEmit`) with 0 errors.

---

### ✅ Phase 18: Super Admin Interactive Leave Quotas & Sync Engine `[COMPLETE]`
- [x] Add inline **Edit / Adjust Quota** pencil action button on each Leave Quota card in `LeaveManagement.tsx` for Super Admin & Admin roles.
- [x] Build **"Adjust Employee Leave Quota" Modal** allowing Super Admin to edit Allocated Days, Used Days, and Carried Forward Days with live balance calculation.
- [x] Implement `POST /leaves/balance/adjust` backend handler for updating individual employee leave quota balances.
- [x] Implement `POST /leaves/balance/sync` bulk sync engine to update all active employees' leave quota balances to match active Leave Type annual quotas in 1 click.
- [x] Add **"Sync All Quotas"** button in Leave Quotas header and Leave Types settings panel.
- [x] Auto-sync employee leave quota balances whenever Super Admin modifies a Leave Type's `annualQuota`.
- [x] Deactivating a Leave Type automatically removes un-used balance entries so test leave types (e.g. `aa (AA)`) disappear cleanly from quotas.
- [x] Add **Employee Selector Dropdown** in Leave Quotas header for Super Admin to seamlessly view and adjust any employee's leave quotas.
- [x] Make **PAID** and **UNPAID** badge tags directly clickable on Leave Quota cards & Leave Types list for Super Admin & Admin to instantly toggle leave type paid status in 1 click.
- [x] Make all 4 top KPI Cards (**Total Allocated**, **Available Balance**, **Pending Requests**, **Used Leave**) fully interactive buttons with hover glow effects: clicking **Pending Requests** opens the Approvals Queue tab instantly.
- [x] Run frontend and backend TypeScript compilation checks (`npx tsc --noEmit`) with 0 errors.

---

### ✅ Phase 19: Geofencing & Selfie-based Attendance System `[COMPLETE]`
- [x] Implement AttendanceConfig, AttendanceRecord, and AttendanceBreak Prisma models
- [x] Set up configuration endpoints to manage office timings, grace period, allowed break duration, geofence Lat/Lng coordinates, geofence radius, and selfie verification rules
- [x] Implement employee Check-In/Check-Out APIs with Geolocation coordinates check (Haversine distance calculation) and late/early exit calculations
- [x] Implement Break start/end tracker APIs with cumulative breaks calculation
- [x] Implement employee attendance log history query and daily status checkers
- [x] Implement Admin reports endpoints aggregating monthly present/absent counts, late check-ins, early check-outs, and average working hours per employee
- [x] Build frontend `AttendanceManagement.tsx` component with check-in/out buttons, live clock widget, break tracker, geofence radius indicator, and daily timeline tracker
- [x] Integrate HTML5 camera capturing stream (`navigator.mediaDevices.getUserMedia`) for photo-verification on mobile device check-ins
- [x] Build Admin settings configuration panel `AttendanceConfig.tsx` to set timings, grace periods, selfie rules, and geofence locations (including automated browser GPS-location lookup)
- [x] Register new routes in `App.tsx` and add "Attendance" and "Attendance Settings" modules to `Sidebar.tsx`
- [x] Verify frontend and backend compiler compatibility checks (100% pass)
- [x] Add half-day timing configuration parameters, checkout validations, and logs badges on personal and admin tables
- [x] Enforce allowed break time slots window validation restricting start-break triggers to range
- [x] Restrict access to Attendance Settings menu and Attendance Dashboard strictly to Super Admin context, blocking standard Admin role users
- [x] Make top KPI cards (Present, Late, Absent, Total) in the Attendance Dashboard fully interactive filter buttons with hover effects and glowing active borders
- [x] Implement backend virtual record generation for absent employees to display them in the daily attendance registry list
- [x] Support safe rendering of virtual records, showing customized absent status badges and hiding verifications/timestamps
- [x] Add dynamic "Single Date" vs "Date Range" filter toggle buttons with From/To inputs in the Admin header, enabling monthly and custom date range attendance logs reporting with record-date labels.
- [x] Add client-side "Export CSV" functionality to download filtered logs (Single Date or Date Range queries) as an Excel-compatible CSV file instantly, with status column modifiers appending "(Half Day)" for affected records.
- [x] Add `allowWFH` boolean column to the `Employee` model and enforce backend geofencing blocks during check-in for non-WFH employees.
- [x] Build the "WFH Settings" tab in `AttendanceManagement.tsx` to list all employees and allow Super Admin to toggle WFH permissions in 1 click, with corresponding frontend check-in button bypass checks and geofence indicators updated dynamically.
- [x] Remove strict time-of-day window checks from backend break triggers to allow flexible tea/coffee breaks during the work shift.
- [x] Add "+ Manual Attendance" overlay forms modal on the Admin dashboard allowing Super Admins to manually insert or correct check-in/out records for any employee, resolving subsequent camera overlay tag parsing errors.
- [x] Allow standard `ADMIN` users to access and edit WFH Settings tabs and manual attendance modals, while keeping global Attendance Settings configs restricted to Super Admins.
- [x] Implement midnight auto-checkout cron job (`node-cron`) that runs at 00:01 AM daily: finds all `CHECKED_IN`/`ON_BREAK` records from previous day, closes open breaks, and auto-checks out employees at the office end time with full work/break/half-day calculations.

---

### ✅ Phase 20: Salaries, Attendance & Leaves Integration `[COMPLETE]`
- [x] Add `lwpDays`, `absentDays`, `halfDays`, and `unpaidDeductions` tracking columns to the `PayrollItem` model in `schema.prisma`
- [x] Synchronize updated Prisma client and database via `npx prisma db push`
- [x] Update `generatePayroll` backend controller in `salary.controller.ts` to execute day-by-day loop analysis evaluating Sundays, company holidays, approved Leaves (Paid vs LWP), check-in status (Present vs Half-Day), and Absences
- [x] Automate Loss of Pay (LOP) calculations using dynamic daily salary rates (`LOP = LWP + Absent + 0.5 * HalfDay`) and deduct from Net Salary
- [x] Update frontend `PayrollList.tsx` slips grid layout to display LLOP days counts and deductions on admin view
- [x] Update frontend `EmployeePortal.tsx` interactive payslip template and print renderer to display transparent LOP breakdowns
- [x] Implement daily auto-checkout cron job (`node-cron`) for unclosed shifts at end of day
- [x] Build Change Password modal in the global Header layout for all users
- [x] Implement backend reset-password endpoint and frontend Reset PW modal in Users Directory for Super Admin
- [x] Implement `useAutoRefresh` hook and add real-time auto-polling to all major pages
- [x] Verify frontend and backend TypeScript compilation check (`npx tsc --noEmit`) with 0 errors
- [x] Implement backend `updateLoanStatus` route and controller logic for settling loans
- [x] Build frontend `Loans.tsx` management dashboard (KPIs, table lists, create loan modal, action models for repayments/utilizations)
- [x] Add path mapping for `/loans` inside header titles in `DashboardLayout.tsx`
- [x] Register `/loans` protected route in `App.tsx` and menu item in `Sidebar.tsx`
- [x] Restore screenshot upload for UPI and CHEQUE payment modes in Payments.tsx (handling FormData submissions for both deposits and payouts)
- [x] Enable backend POST /payments/in route to handle file uploads and save filePath to deposit vouchers
- [x] Fix initial load blank screen bug on Expenses list by updating useAutoRefresh hook to trigger callback immediately on mount/dependency change

---

### ✅ Phase 21: UI Color Theme & Layout Overflow/Responsive Fixes `[COMPLETE]`
- [x] Correct top-level layout wrapper in `DashboardLayout.tsx` (changed `w-screen` to `w-full` and configured responsive main container padding) to prevent viewport page width breakages on scrollbars rendering.
- [x] Replaced `w-full` with `min-w-full` on all `<table>` elements wrapped inside `overflow-x-auto` scroll containers across all modules (Dashboard, Ledger, Payments, Expenses, Vouchers, Salary/Payroll, Leaves, Attendance, Loans, and User directories) to prevent columns from compressing on narrow screens.
- [x] Converted hardcoded dark theme CSS values (like backgrounds, white borders, and purple gradients) inside `reports.css` to light-theme CSS variables so reports components match the unified layout.
- [x] Standardized card grids, state status badges, text colors, select dropdowns, input elements, error containers, and modals across `Accounts.tsx` and `Users.tsx` to align with the light white/slate/green design.
- [x] Added `truncate` and `min-w-0` to the header title container in `Header.tsx` to prevent long page titles from pushing action menus off the viewport on mobile devices.
- [x] Compile backend and frontend codebase with 0 static compilation and typechecking errors.
- [x] Fix sidebar, header, and footer layout behavior in DashboardLayout.tsx (using h-screen overflow-hidden on outer containers and overflow-y-auto on main content outlet) to keep them fixed in place while content scrolls.
- [x] Redesigned Payments page and Sidebar layout to match the first visual design mockup screenshot.
- [x] Resolve all hardcoded dark-theme text color leaks (white font on white bg, light grey elements, and transparent borders) inside Tables and Side Drawers (specifically User Directory, Payroll List, and Expenses List) by introducing global overrides in index.css.
- [x] Optimize all data tables across the system to fit exactly inside the screen width at 100% resolution with no horizontal scrollbar or element overflow. We achieved this by reducing cell padding, font size to 11px, and introducing max-widths and ellipses text truncation.
- [x] Convert Attendance KPI cards, timeline components, WFH toggle settings, and manual action forms to the unified light theme styling, removing all residual dark-themed backgrounds and borders.

---

### ✅ Phase 22: Company Announcements Module `[COMPLETE]`
- [x] Implement the `Announcement` model in the Prisma schema and update Company and User relationships.
- [x] Update database schema via `npx prisma db push` and regenerate Prisma client.
- [x] Seed permission `ANNOUNCEMENT_VIEW` in `seed.ts` and map to all roles dynamically.
- [x] Restrict creation, update, and deletion of announcements to `SUPER_ADMIN` role using `SUPER_ADMIN_ONLY` guards.
- [x] Build announcement backend controller endpoints for fetching, creating, updating, and deleting announcements.
- [x] Configure tenant boundary verification, active status filters, and expiresAt checks in announcement controller.
- [x] Implement audit logs creation on all announcement modifications (Create, Update, Delete) with details about changed properties.
- [x] Register new API routes inside the backend Express router.
- [x] Build frontend `Announcements.tsx` with list feed, filter tabs, announcement creation modal (SUPER_ADMIN only), and target role checklist.
- [x] Register `/announcements` path inside frontend `App.tsx` routes, guarded by `ANNOUNCEMENT_VIEW`.
- [x] Add "Announcements" menu item in the overview section of `Sidebar.tsx`.
- [x] Integrate latest active announcement banner widget on employee self-service and executive overview panels in `Dashboard.tsx`.
- [x] Create comprehensive automated integration tests verifying visibility rules, expired notices, draft filters, and STAFF/EMPLOYER role blocks (`scratch/run_announcement_tests.ts`), and run successfully.
- [x] Verify frontend and backend typescript compilation checks (`npx tsc --noEmit`) with 0 errors.

---

### ✅ Phase 23: Interactive Table Controls & Data Exporting (Excel/CSV/PDF) `[COMPLETE]`
- [x] Fixed PaymentCategories.tsx delete expense syntax compilation crash.
- [x] Add client-side pagination (10 records per page) with interactive page selector footer controls in ExpensesList.tsx, Vouchers.tsx, Loans.tsx, and SalaryStructures.tsx.
- [x] Add From Date / To Date filters in Vouchers.tsx, ExpensesList.tsx, Ledger.tsx, Loans.tsx, and SalaryStructures.tsx.
- [x] Add Search / Find filters in ExpensesList.tsx, Loans.tsx, and SalaryStructures.tsx.
- [x] Add UTF-8 BOM CSV Export capabilities to download filtered transaction/voucher/expense/loan/salary history inside Vouchers.tsx, ExpensesList.tsx, Ledger.tsx, Loans.tsx, and SalaryStructures.tsx.
- [x] Add print-friendly PDF generation for transactions ledger with company branding headers in Ledger.tsx, ExpensesList.tsx, Vouchers.tsx, Loans.tsx, and SalaryStructures.tsx.
- [x] Verify frontend and backend typescript compilation checks (`npx tsc --noEmit`) with 0 errors.

---

### ✅ Hotfixes & Maintenance
- [x] Fix Actions column layout squeeze and overflow clipping inside Users.tsx, remove role restriction on Extra Perms button, and configure a custom info banner for Super Admin target users in the Extra Permissions modal.
- [x] Remove the `140px` max-width constraint on `table td:last-child` and `table th:last-child` inside `index.css`, replacing it with `max-width: none` and `overflow: visible` to prevent all table action columns across the application from clipping.
- [x] Convert the plain text Status badge pill (`ACTIVE` / `INACTIVE`) inside `Users.tsx` into an interactive, clickable button toggle that calls the `handleToggleStatus` API, allowing admins to instantly toggle user accounts' activation status in 1 click directly from the Status column.
- [x] Remove the redundant "Deactivate" / "Activate" button from the table Actions column inside `Users.tsx` to streamline the user management interface controls.


