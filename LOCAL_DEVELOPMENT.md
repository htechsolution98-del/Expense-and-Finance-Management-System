# Local Windows Development Guide — SQLite & No Docker

This document outlines the setup steps to run the Company Finance, Expense & Employee Management Portal directly on your local Windows machine without Docker and with zero database server installations (using **SQLite**).

---

## 1. Required Software

Before starting, ensure the following software is installed on your Windows system:

1.  **Node.js** (v20+ recommended)
    *   Download installer from [nodejs.org](https://nodejs.org/).
    *   Verify installation: `node -v` and `npm -v`.

No database server installations (such as PostgreSQL, MySQL, or Docker Desktop) are required! The database is stored as a simple local file inside the application.

---

## 2. Environment Variables Configuration

### 2.1 Backend Environment (`backend/.env`)

Create or update `backend/.env` file with the following parameters:

```env
NODE_ENV=development
PORT=5000
BACKEND_URL=http://localhost:5000
FRONTEND_URL=http://localhost:5173

# Database Connection (SQLite local file-based database)
DATABASE_URL="file:./dev.db"

# JWT Secrets for token hashing
JWT_ACCESS_SECRET=cf_portal_local_dev_access_token_secret_hash_2026
JWT_REFRESH_SECRET=cf_portal_local_dev_refresh_token_secret_hash_2026
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
```

### 2.2 Frontend Environment (`frontend/.env`)

Create or update `frontend/.env` file:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 3. Backend Setup & Startup

Open a command prompt or PowerShell window and navigate to the `backend/` directory:

1.  **Navigate to backend and install dependencies**:
    ```powershell
    cd backend
    npm install
    ```
    *(Note: If scripts execution is disabled in your terminal, use `npm.cmd install` instead).*

2.  **Apply SQLite database migrations**:
    Configure Prisma to build the database file and tables:
    ```powershell
    npx prisma migrate dev --name init
    ```
    This creates the local database file `dev.db` at `backend/prisma/dev.db`.

3.  **Seed initial database records**:
    Populate standard roles, permissions, default company, and admin user credentials:
    ```powershell
    npm run prisma:seed
    ```

4.  **Start development server**:
    Launch the Express backend:
    ```powershell
    npm run dev
    ```
    The server will start on: **`http://localhost:5000`**. You can verify it works by visiting **`http://localhost:5000/api/v1/health`** in your browser.

---

## 4. Frontend Setup & Startup

Open a second command prompt or PowerShell window and navigate to the `frontend/` directory:

1.  **Navigate to frontend and install dependencies**:
    ```powershell
    cd frontend
    npm install
    ```

2.  **Start development server**:
    Launch the Vite development server:
    ```powershell
    npm run dev
    ```
    The frontend will start on: **`http://localhost:5173`**.

---

## 5. Accessing the Application

*   **Frontend Client**: `http://localhost:5173`
*   **Backend Server**: `http://localhost:5000`
*   **Seed Credentials**:
    *   **Email**: `admin@acme.com`
    *   **Password**: `Password@123`

---

## 6. Troubleshooting

### 6.1 PowerShell Script Execution Restrictions
If running scripts is disabled on your system (e.g. `npx` throws `SecurityError`), prefix commands or use `.cmd` extension explicitly:
- Use `npm.cmd install` instead of `npm install`
- Use `npx.cmd prisma migrate dev` instead of `npx prisma migrate dev`

### 6.2 Lock Issues or Re-creating Database
If you need to reset the SQLite database entirely, simply delete the file:
- `backend/prisma/dev.db`
Then re-run `npx prisma migrate dev` and `npm run prisma:seed` to rebuild the clean database.

### 6.3 Port Conflicts
- If port `5000` is already in use, you can update `PORT` inside `backend/.env` and also update `VITE_API_URL` inside `frontend/.env`.
- If port `5173` is already in use, Vite will automatically select another port (e.g., `5174`). Make sure to update `FRONTEND_URL` in `backend/.env` to allow CORS requests from the new port.
