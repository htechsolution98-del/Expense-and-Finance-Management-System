# Company Finance Portal Backend Engine — Phase 1 Foundation

This is the Node.js + Express + TypeScript backend engine for the Company Finance, Expense & Employee Management Portal, representing the Phase 1 Backend Foundation.

---

## 1. Prerequisites

*   [Node.js](https://nodejs.org) (v20+ recommended)
    *   Verify installation: `node -v`
*   An active local PostgreSQL instance listening on port 5432.
    *   Verify connectivity to port 5432.

---

## 2. Getting Started

### 2.1 Installation
Navigate to the `backend` folder and install dependencies:
```bash
cd backend
npm install
```
*(On Windows systems with PowerShell execution restrictions, run `npm.cmd install` instead).*

### 2.2 Configure Environments
Create a `.env` file inside the `backend` folder:
```bash
cp .env.example .env
```
Ensure the connection string `DATABASE_URL` matches your local database credentials.

### 2.3 DB Scaffolding & Seeding
Sync your Prisma schema with the database and run migrations:
```bash
npx prisma migrate dev --name init
```
Initialize standard roles, permissions, default company, and seed Super Admin credentials:
```bash
npm run prisma:seed
```
*   **Seed Admin User Email**: `admin@acme.com`
*   **Seed Admin User Password**: `Password@123`

### 2.4 Start Development Server
```bash
npm run dev
```
The server will start on **`http://localhost:5000`**.

---

## 3. Available Run Scripts

*   `npm run dev`: Boot development server via `ts-node-dev` with hot reload active on port 5000.
*   `npm run build`: Compile clean TypeScript build to `./dist/` directory.
*   `npm run start`: Start the compiled production build from `./dist/`.
*   `npm run lint`: Scan for coding conventions and ESLint warnings.
*   `npm run format`: Automatically apply Prettier code style rules.
*   `npx prisma validate`: Validate that Prisma schema is structurally correct.

---

## 4. Docker (Deployment Only)

The `Dockerfile` and `docker-compose.yml` are retained strictly for future containerized deployments and must not be used for local development.

---

## 5. API Endpoint Checks

### GET `/api/v1/health`
Verifies server status and tests PostgreSQL database connection.
*   **Response (200 Success)**:
    ```json
    {
      "success": true,
      "message": "Health status ok",
      "data": {
        "status": "ok",
        "database": "connected"
      }
    }
    ```
