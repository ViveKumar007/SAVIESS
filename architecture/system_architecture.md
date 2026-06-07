# Vision Entrepreneur Platform - System Architecture & Tech Design
**A joint initiative between Preheal, SAVIESS, and VisionSpring in Bihar, India.**

This document details the software architecture, system boundaries, security designs, real-time socket events, media storage patterns, and project timeline for the Vision Entrepreneur Platform (VEP).

---

## 1. System Architecture Diagram

Below is the high-level system architecture illustrating the networking layers, application services, persistent stores, and third-party API integrations.

```mermaid
graph TB
    subgraph Clients ["Client Layer (Web & Mobile Web)"]
        A[Field Officer App] -- "HTTPS API / WS Location" --> E[API Gateway / Load Balancer]
        B[RHP Interface] -- "HTTPS API (Refraction/Dispensing)" --> E
        C[Admin Web Dashboard] -- "HTTPS API / WS Map Updates" --> E
    end

    subgraph ServiceLayer ["Application Service Layer (Railway/Render)"]
        E -- "Traffic Routing" --> F[Node.js / Express Backend Server]
        F -- "JWT Auth & RBAC" --> G[Auth Middleware]
        F -- "Real-time Coordinator" --> H[Socket.io Server]
        F -- "Task Runner" --> I[PDF Engine (PDFKit/Puppeteer)]
    end

    subgraph CacheRealtime ["Real-time & Cache Layer (Redis)"]
        H <--> J[(Redis Adapter & Cache)]
        note[Cache Active FO Lat/Long] --> J
    end

    subgraph DatabaseLayer ["Data Storage Layer"]
        F <--> K[(MySQL 8.0 Database)]
        style K fill:#339933,stroke:#fff,stroke-width:2px
    end

    subgraph ExternalIntegrations ["Third-Party Service Layer"]
        F -- "Presigned URLs & Deletion" --> L[Cloudinary API]
        F -- "Static Assets / Maps" --> M[Leaflet.js Map Assets]
        A -- "Direct Upload (Signed)" --> L
    end

    classDef database fill:#f9f,stroke:#333,stroke-width:2px;
    class K database;
```

### Components Description:
- **Client Layer**: React-based responsive web app styled with Tailwind CSS, optimized for mobile browser rendering since Field Officers and RHPs use low-cost Android mobile devices.
- **API Gateway / Load Balancer**: Serves as SSL termination point and routes incoming requests.
- **Node.js/Express Backend**: Core REST API endpoint provider. Processes clinical database queries, implements transactional database integrity using the `mysql2` pool, and issues/validates JSON Web Tokens (JWT).
- **Socket.io Server**: Maintains persistent TCP connection with online Field Officers (location broadcasting) and Admin Dashboards (visual mapping).
- **Redis Cache**: Holds transient, hot-swappable data such as the active coordinates of online Field Officers. Coordinates multi-instance socket communication (scaling helper).
- **MySQL Database**: Persistent storage layer containing clinical records, inventory catalogs, logs, and user credentials.
- **Cloudinary**: Object storage container for proof-of-visit photo verification and KYC documents. Clients upload files directly to Cloudinary using signed parameters requested from the backend API.

---

## 2. Folder Structure

The application is organized as a unified monorepo for simplified deployment orchestration.

