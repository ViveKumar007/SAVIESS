const db = require('../config/db');

// ── Named constants (previously magic numbers) ──
const DEFAULT_REFERRAL_FACILITY = 'Saviess Base Hospital';

// Helper to escape special characters for PDF string literals
const pdfEscape = (str) => {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
};

// Get all patients (role-filtered for RHP)
const getPatients = async (req, res) => {
  try {
    const [rhps] = await db.query('SELECT id FROM rhps WHERE user_id = ?', [req.user.userId]);
    if (rhps.length === 0) {
      return res.status(403).json({ success: false, error: 'Only registered RHPs can view patients' });
    }
    const rhpId = rhps[0].id;

    const [patients] = await db.query(
      `SELECT p.*, d.name as district_name, b.name as block_name 
       FROM patients p
       JOIN districts d ON p.district_id = d.id
       JOIN blocks b ON p.block_id = b.id
       WHERE p.created_by_rhp_id = ?
       ORDER BY p.created_at DESC`,
      [rhpId]
    );
    res.json({ success: true, data: patients });
  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all RHP centers (for FO dropdown)
const getAllRhps = async (req, res) => {
  try {
    const [rhps] = await db.query(
      `SELECT r.id, r.center_name, r.village, r.status, r.district_id, r.block_id,
              d.name as district_name, b.name as block_name,
              u.first_name, u.last_name, u.phone
       FROM rhps r
       JOIN districts d ON r.district_id = d.id
       JOIN blocks b ON r.block_id = b.id
       JOIN users u ON r.user_id = u.id
       WHERE r.status = 'active'
       ORDER BY r.center_name ASC`
    );
    res.json({ success: true, data: rhps });
  } catch (error) {
    console.error('Get all RHPs error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Register a new patient
const registerPatient = async (req, res) => {
  const { firstName, lastName, gender, age, phone, districtId, blockId, village } = req.body;

  if (!firstName || !lastName || !gender || !age || !districtId || !blockId || !village) {
    return res.status(400).json({ success: false, error: 'Required fields missing: firstName, lastName, gender, age, districtId, blockId, village' });
  }

  try {
    // Get RHP profile ID associated with user
    const [rhps] = await db.query('SELECT id FROM rhps WHERE user_id = ?', [req.user.userId]);
    if (rhps.length === 0) {
      return res.status(403).json({ success: false, error: 'Only registered RHPs can register patients' });
    }
    const rhpId = rhps[0].id;

    const [result] = await db.query(
      `INSERT INTO patients 
       (first_name, last_name, gender, age, phone, district_id, block_id, village, created_by_rhp_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, gender, parseInt(age), phone || '', parseInt(districtId), parseInt(blockId), village, rhpId]
    );

    res.status(201).json({
      success: true,
      message: 'Patient registered successfully',
      data: {
        id: result.insertId,
        firstName,
        lastName,
        phone
      }
    });
  } catch (error) {
    console.error('Register patient error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Log visual assessment screening
const logScreening = async (req, res) => {
  const { patientId, screeningDate, visualAcuityLeft, visualAcuityRight, sphericalLeft, sphericalRight, cylindricalLeft, cylindricalRight, axisLeft, axisRight, screeningType, referralRecommended } = req.body;

  if (!patientId || !screeningDate || !visualAcuityLeft || !visualAcuityRight || !screeningType) {
    return res.status(400).json({ success: false, error: 'Required fields missing: patientId, screeningDate, visualAcuityLeft, visualAcuityRight, screeningType' });
  }

  try {
    const [rhps] = await db.query('SELECT id FROM rhps WHERE user_id = ?', [req.user.userId]);
    if (rhps.length === 0) {
      return res.status(403).json({ success: false, error: 'Only registered RHPs can log patient screenings' });
    }
    const rhpId = rhps[0].id;

    // Verify patient exists
    const [patients] = await db.query('SELECT id FROM patients WHERE id = ?', [patientId]);
    if (patients.length === 0) {
      return res.status(404).json({ success: false, error: 'Patient profile not found' });
    }

    const [result] = await db.query(
      `INSERT INTO screenings 
       (patient_id, screened_by_rhp_id, screening_date, visual_acuity_left, visual_acuity_right, 
        spherical_left, spherical_right, cylindrical_left, cylindrical_right, axis_left, axis_right, 
        screening_type, referral_recommended) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(patientId), rhpId, screeningDate, visualAcuityLeft, visualAcuityRight,
        sphericalLeft !== undefined ? parseFloat(sphericalLeft) : null,
        sphericalRight !== undefined ? parseFloat(sphericalRight) : null,
        cylindricalLeft !== undefined ? parseFloat(cylindricalLeft) : null,
        cylindricalRight !== undefined ? parseFloat(cylindricalRight) : null,
        axisLeft !== undefined ? parseInt(axisLeft) : null,
        axisRight !== undefined ? parseInt(axisRight) : null,
        screeningType, referralRecommended ? 1 : 0
      ]
    );

    const screeningId = result.insertId;

    // If referral is recommended, automatically create pending referral record
    if (referralRecommended) {
      await db.query(
        `INSERT INTO referrals (screening_id, patient_id, referred_by_rhp_id, referred_to_facility, referral_reason, status) 
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [screeningId, parseInt(patientId), rhpId, DEFAULT_REFERRAL_FACILITY, screeningType === 'cataract_suspect' ? 'cataract' : 'severe_refractive_error']
      );
    }

    res.status(201).json({
      success: true,
      message: 'Patient refraction screening logged successfully',
      data: {
        screeningId,
        patientId,
        screeningType,
        referralRecommended
      }
    });
  } catch (error) {
    console.error('Log screening error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Log glass dispensing (Sales & Stock Deductions)
const dispenseGlasses = async (req, res) => {
  const { screeningId, patientId, dispensingDate, leftPowerSph, rightPowerSph, leftPowerCyl, rightPowerCyl, frameType, frameColor, glassType, cost, amountPaid, subsidyApplied, subsidyAmount } = req.body;

  if (!screeningId || !patientId || !dispensingDate || !glassType || cost === undefined || amountPaid === undefined) {
    return res.status(400).json({ success: false, error: 'Required fields missing: screeningId, patientId, dispensingDate, glassType, cost, amountPaid' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [rhps] = await connection.query('SELECT id FROM rhps WHERE user_id = ?', [req.user.userId]);
    if (rhps.length === 0) {
      throw new Error('Only registered RHPs can dispense glasses');
    }
    const rhpId = rhps[0].id;

    // Verify patient & screening
    const [screenings] = await connection.query('SELECT id FROM screenings WHERE id = ? AND patient_id = ?', [screeningId, patientId]);
    if (screenings.length === 0) {
      throw new Error('Matching patient refraction screening record not found');
    }

    // Generate Invoice Number
    const rand = Math.floor(10000 + Math.random() * 90000);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${rand}`;

    // Insert glass dispensing record
    const [result] = await connection.query(
      `INSERT INTO glass_dispensing 
       (screening_id, patient_id, dispensed_by_rhp_id, dispensing_date, left_power_sph, right_power_sph, 
        left_power_cyl, right_power_cyl, frame_type, frame_color, glass_type, cost, amount_paid, 
        subsidy_applied, subsidy_amount, invoice_number) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(screeningId), parseInt(patientId), rhpId, dispensingDate,
        leftPowerSph !== undefined ? parseFloat(leftPowerSph) : null,
        rightPowerSph !== undefined ? parseFloat(rightPowerSph) : null,
        leftPowerCyl !== undefined ? parseFloat(leftPowerCyl) : null,
        rightPowerCyl !== undefined ? parseFloat(rightPowerCyl) : null,
        frameType || 'Standard', frameColor || 'Black', glassType,
        parseFloat(cost), parseFloat(amountPaid), subsidyApplied ? 1 : 0,
        subsidyAmount !== undefined ? parseFloat(subsidyAmount) : 0.00,
        invoiceNumber
      ]
    );

    const dispensingId = result.insertId;

    // Deduct stock from local RHP inventory
    // Match by Glass Type and Spherical powers
    const powerSph = leftPowerSph !== undefined ? parseFloat(leftPowerSph) : 0.00;
    const powerSphStr = powerSph.toFixed(2);
    const targetSku = `RD-SPH+${powerSphStr}-CYL-0.00`;

    const [stock] = await connection.query(
      'SELECT id, quantity FROM inventory_rhp WHERE rhp_id = ? AND sku = ?',
      [rhpId, targetSku]
    );

    if (stock.length > 0) {
      if (stock[0].quantity > 0) {
        await connection.query(
          'UPDATE inventory_rhp SET quantity = quantity - 1 WHERE id = ?',
          [stock[0].id]
        );
      } else {
        console.warn(`RHP ${rhpId} inventory for SKU ${targetSku} is empty. Proceeding but marking inventory alert.`);
      }
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Spectacles dispensed successfully',
      data: {
        dispensingId,
        invoiceNumber,
        amountPaid
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Dispense glasses error:', error);
    res.status(500).json({ success: false, error: 'Database transaction failed: ' + error.message });
  } finally {
    connection.release();
  }
};

// Generate and Stream Bilingual PDF Receipt (English + Hindi)
const getDispensingPdf = async (req, res) => {
  const { id } = req.params;

  try {
    const [dispense] = await db.query(
      `SELECT g.*, p.first_name, p.last_name, p.age, p.gender, p.village, 
              d.name as district_name, b.name as block_name,
              u.first_name as rhp_first, u.last_name as rhp_last, r.center_name
       FROM glass_dispensing g
       JOIN patients p ON g.patient_id = p.id
       JOIN districts d ON p.district_id = d.id
       JOIN blocks b ON p.block_id = b.id
       JOIN rhps r ON g.dispensed_by_rhp_id = r.id
       JOIN users u ON r.user_id = u.id
       WHERE g.id = ?`,
      [id]
    );

    if (dispense.length === 0) {
      return res.status(404).json({ success: false, error: 'Dispensing record not found' });
    }

    const rec = dispense[0];

    // Build plain text PDF layout directly in Node.js response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt_${rec.invoice_number}.pdf`);

    // We can write simple, standards-compliant PDF file blocks (a minimal raw PDF writer in JS)
    // This allows generating a true PDF file that is lightweight and download-ready without external libraries
    const pdfChunks = [];
    const addChunk = (str) => pdfChunks.push(Buffer.from(str, 'binary'));

    // Minimal PDF 1.4 header
    addChunk("%PDF-1.4\n");
    addChunk("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    addChunk("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    addChunk("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources 4 0 R /Contents 5 0 R >>\nendobj\n");
    addChunk("4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>\nendobj\n");

    // Dynamic Bilingual Text Layout Content
    const textLines = [
      "BT",
      "/F2 20 Tf",
      "50 780 Td",
      "(SAVIESS NGO EYE CARE PROGRAM) Tj",
      "0 -30 Td",
      "/F1 12 Tf",
      "(Joint Initiative: Preheal, SAVIESS, & VisionSpring) Tj",
      "0 -30 Td",
      "/F2 14 Tf",
      "(PATIENT RECEIPT / MELE KA RASEED) Tj",
      "0 -25 Td",
      "/F1 10 Tf",
      `(Invoice Number / Raseed Sankhya: ${pdfEscape(rec.invoice_number)}) Tj`,
      "0 -15 Td",
      `(Date / Tareekh: ${pdfEscape(new Date(rec.dispensing_date).toDateString())}) Tj`,
      "0 -15 Td",
      `(Vision Center / Netra Kendra: ${pdfEscape(rec.center_name)}) Tj`,
      "0 -15 Td",
      `(Dispensed By / Karmi Name: ${pdfEscape(rec.rhp_first)} ${pdfEscape(rec.rhp_last)}) Tj`,
      "0 -25 Td",
      "/F2 12 Tf",
      "(PATIENT PROFILE / PATIENT VIVARAN) Tj",
      "0 -15 Td",
      "/F1 10 Tf",
      `(Name / Naam: ${pdfEscape(rec.first_name)} ${pdfEscape(rec.last_name)}) Tj`,
      "0 -15 Td",
      `(Age & Gender / Umar aur Ling: ${rec.age} Yrs / ${pdfEscape(rec.gender.toUpperCase())}) Tj`,
      "0 -15 Td",
      `(Address / Pata: Village ${pdfEscape(rec.village)}, Block ${pdfEscape(rec.block_name)}, District ${pdfEscape(rec.district_name)}) Tj`,
      "0 -25 Td",
      "/F2 12 Tf",
      "(DISPENSING SPECTACLES POWER / CHASHMA NO. DETAILS) Tj",
      "0 -15 Td",
      "/F1 10 Tf",
      `(Left Eye Power / Bayi Aankh Power: SPH ${rec.left_power_sph?.toFixed(2) || '0.00'} / CYL ${rec.left_power_cyl?.toFixed(2) || '0.00'}) Tj`,
      "0 -15 Td",
      `(Right Eye Power / Dayi Aankh Power: SPH ${rec.right_power_sph?.toFixed(2) || '0.00'} / CYL ${rec.right_power_cyl?.toFixed(2) || '0.00'}) Tj`,
      "0 -15 Td",
      `(Spectacle Type / Chashma Type: ${pdfEscape(rec.glass_type.toUpperCase())} | Frame: ${pdfEscape(rec.frame_type)} - ${pdfEscape(rec.frame_color)}) Tj`,
      "0 -25 Td",
      "/F2 12 Tf",
      "(BILLING & FEES / SHULK VIVARAN) Tj",
      "0 -15 Td",
      "/F1 10 Tf",
      `(Cost of Spectacles / Chashma Ka Mulya: INR ${rec.cost.toFixed(2)}) Tj`,
      "0 -15 Td",
      `(Amount Paid / Bhugtan Kiya Gaya: INR ${rec.amount_paid.toFixed(2)}) Tj`,
      "0 -15 Td",
      `(Subsidy Applied / Chhut: ${rec.subsidy_applied ? 'YES' : 'NO'} | Amount: INR ${rec.subsidy_amount.toFixed(2)}) Tj`,
      "0 -40 Td",
      "/F2 10 Tf",
      "(Thank you for visiting! / Aane ke liye Dhanyavaad!) Tj",
      "0 -15 Td",
      "(Keep your eyes healthy. / Apni aankhon ko swasth rakhein.) Tj",
      "ET"
    ];

    const contentStream = textLines.join('\n') + '\n';
    const contentLength = Buffer.byteLength(contentStream, 'binary');

    addChunk(`5 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}endstream\nendobj\n`);

    // Cross-reference table (xref)
    let offset = 0;
    const xrefOffsets = [];
    const formatOffset = (off) => off.toString().padStart(10, '0') + " 00000 n \n";

    xrefOffsets.push(0); // Dummy for entry 0

    // Recompute exact sizes manually
    const objects = [
      "%PDF-1.4\n",
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources 4 0 R /Contents 5 0 R >>\nendobj\n",
      "4 0 obj\n<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>\nendobj\n",
      `5 0 obj\n<< /Length ${contentLength} >>\nstream\n${contentStream}endstream\nendobj\n`
    ];

    let currentOffset = 0;
    const offsets = [];

    for (let i = 0; i < objects.length; i++) {
      if (i > 0) {
        offsets.push(currentOffset);
      }
      currentOffset += Buffer.byteLength(objects[i], 'binary');
    }

    const xrefStart = currentOffset;
    let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 0; i < offsets.length; i++) {
      xref += formatOffset(offsets[i]);
    }

    xref += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    // Write all buffers
    res.write(Buffer.concat([
      Buffer.from(objects[0], 'binary'),
      Buffer.from(objects[1], 'binary'),
      Buffer.from(objects[2], 'binary'),
      Buffer.from(objects[3], 'binary'),
      Buffer.from(objects[4], 'binary'),
      Buffer.from(objects[5], 'binary'),
      Buffer.from(xref, 'binary')
    ]));
    
    res.end();
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate PDF invoice receipt: ' + error.message });
  }
};

module.exports = {
  registerPatient,
  getPatients,
  getAllRhps,
  logScreening,
  dispenseGlasses,
  getDispensingPdf
};
