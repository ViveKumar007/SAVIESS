const db = require('../config/db');
const { uploadStream } = require('../utils/uploadHandler');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

// ── Named constants (previously magic numbers) ──
const DEFAULT_UNIT_PRICE = 120.00;
const DEFAULT_SAFETY_STOCK = 2;

// ── Validation Helpers ──
const MOBILE_REGEX = /^\d{10}$/;
const AADHAAR_REGEX = /^\d{12}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const PIN_REGEX = /^\d{6}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Sanitize a string: trim whitespace and strip HTML tags.
 */
const sanitize = (val) => {
  if (val === null || val === undefined) return null;
  return String(val).trim().replace(/<[^>]*>/g, '');
};

/**
 * Generate the next application code in format RHP-YYYYMM-XXXXX.
 */
const generateAppCode = async (connection) => {
  const now = new Date();
  const prefix = `RHP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [rows] = await connection.query(
    'SELECT application_code FROM rhp_applications WHERE application_code LIKE ? ORDER BY application_code DESC LIMIT 1',
    [`${prefix}-%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const last = rows[0].application_code; // e.g. RHP-202606-00003
    const parts = last.split('-');
    seq = parseInt(parts[2]) + 1;
  }
  return `${prefix}-${String(seq).padStart(5, '0')}`;
};