```
saviess-vep/
├── package.json
├── README.md
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── app.js                 # Express app initialization
│   │   ├── server.js              # Server bootstrapper & Socket.io setup
│   │   ├── config/
│   │   │   ├── db.js              # mysql2 pool configuration
│   │   │   ├── cloudinary.js      # Cloudinary SDK config
│   │   │   └── redis.js           # Redis client (if deployed)
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── visitController.js
│   │   │   ├── inventoryController.js
│   │   │   ├── patientController.js
│   │   │   └── reportController.js
│   │   ├── middlewares/
│   │   │   ├── authMiddleware.js  # JWT and RBAC validators
│   │   │   └── errorMiddleware.js # Centralized Express error handler
│   │   ├── models/
│   │   │   └── [Queries & schemas mapped to MySQL database...]
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── visitRoutes.js
│   │   │   ├── inventoryRoutes.js
│   │   │   ├── patientRoutes.js
│   │   │   └── uploadRoutes.js
│   │   ├── services/
│   │   │   ├── pdfService.js      # Receipt generation engine
│   │   │   └── locationService.js # Process FO coordinates
│   │   ├── sockets/
│   │   │   └── locationSocket.js  # Socket.io connection and message handler
│   │   └── utils/
│   │       ├── helpers.js
│   │       └── validators.js      # Joi/Zod request validation rules
│   └── tests/                     # Jest integration and unit tests
│
└── frontend/
    ├── package.json
    ├── tailwind.config.js
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css              # Global styles & Tailwind directives
        ├── assets/                # Logos, icons, default avatars
        ├── components/
        │   ├── common/            # Button, Input, Modal, Loader
        │   ├── layout/            # Sidebar, Navbar, PageWrapper
        │   ├── maps/              # Leaflet Map tracking component
        │   └── stats/             # Dashboard widget containers
        ├── contexts/
        │   ├── AuthContext.jsx    # Authentication & User state
        │   └── SocketContext.jsx  # Socket.io listener context
        ├── hooks/
        │   ├── useGeolocation.jsx # Custom hook capturing FO GPS coordinates
        │   └── useDebounce.jsx
        ├── pages/
        │   ├── Login.jsx
        │   ├── AdminDashboard.jsx
        │   ├── Screenings.jsx
        │   ├── Inventory.jsx
        │   └── Visits.jsx
        └── services/
            ├── api.js             # Central Axios client with interceptors
            ├── socket.js          # Socket.io client setup
            └── cloudinary.js      # Helper for file uploads
```

---

## 3. Authentication & Role-Based Access Control (RBAC)

The system enforces user security using JSON Web Tokens (JWT) stored securely.

### Access & Refresh Token Strategy
1. **Access Token (Short-lived)**: Valid for 15 minutes. Included in the API HTTP Request headers as `Authorization: Bearer <access_token>`. Contains user metadata (ID, email, name, role, profile references).
2. **Refresh Token (Long-lived)**: Valid for 7 days. Stored inside a secure, `HttpOnly`, `SameSite=Strict`, `Secure` (production) cookie. Used solely to request a new access token at `/api/v1/auth/refresh`.

### User Role Matrix & RBAC Permissions

| Role | Description | Core Clearances |
| :--- | :--- | :--- |
| `super_admin` | Technical administrator. | Full database CRUD. Master seed lists (districts, blocks). Deactivate users. View system audit logs. |
| `program_director` | Top management sponsor. | View consolidated multi-district analytics. Authorize big indents. View financial sheets and training batches. |
| `field_manager` | Regional manager for FOs. | Manage and monitor FOs. Review and sign-off daily FO visits. Manage training cohorts. View local metrics. |
| `field_officer` | Ground coordinator. | Create visit logs. Record real-time GPS locations. Audit RHP centers. Initiate inventory deliveries. |
| `rhp` | Rural Health Provider / Vision Entrepreneur. | Patient registration. Log screenings & refraction details. Sell and dispense glasses. Request inventory indents. |

### JWT Claims Payload Format
```json
{
  "userId": 1024,
  "email": "vivek.singh@saviess.org",
  "role": "field_officer",
  "profileId": 12,        // Links to field_officers.id
  "districtId": 3,
  "blockId": 14,
  "exp": 1780824900
}
```

---

## 4. Socket.io Event Schema (Real-time FO Tracking)

To achieve real-time location mapping of Field Officers, the system uses Socket.io. Below is the event sequence and channel protocol.

