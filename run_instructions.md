# Steps to Run the Vision Entrepreneur Platform

Follow these steps to run the frontend and backend applications locally, using the same setup and commands that were validated on your system.

---

### Step 1: Set Up the MySQL Database (First Time Only)
1. Open your terminal and start the MySQL monitor as the root user:
   ```bash
   mysql -u root
   ```
2. Inside the MySQL prompt, load and run the database schema setup:
   ```sql
   source database/schema.sql
   ```
3. Run the states migration to add multi-state support (all 36 Indian states/UTs):
   ```sql
   source database/migration_add_states.sql
   ```
   *(This creates the `saviess_vep` database, defines all relational tables, and seeds all Indian states. Once complete, exit by typing `exit;` or `quit;`)*.

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

## Quick Reference (After First-Time Setup)

Once you've completed the first-time setup (Steps 1–4), you only need **one command** to start everything:

```bash
npm run dev
```

| Script | Description |
|---|---|
| `npm run dev` | Start both backend + frontend together |
| `npm run install:all` | Install dependencies for both apps |
| `npm run seed` | Populate the database with mock data |