// ============================================================================
// POST /api/v1/rhp/register — Public endpoint to submit an RHP application
// ============================================================================
const submitRegistration = async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Extract and sanitize all fields
    const data = {};
    const fields = [
      'fullName', 'gender', 'age', 'dateOfBirth', 'phone', 'email',
      'aadhaarNumber', 'panNumber', 'qualification', 'registrationNumber',
      'registrationAuthority', 'yearsOfExperience', 'districtId', 'blockId',
      'village', 'clinicName', 'address', 'state', 'pinCode',
      'hasConsultationSpace', 'hasScreeningSpace', 'hasElectricity',
      'hasSmartphone', 'hasInternet', 'storageSpace', 'medicineShop',
      'healthCampExperience', 'eyeCareExperience', 'whyJoinReason',
      'patientsPerDay', 'willingToInvest', 'bankAccountHolder', 'bankName',
      'bankAccountNumber', 'bankIfsc', 'declarationAgreed', 'isDraft'
    ];
    for (const f of fields) {
      data[f] = req.body[f] !== undefined ? req.body[f] : null;
    }

    // Sanitize text fields
    const textFields = [
      'fullName', 'email', 'aadhaarNumber', 'panNumber', 'qualification',
      'registrationNumber', 'registrationAuthority', 'village', 'clinicName',
      'address', 'state', 'pinCode', 'storageSpace', 'medicineShop',
      'healthCampExperience', 'eyeCareExperience', 'whyJoinReason',
      'bankAccountHolder', 'bankName', 'bankAccountNumber', 'bankIfsc', 'phone'
    ];
    for (const f of textFields) {
      data[f] = sanitize(data[f]);
    }

    const isDraft = data.isDraft === true || data.isDraft === 'true' || data.isDraft === 1;

    // ── Required fields validation (skip for drafts) ──
    if (!isDraft) {
      if (!data.fullName) return res.status(400).json({ success: false, error: 'Full Name is required' });
      if (!data.phone) return res.status(400).json({ success: false, error: 'Mobile Number is required' });
      if (!data.declarationAgreed || data.declarationAgreed === 'false' || data.declarationAgreed === '0') {
        return res.status(400).json({ success: false, error: 'Declaration must be agreed before submission' });
      }

      // Format validations
      const rawPhone = data.phone.replace(/\D/g, '').slice(-10);
      if (!MOBILE_REGEX.test(rawPhone)) return res.status(400).json({ success: false, error: 'Mobile Number must be 10 digits' });

      if (data.aadhaarNumber && !AADHAAR_REGEX.test(data.aadhaarNumber)) {
        return res.status(400).json({ success: false, error: 'Aadhaar Number must be exactly 12 digits' });
      }
      if (data.panNumber && !PAN_REGEX.test(data.panNumber.toUpperCase())) {
        return res.status(400).json({ success: false, error: 'PAN Number format is invalid (e.g. ABCDE1234F)' });
      }
      if (data.pinCode && !PIN_REGEX.test(data.pinCode)) {
        return res.status(400).json({ success: false, error: 'PIN Code must be exactly 6 digits' });
      }
      if (data.bankIfsc && !IFSC_REGEX.test(data.bankIfsc.toUpperCase())) {
        return res.status(400).json({ success: false, error: 'IFSC Code format is invalid (e.g. SBIN0001234)' });
      }
      if (data.email && !EMAIL_REGEX.test(data.email)) {
        return res.status(400).json({ success: false, error: 'Email format is invalid' });
      }
      if (data.dateOfBirth) {
        const dob = new Date(data.dateOfBirth);
        if (dob > new Date()) return res.status(400).json({ success: false, error: 'Date of Birth cannot be in the future' });
      }
    }

    // Split fullName into first_name and last_name for backward compat
    const nameParts = (data.fullName || 'Draft').trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Generate application code
    const applicationCode = await generateAppCode(connection);

    // Normalize phone
    const normalizedPhone = data.phone ? data.phone.replace(/\D/g, '').slice(-10) : '';

    const [result] = await connection.query(
      `INSERT INTO rhp_applications (
        application_code, full_name, first_name, last_name, gender, age, date_of_birth,
        phone, email, aadhaar_number, pan_number,
        qualification, registration_number, registration_authority, years_of_experience,
        district_id, block_id, village, clinic_name, address, state, pin_code,
        has_consultation_space, has_screening_space, has_electricity, has_smartphone, has_internet,
        storage_space, medicine_shop,
        health_camp_experience, eye_care_experience,
        why_join_reason, patients_per_day, willing_to_invest,
        bank_account_holder, bank_name, bank_account_number, bank_ifsc,
        declaration_agreed, is_draft, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationCode,
        data.fullName || 'Draft',
        firstName,
        lastName,
        data.gender || 'male',
        parseInt(data.age) || 0,
        data.dateOfBirth || null,
        normalizedPhone || null,
        data.email || null,
        data.aadhaarNumber || null,
        data.panNumber ? data.panNumber.toUpperCase() : null,
        data.qualification || null,
        data.registrationNumber || null,
        data.registrationAuthority || null,
        parseInt(data.yearsOfExperience) || 0,
        data.districtId ? parseInt(data.districtId) : null,
        data.blockId ? parseInt(data.blockId) : null,
        data.village || null,
        data.clinicName || null,
        data.address || null,
        data.state || 'Bihar',
        data.pinCode || null,
        data.hasConsultationSpace ? 1 : 0,
        data.hasScreeningSpace ? 1 : 0,
        data.hasElectricity ? 1 : 0,
        data.hasSmartphone ? 1 : 0,
        data.hasInternet ? 1 : 0,
        data.storageSpace || null,
        data.medicineShop || null,
        data.healthCampExperience || null,
        data.eyeCareExperience || null,
        data.whyJoinReason || null,
        parseInt(data.patientsPerDay) || 0,
        data.willingToInvest ? 1 : 0,
        data.bankAccountHolder || null,
        data.bankName || null,
        data.bankAccountNumber || null,
        data.bankIfsc ? data.bankIfsc.toUpperCase() : null,
        data.declarationAgreed ? 1 : 0,
        isDraft ? 1 : 0,
        isDraft ? 'applied' : 'applied'
      ]
    );

    const applicationId = result.insertId;

    // ── Handle file uploads ──
    const uploadedDocs = [];
    // upload.fields() returns { fieldname: [File, ...], ... } — flatten to a single array
    const allFiles = req.files ? Object.values(req.files).flat() : [];
    if (allFiles.length > 0) {
      for (const file of allFiles) {
        // Validate file type
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          continue; // Skip unsupported types silently
        }
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          continue; // Skip oversized files
        }

        // Determine document type from fieldname
        let docType = 'supporting';
        if (file.fieldname === 'photograph') docType = 'photograph';
        else if (file.fieldname === 'aadhaarDoc') docType = 'aadhaar';
        else if (file.fieldname === 'panDoc') docType = 'pan';
        else if (file.fieldname === 'registrationCert') docType = 'registration_certificate';
        else if (file.fieldname === 'supportingDocs') docType = 'supporting';

        const cloudResult = await uploadStream(file.buffer, 'rhp_applications');

        await connection.query(
          `INSERT INTO rhp_application_documents
           (application_id, document_type, file_name, file_url, public_id, file_size_bytes, mime_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [applicationId, docType, file.originalname, cloudResult.secure_url, cloudResult.public_id, file.size, file.mimetype]
        );

        uploadedDocs.push({
          type: docType,
          name: file.originalname,
          url: cloudResult.secure_url
        });
      }
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: isDraft ? 'Application saved as draft' : 'RHP Application submitted successfully',
      data: {
        applicationId,
        applicationCode,
        fullName: data.fullName,
        status: 'applied',
        documents: uploadedDocs
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('RHP Registration error:', error);
    res.status(500).json({ success: false, error: 'Failed to process application: ' + error.message });
  } finally {
    connection.release();
  }
};