```
       Field Officer (FO)                     Socket.io Server                   Admin Dashboard
             │                                       │                                  │
             ├──────── 1. Authenticate ─────────────>│                                  │
             │         (Pass JWT in query)           │                                  │
             │                                       │                                  │
             │                                       ├─────── 2. Join "admins" room ───>│
             │                                       │                                  │
             ├──────── 3. Emit: fo:location:update ─>│                                  │
             │         (lat, lng, accuracy, battery) │                                  │
             │                                       ├─────── 4. Broadcast: ───────────>│
             │                                       │           fo:location:broadcast  │
             │                                       │           (data payload)         │
```

### Event Mappings & Schemas

#### A. Handshake (Auth)
The client must send the JWT token during the handshake stage:
```javascript
const socket = io("https://api.saviess.org", {
  auth: {
    token: `Bearer ${accessToken}`
  }
});
```

#### B. Event: `fo:location:update`
- **Sender**: Field Officer client.
- **Trigger**: Every 30 seconds when the app is in tracking mode, or on check-in/check-out.
- **Payload**:
```json
{
  "latitude": 25.5941,
  "longitude": 85.1376,
  "accuracy": 8.5,        // GPS accuracy in meters
  "batteryLevel": 85,     // Device battery level percentage
  "timestamp": "2026-06-07T09:19:00.000Z"
}
```
- **Server Actions**:
  1. Validates FO session from token.
  2. Updates `fo_live_location` table (upsert).
  3. Writes to `fo_location_history` (bulk background insert).
  4. Broadcasts to connected admins.

#### C. Event: `fo:location:broadcast`
- **Sender**: Server (Socket.io).
- **Recipient**: Members of the `admins` room (Admins, Directors, Managers).
- **Payload**:
```json
{
  "foId": 12,
  "name": "Vivek Singh",
  "latitude": 25.5941,
  "longitude": 85.1376,
  "accuracy": 8.5,
  "batteryLevel": 85,
  "lastUpdated": "2026-06-07T09:19:01.000Z"
}
```

#### D. Event: `fo:status:change`
- **Sender**: Field Officer client.
- **Trigger**: Logging check-in / check-out on a visit.
- **Payload**:
```json
{
  "visitId": 145,
  "status": "checked_in", // 'checked_in', 'checked_out'
  "timestamp": "2026-06-07T09:19:00.000Z"
}
```

---

## 5. Cloudinary Upload Integration Workflow

To handle image uploads efficiently without overburdening the Node.js API server, clients upload files directly to Cloudinary.

```
Client (App)                     Backend API                       Cloudinary
     │                                │                                │
     ├────── 1. POST /presign ───────>│                                │
     │          (Request signed upload)│                                │
     │                                │                                │
     │<───── 2. Return Signature ─────┤                                │
     │          (Timestamp, Signature)│                                │
     │                                                                 │
     ├────── 3. POST direct upload (binary + signature) -------------->│
     │                                                                 │
     │<───── 4. Return URL & Public ID ────────────────────────────────┤
     │                                                                 │
     ├────── 5. POST /visits/:id/proof ───────────────────────────────>│
     │          (Submit form with image URL & public_id)               │
     │                                │                                │
     │<───── 6. Confirm and Save ─────┤                                │
```

### Steps for Cloudinary Upload:
1. **Request Upload Signature**:
   - Client requests verification credentials by hitting: `POST /api/v1/uploads/presign` (Authenticated).
   - Server validates role permissions and uses the Cloudinary SDK to sign an upload parameters request (payload contains: target folder e.g. `visits`, expiration timestamp).
2. **Execute Direct Upload**:
   - Client sends a `multipart/form-data` request directly to: `https://api.cloudinary.com/v1_1/<cloud_name>/image/upload`.
   - Payload must contain: `file` binary data, `api_key`, `timestamp`, `signature`, and `folder`.
3. **Register Resource**:
   - Cloudinary processes the upload and responds with the storage `secure_url` and `public_id`.
   - Client sends this data to the backend API (`POST /api/v1/visits/visit_id/checkin` or `/api/v1/uploads/register`) to store in the `proof_uploads` database table.

---

