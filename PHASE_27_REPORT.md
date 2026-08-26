# Phase 27 Completion Report — SaaS Subscription Pricing Plans & Dynamic Renewals

This report documents the implementation of dynamic subscription pricing plan management and checkout renewals on the KaryaNiyantrak Multi-Tenant SaaS platform.

---

## 1. Database Schema Specifications

Added the `SubscriptionPlan` model inside the database:

```prisma
model SubscriptionPlan {
  id        String   @id @default(uuid())
  name      String
  months    Int
  price     Float
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("subscription_plans")
}
```

---

## 2. API Endpoints Table

All endpoints map to version gateway prefix `/api/v1`.

| Method | Endpoint | Description | Guard / Protection | Request Payload | Response Sample |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GET** | `/system/plans` | Lists all pricing plans. | `globalMasterAdminOnly` | None | `{ "success": true, "data": [...] }` |
| **POST** | `/system/plans` | Creates a new pricing plan. | `globalMasterAdminOnly` | `{ "name": "Basic", "months": 3, "price": 499, "isActive": true }` | `{ "success": true, "data": { plan } }` |
| **PUT** | `/system/plans/:id` | Updates plan configuration. | `globalMasterAdminOnly` | `{ "name": "Basic Extended", "months": 3, "price": 550, "isActive": true }` | `{ "success": true, "data": { plan } }` |
| **DELETE** | `/system/plans/:id` | Deletes a plan definition. | `globalMasterAdminOnly` | None | `{ "success": true, "message": "Plan deleted" }` |
| **GET** | `/company/plans` | Lists active plans for client lookup. | Auth User (Company Profile Scope) | None | `{ "success": true, "data": [...] }` |
| **POST** | `/company/subscribe` | Processes checkout and extends duration. | Auth User (Company Profile Scope) | `{ "planId": "uuid-here" }` | `{ "success": true, "message": "Subscribed" }` |

---

## 3. Frontend Components

1. **Master Dashboard Configuration (`MasterDashboard.tsx`)**:
   - Added a tabbed navigation interface separating **Client Companies Directory** and **Subscription Pricing Plans**.
   - Built a comprehensive CRUD interface with visual action buttons (Add, Edit, Delete) and interactive table structures.
   - Includes state variables and modal forms validating plan inputs (`name`, `months`, `price`, `isActive`).

2. **Client Checkout Locks (`SubscriptionModal.tsx`)**:
   - Fetches active pricing options dynamically from `GET /company/plans` upon company lockout.
   - Renders a clean radio card selector letting client admins pick their subscription package.
   - Transmits the chosen `planId` inside the checkout body to calculate dynamic renewals on simulated payment success.

---

## 4. Operational Walkthrough Guide

To verify and test these changes end-to-end:

### Step 1: Create pricing plans as Master Admin
1. Log in to the platform using the **Global Master Admin** credentials.
2. Select the **System Console** page from the sidebar menu layout.
3. Switch to the **Subscription Pricing Plans** tab.
4. Click **Add Plan** and create your pricing structures, for example:
   - **Plan A**: "3 Months Starter" — Duration: `3` Months, Price: `₹2,999`
   - **Plan B**: "6 Months Pro" — Duration: `6` Months, Price: `₹4,999`
   - **Plan C**: "1 Year Enterprise" — Duration: `12` Months, Price: `₹8,999`
5. Save the plans and confirm they render as active inside the plans table.

### Step 2: Lockout experience for expired client accounts
1. Register a new company, or update an existing client company's subscription status inside the **Client Companies Directory** to `EXPIRED`.
2. Log in using that company's local Admin credentials.
3. Upon loading, the dashboard layout automatically triggers the lockout screen: the workspace is overlayed with the glassmorphic **Subscription Required** panel.
4. The panel displays the active pricing plans (e.g. 3 Months, 6 Months, 1 Year) with radio cards and Rupee symbols loaded dynamically.

### Step 3: Checkout and dynamic renewal verification
1. Select one of the dynamic subscription cards (e.g. "6 Months Pro").
2. Click **Simulate Payment & Unlock Now**.
3. Upon simulated transaction success, the portal automatically:
   - Extends the company's `subscriptionEndsAt` parameter by the selected plan's duration (e.g. 6 months).
   - Updates the status to `ACTIVE`.
   - Restores workspace access immediately, allowing the client to continue logging attendance, processing salaries, and checking ledger inputs.
