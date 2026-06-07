# Vision Entrepreneur Platform - REST API Endpoints Map
**Base URL**: `/api/v1`

This API conforms to REST principles. Standard response formatting wraps data in `{ success: true, data: ... }` and errors in `{ success: false, error: "Error message details", code: "ERROR_CODE" }`.

---

## 1. Authentication & Users
Manages sessions, tokens, and administrative profiles.

### `POST /auth/login`
- **Access**: Public
- **Description**: Authenticate with email/password.
- **Request Body**:
  ```json
  {
    "email": "shyam.kumar@saviess.org",
    "password": "SecurePassword123"
  }
  ```
- **Response (200 OK)**: Sets `refreshToken` inside a secure HTTP-Only cookie. Returns JSON:
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "email": "shyam.kumar@saviess.org",
      "firstName": "Shyam",
      "lastName": "Kumar",
      "role": "field_officer"
    }
  }
  ```

### `POST /auth/logout`
- **Access**: Authenticated
- **Description**: Terminate session, clears refresh token cookies.
- **Response (200 OK)**:
  ```json
  { "success": true, "message": "Logged out successfully" }
  ```

### `POST /auth/refresh`
- **Access**: Public (Requires HTTP-Only Refresh Token Cookie)
- **Description**: Re-issue access token.
- **Response (200 OK)**: Returns new `accessToken`.

### `GET /users`
- **Access**: `super_admin`, `program_director`, `field_manager`
- **Description**: Get list of all platform user accounts.
- **Query Params**: `role` (optional), `isActive` (optional), `page`, `limit`.

### `POST /users`
- **Access**: `super_admin`
- **Description**: Provision a new backend user account.
- **Request Body**:
  ```json
  {
    "email": "sanjay.verma@saviess.org",
    "password": "InitialTempPassword125",
    "firstName": "Sanjay",
    "lastName": "Verma",
    "role": "field_manager",
    "phone": "+919876543210"
  }
  ```

---

## 2. RHP Onboarding & Applications
Handles candidate registrations, interview workflows, and basic profiles.

### `POST /applications`
- **Access**: Public / `field_officer` / `field_manager`
- **Description**: Submit a new Rural Health Provider application.
- **Request Body**:
  ```json
  {
    "firstName": "Preeti",
    "lastName": "Kumari",
    "gender": "female",
    "age": 28,
    "phone": "+918887776665",
    "districtId": 3,
    "blockId": 14,
    "village": "Harnaut",
    "qualification": "Graduate (B.A.)",
    "experience": "2 years volunteering with local ASHA health schemes."
  }
  ```

### `GET /applications`
- **Access**: `program_director`, `field_manager`
- **Description**: Search and list applicant submissions.
- **Query Params**: `status`, `districtId`, `blockId`.

### `PUT /applications/:id/status`
- **Access**: `program_director`, `field_manager`
- **Description**: Advance/adjust application review stage.
- **Request Body**:
  ```json
  {
    "status": "training_scheduled", // enum values: applied, under_review, interviewed, training_scheduled, approved, rejected
    "comments": "Cleared interview on June 7th. Candidate matches requirements."
  }
  ```

### `GET /rhps`
- **Access**: `program_director`, `field_manager`, `field_officer`
- **Description**: Get lists of successfully active/inactive RHPs.

---

## 3. Field Officer Visits & Real-time Tracking
Captures daily activity logs and coordinates geographic data.

### `GET /visits`
- **Access**: `program_director`, `field_manager`, `field_officer` (FOs see their own records)
- **Description**: Query scheduled and logged visit records.
- **Query Params**: `foId`, `status`, `startDate`, `endDate`.

### `POST /visits`
- **Access**: `field_manager`
- **Description**: Schedule and assign a field inspection visit.
- **Request Body**:
  ```json
  {
    "foId": 4,
    "targetRhpId": 12,
    "visitDate": "2026-06-10",
    "purpose": "routine" // routine, onboarding, training_audit, inventory_delivery, other
  }
  ```

### `POST /visits/:id/checkin`
- **Access**: `field_officer` (Owner)
- **Description**: Log GPS coordinate confirmation of arrival.
- **Request Body**:
  ```json
  {
    "latitude": 25.612456,
    "longitude": 85.145612
  }
  ```

### `POST /visits/:id/checkout`
- **Access**: `field_officer` (Owner)
- **Description**: Complete check-out, record log descriptions and attach proof photos.
- **Request Body**:
  ```json
  {
    "latitude": 25.612489,
    "longitude": 85.145634,
    "notes": "Verified inventory stock. Checked Snellen chart illumination. 2 test lenses damaged.",
    "proofImageId": 88 // ID of proof_uploads row
  }
  ```

### `GET /locations/live`
- **Access**: `program_director`, `field_manager`
- **Description**: Returns absolute latest location parameters of online FOs.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "foId": 4,
        "name": "Vivek Singh",
        "latitude": 25.594100,
        "longitude": 85.137600,
        "accuracy": 12.4,
        "batteryLevel": 88,
        "lastUpdated": "2026-06-07T09:19:00.000Z"
      }
    ]
  }
  ```

---

## 4. Training Batches & Logistics
Manages candidate training batches, attendee rosters, and financials.

### `POST /trainings/batches`
- **Access**: `program_director`, `field_manager`
- **Description**: Create a new training batch session.
- **Request Body**:
  ```json
  {
    "name": "June Vision Entrepreneur Batch - Patna Central",
    "startDate": "2026-06-15",
    "endDate": "2026-06-25",
    "trainerName": "Dr. R. K. Prasad"
  }
  ```

