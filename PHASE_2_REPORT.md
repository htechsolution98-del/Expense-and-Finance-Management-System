# Phase 2 Implementation Report — Authentication & Authorization Foundation

This document outlines the features, database setups, API mappings, role permission matrices, security protocols, and test verification results for the Phase 2 implementation of the Company Finance, Expense & Employee Management Portal.

---

## 1. Implemented Features

### 1.1 Authentication & Session Lifecycle
*   **User Login (`POST /auth/login`)**: Authenticates credentials using `bcrypt` comparison. If successful, issues a short-lived access token and registers a new random UUID refresh token in the database.
*   **Token Refresh (`POST /auth/refresh`)**: Validates refresh tokens in the DB, rotates both the access and refresh tokens, and deletes the old session keys to prevent replay attacks.
*   **User Logout (`POST /auth/logout`)**: Deletes active refresh tokens from the database, invalidating the session, and logs the event.
*   **Profile Query (`GET /auth/me`)**: Returns the complete authenticated user profile, active company name, user role, and functional permissions list.
*   **Change Password (`POST /auth/change-password`)**: Validates the user's current password and securely hashes the new password before updating the database.

### 1.2 User & Role Management CRUD
*   **User List (`GET /users`)**: Lists users scoped to the active user's `companyId`.
*   **User Profile (`GET /users/:id`)**: Retrieves a single user scoped to the active tenant company boundaries.
*   **User Creation (`POST /users`)**: Hashes the new password and creates the user linked to the active tenant's `companyId` with an assigned role.
*   **User Update (`PATCH /users/:id`)**: Updates user profile properties.
*   **Status Update (`PATCH /users/:id/status`)**: Allows administrators to activate/deactivate user accounts. Users are blocked from deactivating their own active sessions.
*   **Role Management (`PATCH /users/:id/roles`)**: Allows administrators to reassign user roles.

---

## 2. Database Schema & SQLite Adapters

The database is built using **SQLite** locally (`backend/prisma/dev.db`). The following adapter changes were made:
1.  **UUID strings mapping**: Removed `@db.Uuid` database-specific types from all relation columns. SQLite handles standard UUIDs as text strings.
2.  **String status columns**: SQLite does not support custom database-level enums in Prisma. The `status` columns in the `Company` and `User` models were converted to `String` fields with defaults of `"ACTIVE"`.
3.  **JSON logs columns**: SQLite does not support native `Json` type columns in Prisma. The `oldData` and `newData` audit log columns were converted to nullable `String` columns.

---

## 3. System Roles & Permissions Matrix

The portal defines 4 roles mapped to 28 granular permission keys:

| Permission Key | Description | SUPER_ADMIN | ADMIN | ACCOUNTS | STAFF |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **USER_VIEW** | View system users | Yes | Yes | Yes | No |
| **USER_CREATE** | Create system users | Yes | Yes | No | No |
| **USER_UPDATE** | Update system users profile | Yes | Yes | No | No |
| **USER_DISABLE** | Enable/disable system users | Yes | Yes | No | No |
| **ROLE_VIEW** | View roles | Yes | Yes | Yes | No |
| **ROLE_CREATE** | Create roles | Yes | No | No | No |
| **ROLE_UPDATE** | Assign or edit roles | Yes | Yes | No | No |
| **COMPANY_VIEW** | View company settings | Yes | Yes | No | No |
| **COMPANY_UPDATE** | Update company settings | Yes | Yes | No | No |
| **ACCOUNT_VIEW** | View accounts and balances | Yes | Yes | Yes | No |
| **ACCOUNT_CREATE** | Create bank/cash accounts | Yes | No | Yes | No |
| **ACCOUNT_UPDATE** | Update bank/cash accounts | Yes | No | Yes | No |
| **EXPENSE_VIEW** | View office/staff expenses | Yes | Yes | Yes | No |
| **EXPENSE_CREATE** | Submit office/staff expenses | Yes | No | No | Yes |
| **EXPENSE_APPROVE** | Approve office/staff expenses | Yes | Yes | No | No |
| **PAYMENT_VIEW** | View payment registry | Yes | Yes | Yes | No |
| **PAYMENT_CREATE** | Create outgoing payment | Yes | No | Yes | No |
| **PAYMENT_APPROVE** | Approve outgoing payment | Yes | Yes | No | No |
| **SALARY_VIEW** | View employee salaries | Yes | Yes | Yes | No |
| **SALARY_CREATE** | Generate monthly salaries | Yes | No | Yes | No |
| **SALARY_APPROVE** | Approve monthly salaries | Yes | Yes | No | No |
| **LOAN_VIEW** | View business loans | Yes | Yes | Yes | No |
| **LOAN_CREATE** | Record business loans | Yes | No | Yes | No |
| **LOAN_APPROVE** | Approve business loans/repayments| Yes | Yes | No | No |
| **ADVANCE_VIEW** | View staff advances | Yes | Yes | Yes | No |
| **ADVANCE_CREATE** | Submit staff advance requests | Yes | No | No | Yes |
| **ADVANCE_APPROVE** | Approve/settle staff advances | Yes | Yes | No | No |
| **REPORT_VIEW** | View analytics and reports | Yes | Yes | Yes | No |

