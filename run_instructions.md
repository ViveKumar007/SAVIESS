# Steps to Run the Vision Entrepreneur Platform

Follow these steps to run the frontend and backend applications locally, using the same setup and commands that were validated on your system.

---

### Step 1: Set Up the MySQL Database
1. Open your terminal and start the MySQL monitor as the root user:
   ```bash
   mysql -u root
   ```
2. Inside the MySQL prompt, load and run the database schema setup:
   ```sql
   source database/schema.sql
   ```
   *(This creates the `saviess_vep` database and defines all 23 relational tables. Once complete, exit by typing `exit;` or `quit;`)*.

---

### Step 2: Configure Environment Variables
1. Verify that your `backend/.env` file has the correct database password. Since your local MySQL `root` user does not use a password, the database password setting must be blank:
   ```env
   DB_PASSWORD=
   ```

---

### Step 3: Populate Mock Data (Seeding)
1. Run the database seed script from your project root directory to pre-fill districts, blocks, warehouse inventory, and mock users:
   ```bash
   node backend/src/config/seed.js
   ```

---

### Step 4: Start the Backend API Server
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the backend dependencies (if you haven't already):
   ```bash
   npm install
   ```
3. Run the backend development server:
   ```bash
   npm run dev
   ```
   *The API server will launch at `http://localhost:5000`.*

---

### Step 5: Start the Frontend React App
1. Open a new terminal window/tab and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the frontend dependencies (if you haven't already):
   ```bash
   npm install
   ```
3. Start the Vite React development server:
   ```bash
   npm run dev
   ```
   *The client dashboard will launch at `http://localhost:5173`.*

---

### Step 6: Log In and Test
Open your web browser and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

Log in using any of the following credentials (password is **`Saviess@2026`** for all accounts):
* **Admin Dashboard**: `admin@saviess.org`
* **Field Officer Dashboard**: `fo@saviess.org`
* **Rural Health Provider Interface**: `rhp@saviess.org`
