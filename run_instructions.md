# Steps to Run the Vision Entrepreneur Platform

## 🚀 One Command Setup (Recommended)

Run **everything** — database, migrations, dependencies, seed data, and dev servers — with a single command:

```powershell
npm run setup
```

That's it! The app will be running at **http://localhost:5173**

> If you've already done the first-time setup, just use `npm run dev` to start the servers.

---

Follow the steps below only if you prefer manual setup, or need to troubleshoot.

---

### Step 1: Set Up the MySQL Database (First Time Only)

> **⚠️ PowerShell Note:** PowerShell does not support `<` for input redirection. Always use `Get-Content file | mysql` instead.

1. Run the database schema setup:
   ```powershell
   Get-Content database/schema.sql | mysql -u root
   ```
2. Run the states migration to add multi-state support (all 36 Indian states/UTs):
   ```powershell
   Get-Content database/migration_add_states.sql | mysql -u root saviess_vep
   ```
3. Run any additional migrations as needed:
   ```powershell
   Get-Content database/migration_v2.sql | mysql -u root saviess_vep
   Get-Content database/migration_fm_teams.sql | mysql -u root saviess_vep
   Get-Content database/migration_pd_module.sql | mysql -u root saviess_vep
   Get-Content database/migration_rhp_registration.sql | mysql -u root saviess_vep
   Get-Content database/migration_rhp_cloud.sql | mysql -u root saviess_vep
   ```
   *(This creates the `saviess_vep` database, defines all relational tables, and seeds all Indian states. Run each migration only once.)*

---

### Step 2: Configure Environment Variables (First Time Only)
1. Verify that your `backend/.env` file has the correct database password. Since your local MySQL `root` user does not use a password, the database password setting must be blank:
   ```env
   DB_PASSWORD=
   ```

---

### Step 3: Install Dependencies (First Time Only)
1. From the project root directory, install all dependencies for both backend and frontend at once:
   ```bash
   npm run install:all
   ```

---

### Step 4: Populate Mock Data — Seeding (First Time Only)
1. Run the database seed script from your project root directory to pre-fill districts, blocks, warehouse inventory, and mock users:
   ```bash
   npm run seed
   ```

---

### Step 5: Start the Application 🚀
From the project root directory, run a **single command** to start both the backend and frontend simultaneously:
```bash
npm run dev
```
This will:
- Launch the **Backend API** at `http://localhost:5000`
- Launch the **Frontend React App** at `http://localhost:5173`

Both logs will appear in the same terminal, color-coded:
- 🔵 **BACKEND** — blue
- 🟢 **FRONTEND** — green

Press `Ctrl+C` to stop both servers at once.

---

### Step 6: Log In and Test
Open your web browser and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

Log in using any of the following credentials (password is **`Saviess@2026`** for all accounts):

| Role | Email |
|---|---|
| **Admin** (`super_admin`) | `admin@saviess.org` |
| **Program Director** | `pd@saviess.org` |
| **Field Manager** | `manager@saviess.org` |
| **Field Officer** | `fo@saviess.org` |
| **Rural Health Provider (RHP)** | `rhp@saviess.org` |

---

## Quick Reference

| Script | Description |
|---|---|
| `npm run setup` | **One command** — DB + migrations + deps + seed + start |
| `npm run dev` | Start both backend + frontend together |
| `npm run db:migrate` | Run all database migrations |
| `npm run install:all` | Install dependencies for both apps |
| `npm run seed` | Populate the database with mock data |