---

## 4. Security Infrastructure & Tenancy Protection

*   **Bcrypt Hashing**: User passwords are saved using `bcrypt` hashed with a work factor of 12. Password values are excluded from queries using Prisma selection scopes.
*   **Token-Based Scoping**: Access tokens carry the authenticated user's `userId`, `companyId`, `role`, and `permissions` array claims.
*   **Tenant Isolation**: The backend relies on `tenantScopeMiddleware` to assign `req.companyId = req.user.companyId` from token claims. User-supplied parameters are bypassed, and all user queries lock access filters to the active `companyId`.
*   **Zod pay-load schema validation**: Input parameters are parsed and validated via strict Zod schemas, enforcing types, formats, and character counts.
*   **Immutable Audit Logging**: Actions are logged directly inside database transaction blocks. Modifying or deleting audit log records is prevented.

---

## 5. Development Test Credentials

The database contains 4 seeded accounts in **Acme Demo Company** for local development.

*   **Default Password**: `Password@123`

| User Role | Account Email | Active Permissions Count |
| :--- | :--- | :---: |
| **SUPER_ADMIN** | `superadmin@acme.com` | 28 (Full Access) |
| **ADMIN** | `admin@acme.com` | 20 |
| **ACCOUNTS** | `accounts@acme.com` | 13 |
| **STAFF** | `staff@acme.com` | 2 |

---

## 6. Integration Test Results

We created a programmatic integration test suite (`backend/scratch/run_auth_tests.ts`) evaluating the authorization engine. The tests output:

```text
======================================================================
STARTING PHASE 2 AUTHENTICATION & AUTHORIZATION INTEGRATION TESTS
======================================================================

Test 1: Testing valid login for superadmin@acme.com...
  -> PASS: Logged in successfully.

Test 2: Testing login with invalid password...
  -> PASS: Received 401 Unauthorized as expected.

Test 3: Testing current-user endpoint /auth/me...
  -> PASS: Retrieved profile for superadmin@acme.com (Role: SUPER_ADMIN).

Test 4: Retrieving users list (evaluating Tenant Isolation)...
  -> PASS: Fetched 4 users successfully scoped to company.

Test 5: Testing role permissions restriction (authenticating staff)...
  -> Attempting to fetch users list using Staff token...
  -> PASS: Staff query rejected with 403 Forbidden as expected.

Test 6: Testing disabled user access blocks...
  -> Deactivating staff user account using Super Admin token...
  -> Attempting to log in as deactivated staff user...
  -> PASS: Login blocked with 403 Forbidden ("deactivated") as expected.
  -> Restored staff user back to ACTIVE.

Test 7: Testing password change flow for superadmin...
  -> Password changed to NewPassword@123. Testing login with new password...
  -> Success login with new password. Testing login with old password...
  -> PASS: Old credentials correctly rejected.
  -> Restored superadmin password back to default Password@123.

Test 8: Testing refresh token rotation endpoint...
  -> PASS: Successfully generated a new access token.

Test 9: Testing session logout...
  -> Invoking refresh check using revoked refresh token...
  -> PASS: Revoked refresh token correctly rejected with 401 Unauthorized.

======================================================================
INTEGRATION TEST RESULTS SUMMARY
======================================================================
validLogin                    : PASS ✅
invalidPassword               : PASS ✅
logout                        : PASS ✅
refreshToken                  : PASS ✅
currentUser                   : PASS ✅
disabledUserCannotLogin       : PASS ✅
staffCannotAccessAdminAPI     : PASS ✅
tenantIsolation               : PASS ✅
passwordChange                : PASS ✅
rolePermissionEnforcement     : PASS ✅
======================================================================
ALL PHASE 2 INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀
```

---

## 7. Remaining Limitations

*   **Statutory PF/Tax Configurations**: Payroll tax structures are left as configurations for Phase 5.
*   **Security hardening**: 2FA/MFA setups, IP-address rate-limit policies, and token blacklisting databases are scheduled for Phase 6.
