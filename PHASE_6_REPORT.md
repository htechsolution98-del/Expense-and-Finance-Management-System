# Phase 6 Completion Report — Staff Advances & Settlement Engine

**Date:** August 9, 2026  
**Status:** ✅ VERIFIED & COMPLETE  
**Integration Tests:** 9/9 Passed  

---

## 1. Overview

Phase 6 implements the **Staff Advance & Settlement Engine** as specified in **brain.md Sections 11 & 12**. 

An advance is a **liability** — money given to an employee before they spend it. It is tracked separately from expenses and undergoes a 3-case settlement process based on proof submitted by the employee.

---

## 2. Key Modules & Features Delivered

### 2.1 Database Models (`backend/prisma/schema.prisma`)
- **`Advance`**: Tracks request amount, employee, purpose, date needed, status, disbursement account, and `outstandingAmount`.
- **`AdvanceSettlement`**: Line items detailing how the advance was spent (linked to `ExpenseCategory` and description).

### 2.2 Advance Lifecycle (State Machine)
`DRAFT` → `SUBMITTED` → `UNDER_REVIEW` (Sequential Approval) → `APPROVED` → `DISBURSED` → `SETTLEMENT_PENDING` → `SETTLED`

- **Tiered Sequential Approval Engine**:
  - ≤ ₹5,000 → `ACCOUNTS` approval.
  - > ₹5,000 → `ACCOUNTS` (step 1) then `ADMIN` (step 2) approval.
- **Disbursement API**: `POST /advances/:id/disburse` debits cash/bank account, logs `PAYMENT_OUT` with category `STAFF_ADVANCE`, issues voucher `VCH-ADV-XXXXX`, and updates status to `SETTLEMENT_PENDING`.

### 2.3 3-Case Settlement Engine
1. **Case A (Exact Match)**: Advance amount = Expenses submitted → Status `SETTLED`, `outstandingAmount` = ₹0.
2. **Case B (Surplus Return)**: Advance amount > Expenses submitted → `outstandingAmount` tracks surplus. Employee returns cash (`POST /advances/:id/return-cash`), creating `PAYMENT_IN` category `ADVANCE_RETURN` and voucher `VCH-ADV-XXXXX` → Status `SETTLED`.
3. **Case C (Overspent)**: Advance amount < Expenses submitted → Company reimburses extra amount.

---

## 3. API Summary

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/advances` | `GET` | `ADVANCE_VIEW` | List advances (scoped: STAFF sees own, ACCOUNTS/ADMIN see all) |
| `/advances` | `POST` | `ADVANCE_CREATE` | Submit advance request |
| `/advances/:id` | `PATCH` | `ADVANCE_CREATE` | Edit draft/returned advance |
| `/advances/:id/submit` | `POST` | `ADVANCE_CREATE` | Submit advance for approval |
| `/advances/:id/approve` | `POST` | `ADVANCE_APPROVE` | Approve active step |
| `/advances/:id/reject` | `POST` | `ADVANCE_APPROVE` | Reject advance |
| `/advances/:id/return` | `POST` | `ADVANCE_APPROVE` | Return for correction |
| `/advances/:id/disburse` | `POST` | `PAYMENT_CREATE` | Disburse cash/bank to employee |
| `/advances/:id/settle` | `POST` | `ADVANCE_APPROVE` | Submit usage settlement line items |
| `/advances/:id/return-cash` | `POST` | `PAYMENT_CREATE` | Record surplus cash returned by employee |

---

## 4. Frontend Component

- **[AdvancesList.tsx](file:///d:/express%20management%20system/frontend/src/pages/AdvancesList.tsx)**: Requests grid, status badges, approval timeline drawer, disburse widget, settlement form, and cash return modal.
- **[advances.css](file:///d:/express%20management%20system/frontend/src/styles/advances.css)**: Glassmorphism layout and drawer styling.

---

## 5. Integration Test Verification

The integration test suite ([run_advance_tests.ts](file:///d:/express%20management%20system/backend/scratch/run_advance_tests.ts)) verified all 9 test scenarios:

```text
Test 1: Authenticating users                          -> PASS
Test 2: Loading employees and accounts                -> PASS
Test 3: Staff submitting advance request for ₹7,000    -> PASS (Status: UNDER_REVIEW)
Test 4: Out-of-order approval block assertion          -> PASS (HTTP 403)
Test 5: Accounts step 1 + Admin step 2 approval        -> PASS (Status: APPROVED)
Test 6: Disbursing advance from HDFC Bank              -> PASS (HDFC: ₹3,64,000 -> ₹3,57,000)
Test 7: Submitting settlement for ₹5,500 (Case B)      -> PASS (Surplus: ₹1,500)
Test 8: Employee returning ₹1,500 cash into Cash Box   -> PASS (Cash Box: ₹16,000 -> ₹17,500, Status: SETTLED)
Test 9: Double cash return block assertion             -> PASS (HTTP 400)
```