// ============================================================================
// GET /api/v1/rhp — Admin list all RHP applications (paginated, filterable)
// ============================================================================
const getApplications = async (req, res) => {
  const { search, status, districtId, state, experience, startDate, endDate, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (a.full_name LIKE ? OR a.phone LIKE ? OR a.aadhaar_number LIKE ? OR a.application_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    if (districtId) {
      whereClause += ' AND a.district_id = ?';
      params.push(parseInt(districtId));
    }
    if (state) {
      whereClause += ' AND a.state = ?';
      params.push(state);
    }
    if (experience) {
      whereClause += ' AND a.years_of_experience >= ?';
      params.push(parseInt(experience));
    }
    if (startDate) {
      whereClause += ' AND a.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND a.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM rhp_applications a ${whereClause}`, params
    );

    const dataParams = [...params, parseInt(limit), offset];
    const [applications] = await db.query(
      `SELECT a.*, d.name as district_name, b.name as block_name
       FROM rhp_applications a
       LEFT JOIN districts d ON a.district_id = d.id
       LEFT JOIN blocks b ON a.block_id = b.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      dataParams
    );

    res.json({
      success: true,
      total: countResult[0].total,
      page: parseInt(page),
      totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
      data: applications
    });
  } catch (error) {
    console.error('Get RHP applications error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// GET /api/v1/rhp/:id — Admin view single application with documents
// ============================================================================
const getApplication = async (req, res) => {
  const { id } = req.params;

  try {
    const [apps] = await db.query(
      `SELECT a.*, d.name as district_name, b.name as block_name
       FROM rhp_applications a
       LEFT JOIN districts d ON a.district_id = d.id
       LEFT JOIN blocks b ON a.block_id = b.id
       WHERE a.id = ?`,
      [id]
    );

    if (apps.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    // Get associated documents
    const [docs] = await db.query(
      'SELECT * FROM rhp_application_documents WHERE application_id = ? ORDER BY document_type, created_at',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...apps[0],
        documents: docs
      }
    });
  } catch (error) {
    console.error('Get RHP application error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// PUT /api/v1/rhp/:id — Admin update application
// ============================================================================
const updateApplication = async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.query('SELECT id FROM rhp_applications WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    // Build dynamic SET clause from provided fields
    const allowedFields = {
      fullName: 'full_name', gender: 'gender', age: 'age', dateOfBirth: 'date_of_birth',
      phone: 'phone', email: 'email', aadhaarNumber: 'aadhaar_number', panNumber: 'pan_number',
      qualification: 'qualification', registrationNumber: 'registration_number',
      registrationAuthority: 'registration_authority', yearsOfExperience: 'years_of_experience',
      districtId: 'district_id', blockId: 'block_id', village: 'village',
      clinicName: 'clinic_name', address: 'address', state: 'state', pinCode: 'pin_code',
      storageSpace: 'storage_space', medicineShop: 'medicine_shop',
      healthCampExperience: 'health_camp_experience', eyeCareExperience: 'eye_care_experience',
      whyJoinReason: 'why_join_reason', patientsPerDay: 'patients_per_day',
      willingToInvest: 'willing_to_invest', bankAccountHolder: 'bank_account_holder',
      bankName: 'bank_name', bankAccountNumber: 'bank_account_number', bankIfsc: 'bank_ifsc',
      comments: 'comments'
    };

    const setClauses = [];
    const setParams = [];

    for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
      if (req.body[jsKey] !== undefined) {
        setClauses.push(`${dbCol} = ?`);
        setParams.push(sanitize(req.body[jsKey]));
      }
    }

    // Boolean fields
    const boolFields = {
      hasConsultationSpace: 'has_consultation_space', hasScreeningSpace: 'has_screening_space',
      hasElectricity: 'has_electricity', hasSmartphone: 'has_smartphone', hasInternet: 'has_internet'
    };
    for (const [jsKey, dbCol] of Object.entries(boolFields)) {
      if (req.body[jsKey] !== undefined) {
        setClauses.push(`${dbCol} = ?`);
        setParams.push(req.body[jsKey] ? 1 : 0);
      }
    }

    setClauses.push('updated_by_user_id = ?');
    setParams.push(req.user.userId);

    // Update full_name split into first/last for backward compat
    if (req.body.fullName) {
      const parts = req.body.fullName.trim().split(/\s+/);
      setClauses.push('first_name = ?', 'last_name = ?');
      setParams.push(parts[0], parts.slice(1).join(' ') || '');
    }

    setParams.push(id);
    await db.query(
      `UPDATE rhp_applications SET ${setClauses.join(', ')} WHERE id = ?`,
      setParams
    );

    res.json({ success: true, message: 'Application updated successfully' });
  } catch (error) {
    console.error('Update RHP application error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// DELETE /api/v1/rhp/:id — Admin delete application
// ============================================================================
const deleteApplication = async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.query('SELECT id FROM rhp_applications WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    // Delete documents first (cascade should handle it, but be explicit)
    await db.query('DELETE FROM rhp_application_documents WHERE application_id = ?', [id]);
    await db.query('DELETE FROM rhp_applications WHERE id = ?', [id]);

    res.json({ success: true, message: 'Application deleted successfully' });
  } catch (error) {
    console.error('Delete RHP application error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// PUT /api/v1/rhp/:id/status — Admin approve/reject application
// ============================================================================
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comments } = req.body;

  const validStatuses = ['applied', 'under_review', 'interviewed', 'training_scheduled', 'approved', 'rejected'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [apps] = await connection.query('SELECT * FROM rhp_applications WHERE id = ?', [id]);
    if (apps.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const app = apps[0];

    if (app.status === 'approved' && status === 'approved') {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Application is already approved' });
    }

    await connection.query(
      'UPDATE rhp_applications SET status = ?, comments = ?, updated_by_user_id = ? WHERE id = ?',
      [status, comments || app.comments, req.user.userId, id]
    );

    let createdUser = null;
    let createdRhp = null;

    // Auto-create RHP account on approval (reuses existing pattern)
    if (status === 'approved') {
      const bcrypt = require('bcrypt');
      const phone = app.phone;
      const [existingUsers] = await connection.query('SELECT id FROM users WHERE phone = ?', [phone]);
      let userId;

      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        await connection.query('UPDATE users SET role = "rhp" WHERE id = ?', [userId]);
      } else {
        const fName = app.first_name || app.full_name?.split(' ')[0] || 'RHP';
        const lName = app.last_name || app.full_name?.split(' ').slice(1).join(' ') || '';
        const slug = `${fName.toLowerCase().replace(/\s+/g, '')}.${lName.toLowerCase().replace(/\s+/g, '')}`;
        const randomNum = Math.floor(100 + Math.random() * 900);
        const email = app.email || `${slug}${randomNum}@saviess.org`;

        const salt = await bcrypt.genSalt(10);
        const last4 = phone.replace(/\D/g, '').slice(-4);
        const defaultPassword = `Saviess@${last4}`;
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        const [userResult] = await connection.query(
          'INSERT INTO users (email, password_hash, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, "rhp", ?)',
          [email, passwordHash, fName, lName, phone]
        );
        userId = userResult.insertId;
        createdUser = { email, defaultPassword };
      }

      // Create RHP Profile
      const centerName = `${app.full_name || app.first_name}'s Vision Center`;
      const [rhpResult] = await connection.query(
        `INSERT INTO rhps (user_id, application_id, center_name, district_id, block_id, village, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [userId, id, centerName, app.district_id, app.block_id, app.village || '']
      );
      const rhpId = rhpResult.insertId;
      createdRhp = { id: rhpId, centerName };

      // Seed default inventory
      const STANDARD_POWERS = [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
      for (const power of STANDARD_POWERS) {
        const pStr = power.toFixed(2);
        await connection.query(
          `INSERT INTO inventory_rhp
           (rhp_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, safety_stock_level, unit_price)
           VALUES (?, ?, ?, 'reading', ?, ?, 0.00, 0.00, 0, ?, ?)`,
          [rhpId, `Reading Glasses SPH +${pStr}`, `RD-SPH+${pStr}-CYL-0.00`, power, power, DEFAULT_SAFETY_STOCK, DEFAULT_UNIT_PRICE]
        );
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: `Application status updated to '${status}'`,
      createdUser,
      createdRhp
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update RHP status error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  } finally {
    connection.release();
  }
};

// ============================================================================
// GET /api/v1/rhp/export — Admin export applications as XLSX/CSV/PDF
// ============================================================================
const exportApplications = async (req, res) => {
  const { format = 'xlsx', search, status, districtId, state, experience, startDate, endDate } = req.query;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (a.full_name LIKE ? OR a.phone LIKE ? OR a.aadhaar_number LIKE ? OR a.application_code LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (status) { whereClause += ' AND a.status = ?'; params.push(status); }
    if (districtId) { whereClause += ' AND a.district_id = ?'; params.push(parseInt(districtId)); }
    if (state) { whereClause += ' AND a.state = ?'; params.push(state); }
    if (experience) { whereClause += ' AND a.years_of_experience >= ?'; params.push(parseInt(experience)); }
    if (startDate) { whereClause += ' AND a.created_at >= ?'; params.push(startDate); }
    if (endDate) { whereClause += ' AND a.created_at <= ?'; params.push(endDate + ' 23:59:59'); }

    const [rows] = await db.query(
      `SELECT a.application_code, a.full_name, a.phone, a.email, a.gender, a.age,
              a.aadhaar_number, a.pan_number, a.qualification, a.years_of_experience,
              d.name as district_name, a.state, a.village, a.clinic_name, a.pin_code,
              a.status, a.created_at
       FROM rhp_applications a
       LEFT JOIN districts d ON a.district_id = d.id
       ${whereClause}
       ORDER BY a.created_at DESC`,
      params
    );

    if (format === 'csv' || format === 'xlsx') {
      const wsData = [
        ['Application ID', 'Full Name', 'Mobile', 'Email', 'Gender', 'Age',
         'Aadhaar', 'PAN', 'Qualification', 'Experience (Yrs)',
         'District', 'State', 'Village', 'Clinic', 'PIN',
         'Status', 'Applied Date'],
        ...rows.map(r => [
          r.application_code, r.full_name, r.phone, r.email || '', r.gender, r.age,
          r.aadhaar_number || '', r.pan_number || '', r.qualification || '', r.years_of_experience,
          r.district_name || '', r.state || '', r.village || '', r.clinic_name || '', r.pin_code || '',
          r.status, r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : ''
        ])
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'RHP Applications');

      if (format === 'csv') {
        const csvString = XLSX.utils.sheet_to_csv(ws);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=rhp_applications.csv');
        return res.send(csvString);
      }

      const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=rhp_applications.xlsx');
      return res.send(xlsxBuffer);

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=rhp_applications.pdf');
      doc.pipe(res);

      doc.fontSize(16).text('RHP Applications Report', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(8).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
      doc.moveDown(1);

      // Table header
      const cols = ['App ID', 'Name', 'Mobile', 'District', 'Status', 'Date'];
      const colWidths = [100, 140, 80, 100, 80, 80];
      let y = doc.y;
      let x = 30;

      doc.fontSize(8).fillColor('#333');
      cols.forEach((col, i) => {
        doc.font('Helvetica-Bold').text(col, x, y, { width: colWidths[i] });
        x += colWidths[i] + 10;
      });
      y += 18;
      doc.moveTo(30, y).lineTo(780, y).stroke('#ddd');
      y += 5;

      doc.font('Helvetica').fontSize(7).fillColor('#444');
      for (const r of rows) {
        if (y > 540) {
          doc.addPage();
          y = 30;
        }
        x = 30;
        const rowData = [
          r.application_code || '', r.full_name || '', r.phone || '',
          r.district_name || '', r.status || '',
          r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : ''
        ];
        rowData.forEach((val, i) => {
          doc.text(val, x, y, { width: colWidths[i] });
          x += colWidths[i] + 10;
        });
        y += 14;
      }

      doc.end();
      return;
    }

    res.status(400).json({ success: false, error: 'Invalid format. Use xlsx, csv, or pdf.' });
  } catch (error) {
    console.error('Export RHP applications error:', error);
    res.status(500).json({ success: false, error: 'Export failed: ' + error.message });
  }
};

module.exports = {
  submitRegistration,
  getApplications,
  getApplication,
  updateApplication,
  deleteApplication,
  updateStatus,
  exportApplications
};
