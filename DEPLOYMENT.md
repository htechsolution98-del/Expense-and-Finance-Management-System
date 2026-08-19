# Render Free-Tier Deployment Guide

This guide explains how to deploy the entire portal (Backend, Frontend, and Database) on **Render's Free Tier** (with a free persistent database on Neon or Supabase).

Since we configured the Express backend to statically host the React frontend in production mode, you only need to deploy **one single Web Service on Render** to host both backend and frontend!

---

## Step 1: Set Up a Free PostgreSQL Database

SQLite is a local file-based database, which means any changes are wiped whenever Render's free tier container restarts (at least once a day). To persist your data permanently in production for free, use a cloud PostgreSQL database.

### Option A: Neon.tech (Recommended - Free Forever)
1. Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2. Create a new project (choose the default region closest to you).
3. Copy the **Connection String** (database URL). It will look like:
   `postgresql://neondb_owner:xyz@ep-cool-fog-a5uqxyz.us-east-2.aws.neon.tech/neondb?sslmode=require`

### Option B: Render PostgreSQL (Free for 90 days)
1. In your Render Dashboard, click **New** → **PostgreSQL**.
2. Name your database, leave the default settings, and click **Create Database**.
3. Under **Connections**, copy the **External Database URL**.

---

## Step 2: Update database provider to PostgreSQL

To tell Prisma to use PostgreSQL instead of SQLite, modify the database configuration in `backend/prisma/schema.prisma`.

1. Open `backend/prisma/schema.prisma` and change the provider from `"sqlite"` to `"postgresql"`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Commit and push this change to your GitHub repository.

---

## Step 3: Push Your Project to GitHub

1. Create a new repository on [GitHub](https://github.com/) (e.g. `expense-management-portal`).
2. Open your terminal in the project root folder and push your code:
   ```bash
   git init
   git add .
   git commit -m "Configure production-ready deployment settings"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 4: Deploy on Render

1. Log into your [Render Dashboard](https://dashboard.render.com/).
2. Click **New** → **Web Service**.
3. Connect your GitHub account and select your repository.
4. Configure the Web Service settings:
   - **Name**: `expense-portal` (or any name you prefer)
   - **Runtime**: `Node`
   - **Build Command**: 
     ```bash
     cd backend && npm install && npm run build && npx prisma generate && cd ../frontend && npm install && npm run build
     ```
   - **Start Command**: 
     ```bash
     cd backend && npx prisma db push && npm run prisma:seed && npm run start
     ```
   - **Instance Type**: **Free**

5. Under **Environment Variables**, click **Add Environment Variable** and enter the following settings:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` *(Render maps this automatically, but standard practice is 10000)*
   - `DATABASE_URL`: `YOUR_COPIED_POSTGRESQL_CONNECTION_STRING`
   - `JWT_ACCESS_SECRET`: `generate_a_long_random_hash_here_for_security`
   - `JWT_REFRESH_SECRET`: `generate_another_long_random_hash_here`
   - `ACCESS_TOKEN_EXPIRES_IN`: `15m`
   - `REFRESH_TOKEN_EXPIRES_IN`: `7d`
   - `FRONTEND_URL`: `https://expense-portal.onrender.com` *(Update this with your final Render URL once it is created)*
   - `BACKEND_URL`: `https://expense-portal.onrender.com` *(Same as above)*

6. Click **Deploy Web Service**.

---

## Step 5: Verify Deployment

1. Render will fetch the code, install dependencies, compile the TypeScript source, run database migrations (via `npx prisma db push`), seed the initial credentials, and start the app.
2. Once the log says `Live`, click the URL provided by Render (e.g., `https://expense-portal.onrender.com`).
3. Log in with your seed administrator credentials:
   - **Email**: `admin@acme.com`
   - **Password**: `Password@123`