## 6. Week-by-Week Development Roadmap (8 Weeks)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       8-WEEK DEVELOPMENT TIMELINE                           │
├────────┬────────────────────────────────────────────────────────────────────┤
│ Week 1 │ Core Infrastructure, Database DDL Setup, JWT Auth & RBAC Middleware│
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 2 │ RHP Applications & Onboarding Workflow                             │
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 3 │ Training Batches, Attendance Tracker & Fee Logging                 │
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 4 │ Patient Registry & Refraction Screening Module                     │
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 5 │ Power-wise Inventory System, Indent/Requisition Flow               │
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 6 │ FO Visit Logging, GPS Tracking via Socket.io & Leaflet.js Mapping  │
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 7 │ Bilingual PDF Receipt Generator & Admin Analytics Dashboard        │
├────────┼────────────────────────────────────────────────────────────────────┤
│ Week 8 │ System Integration, Security Audits, E2E Testing & Deployment      │
└────────┴────────────────────────────────────────────────────────────────────┘
```

### Phase Details

#### Week 1: Project Setup & Authentication
- Initialize Express backend and Vite/React frontend repositories.
- Provision hosting databases (MySQL on Railway/Render). Apply `schema.sql`.
- Write core DB client wrappers utilizing the `mysql2/promise` pool.
- Implement User registration, login, and token-refresh endpoints. Write JWT authentication parser and authorization middlewares.

#### Week 2: RHP Recruitment & Onboarding Module
- Build frontend registration portal for candidate RHPs (`rhp_applications` submission UI).
- Develop back-office reviewer console for `program_director` and `field_manager` to update application states (`applied` -> `under_review` -> `interviewed` -> `approved`).
- Set up administrative boundaries data tables (`districts` & `blocks` CRUD).

#### Week 3: Capacity Building & Training Manager
- Implement API and UI interfaces to create and manage training cohorts (`training_batches`).
- Build training session logging: daily attendance registration form (`training_attendance`).
- Add payment tracking tools for training programs, recording deposits or fee waivers (`training_fees`).

#### Week 4: Clinical Screenings Module
- Implement primary patient registration interface (`patients` table CRUD).
- Design refraction check module: user-friendly form matching clinical criteria (capturing left/right visual acuity, spherical, cylindrical, axis parameters).
- Create automated screening outcome recommendations logic (`presbyopia`, `refractive_error`, `cataract_suspect`).

#### Week 5: Supply Chain & Inventory Control
- Construct inventory item catalogues. Write database indexes facilitating power-wise SKU matching (e.g. SPH, CYL combinations).
- Implement stock management interfaces for Central Warehouse (`inventory_central`) and local RHP inventories (`inventory_rhp`).
- Build the automated indent/requisition request form. Integrate workflow approval lifecycle (`draft` -> `pending_approval` -> `approved` -> `dispatched` -> `delivered`). Add inventory stock reduction triggers when indents are dispatched.

#### Week 6: Field Operations & Location Tracking
- Build visit logger interface for Field Officers (`fo_visits`) capturing coordinates, date, and check-in times.
- Implement Leaflet.js rendering component on the Admin Panel.
- Setup backend Socket.io adapter. Write mobile background geolocation scheduler that fires socket updates. Link updates to update `fo_live_location` and log breadcrumbs inside `fo_location_history`.

#### Week 7: Invoicing & Visual Dashboards
- Integrate backend PDF generation service to render bilingual (English + Hindi) glasses receipt templates.
- Program invoice download routes that convert screening and billing data into structured PDFs on-the-fly.
- Design central analytics page mapping cumulative figures: total patients screened, glasses dispensed, geographic distribution (district/block) maps, and pending inventory alerts.

#### Week 8: Verification & Production Release
- Implement comprehensive input data validation (using libraries like Joi/Zod) to prevent SQL Injections and XSS payloads.
- Run integration testing across real-time sockets under mock latency conditions.
- Configure continuous integration (CI/CD) pipelines deploying code to Render/Railway. Set up automated environment configuration (.env variables). Hand over operational manuals.