### `POST /trainings/batches/:id/attendance`
- **Access**: `field_manager`
- **Description**: Submit or update daily attendance logs.
- **Request Body**:
  ```json
  {
    "date": "2026-06-16",
    "attendance": [
      { "traineeUserId": 45, "isPresent": 1, "remarks": "" },
      { "traineeUserId": 46, "isPresent": 0, "remarks": "Sick leave" }
    ]
  }
  ```

### `PUT /trainings/batches/:id/fees/:userId`
- **Access**: `program_director`, `field_manager`
- **Description**: Record trainee course fee transaction updates.
- **Request Body**:
  ```json
  {
    "amountPaid": 500.00,
    "paymentStatus": "paid", // pending, partial, paid, waived
    "paymentMode": "upi",    // cash, upi, bank_transfer, other
    "transactionReference": "UPI983281920",
    "remarks": "Received online payment via GPAY"
  }
  ```

---

## 5. Patients, Screenings & Spectacles Dispensing
Captures core clinical screenings, prescription metadata, and glasses billing logic.

### `POST /patients`
- **Access**: `rhp`
- **Description**: Register a new patient in the RHP center records.
- **Request Body**:
  ```json
  {
    "firstName": "Ramesh",
    "lastName": "Yadav",
    "gender": "male",
    "age": 52,
    "phone": "+919934112233",
    "districtId": 3,
    "blockId": 14,
    "village": "Harnaut Village"
  }
  ```

### `POST /screenings`
- **Access**: `rhp`
- **Description**: Create patient visual assessment metrics record.
- **Request Body**:
  ```json
  {
    "patientId": 45,
    "screeningDate": "2026-06-07",
    "visualAcuityLeft": "6/18",
    "visualAcuityRight": "6/12",
    "sphericalLeft": 1.50,
    "sphericalRight": 1.25,
    "cylindricalLeft": -0.50,
    "cylindricalRight": 0.00,
    "axisLeft": 90,
    "axisRight": 0,
    "screeningType": "presbyopia", // presbyopia, refractive_error, cataract_suspect, normal, other
    "referralRecommended": 0
  }
  ```

### `POST /dispensings`
- **Access**: `rhp`
- **Description**: Record glass checkout, payments, and issue dynamic receipts.
- **Request Body**:
  ```json
  {
    "screeningId": 32,
    "patientId": 45,
    "dispensingDate": "2026-06-07",
    "leftPowerSph": 1.50,
    "rightPowerSph": 1.25,
    "leftPowerCyl": -0.50,
    "rightPowerCyl": 0.00,
    "frameType": "Full Rim",
    "frameColor": "Black Matte",
    "glassType": "reading",
    "cost": 150.00,
    "amountPaid": 150.00,
    "subsidyApplied": 0,
    "subsidyAmount": 0.00
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "invoiceNumber": "INV-2026-00341",
    "dispensingId": 12
  }
  ```

### `GET /dispensings/:id/pdf`
- **Access**: Authenticated (`rhp`, `field_officer`, Managers)
- **Description**: Generate and download bilingual receipt (English + Hindi) PDF containing clinical parameters and invoice billing details.
- **Response**: Binary PDF application stream (`Content-Type: application/pdf`).

---

## 6. Supply Chain & Requisition (Indents)
Facilitates warehouse inventory management and RHP stock requests.

### `GET /inventory/central`
- **Access**: `program_director`, `field_manager`
- **Description**: Read central warehouse stock counts. Supports power-wise filter queries.
- **Query Params**: `glassType`, `sph`, `cyl`, `lowStock` (boolean).

### `POST /indents`
- **Access**: `rhp`
- **Description**: Create a new stock requisition/indent order.
- **Request Body**:
  ```json
  {
    "requestDate": "2026-06-07",
    "items": [
      {
        "itemName": "Reading Glasses SPH +1.50",
        "sku": "RD-SPH+1.50-CYL-0.00",
        "glassType": "reading",
        "leftPowerSph": 1.50,
        "rightPowerSph": 1.50,
        "leftPowerCyl": 0.00,
        "rightPowerCyl": 0.00,
        "quantityRequested": 10,
        "unitPrice": 120.00
      }
    ]
  }
  ```

### `PUT /indents/:id/status`
- **Access**: `program_director` / `field_manager`
- **Description**: Update indent states.
- **Request Body**:
  ```json
  {
    "status": "dispatched", // pending_approval, approved, dispatched, delivered, cancelled
    "items": [
      { "itemId": 14, "quantityApproved": 10 } // Adjust quantities
    ]
  }
  ```
- **Action notes**: Updating to `dispatched` automatically decrements `inventory_central` stock numbers. Updating to `delivered` increments the local RHP's `inventory_rhp` records.

---

## 7. Media Uploads
Supports Cloudinary secure uploads.

### `POST /uploads/presign`
- **Access**: Authenticated
- **Description**: Request signature configuration to upload a file directly from client to Cloudinary.
- **Request Body**:
  ```json
  {
    "context": "visit_proof" // visit_proof, applicant_kyc, screening_proof
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "timestamp": 1780824987,
    "signature": "a67e2a9b3d01cf...",
    "folder": "visits",
    "apiKey": "123456789012345",
    "cloudName": "saviess-cloud"
  }
  ```
