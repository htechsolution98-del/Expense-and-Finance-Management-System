# Company Finance, Expense & Employee Management Portal

This repository contains the monorepo architecture for the Company Finance, Expense & Employee Management Portal. It is structured into a separate backend API engine and a frontend React client.

---

## 1. Project Architecture

*   **Backend (`/backend`)**: Node.js, Express, TypeScript, Prisma ORM, and SQLite.
*   **Frontend (`/frontend`)**: React, TypeScript, Vite, React Router, Axios, and Tailwind CSS.

---

## 2. Prerequisites & Windows Setup Instructions

To run this application locally on Windows with zero database server installation or Docker required, follow these steps:

### Step 1: Install Node.js
Install the LTS version of [Node.js](https://nodejs.org/). Make sure `node -v` returns v20+.

### Step 2: Configure Backend Environment
Navigate to `/backend` and copy `.env.example` to `.env`. Ensure your `DATABASE_URL` is set to the local SQLite database file:

```env
DATABASE_URL="file:./dev.db"
```

### Step 3: Run SQLite Migration & Seeding
Set up your local SQLite database file and seed initial admin credentials (run within the `backend/` folder):
```powershell
cd backend
npm.cmd install
npx.cmd prisma migrate dev --name init
npm.cmd run prisma:seed
```

### Step 4: Start Backend Application
Run the development backend server:
```powershell
cd backend
npm.cmd run dev
```
The server will start on **`http://localhost:5000`**. You can verify it is running by checking **`http://localhost:5000/api/v1/health`**.

### Step 5: Start Frontend Application
Open a new terminal window, navigate to the frontend directory, install packages, and start the development build:
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
The client will start on **`http://localhost:5173`**. You can log in with:
*   **Email**: `admin@acme.com`
*   **Password**: `Password@123`

---

## 3. Reference Guides

*   For complete database setup, variables configuration, and troubleshooting steps, refer to [LOCAL_DEVELOPMENT.md](file:///d:/express%20management%20system/LOCAL_DEVELOPMENT.md).
*   For the Phase 1 architectural and foundation implementation summary, check [PHASE_1_REPORT.md](file:///d:/express%20management%20system/PHASE_1_REPORT.md).
