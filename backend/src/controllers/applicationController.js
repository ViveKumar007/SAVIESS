const db = require('../config/db');
const bcrypt = require('bcrypt');
const { uploadStream } = require('../utils/uploadHandler');

// Submit application with multi-file upload
const submitApplication = async (req, res) => {
  const { firstName, lastName, gender, age, phone, districtId, blockId, village, qualification, experience } = req.body;

  if (!firstName || !lastName || !gender || !age || !phone || !districtId || !blockId || !village || !qualification) {
    return res.status(400).json({ success: false, error: 'Required text fields are missing' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const creatorId = req.user ? req.user.userId : null;

    // Insert the base application
    const [appResult] = await connection.query(
      `INSERT INTO rhp_applications 
       (first_name, last_name, gender, age, phone, district_id, block_id, village, qualification, experience, status, created_by_user_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'applied', ?)`,
      [firstName, lastName, gender, parseInt(age), phone, parseInt(districtId), parseInt(blockId), village, qualification, experience || '', creatorId]
    );
    const applicationId = appResult.insertId;

    // Handle files upload to Cloudinary (if any)
    const uploadedDocs = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const cloudResult = await uploadStream(file.buffer, 'rhp_applications');
        
        // Register in proof_uploads table
        // Use creatorId, default to a system placeholder user (id=1) if public applicant
        const uploaderId = creatorId || 1; 
        const [uploadResult] = await connection.query(
          `INSERT INTO proof_uploads 
           (uploader_user_id, file_name, file_url, public_id, file_size_bytes, mime_type, module_context) 
           VALUES (?, ?, ?, ?, ?, ?, 'applicant_kyc')`,
          [uploaderId, file.originalname, cloudResult.secure_url, cloudResult.public_id, file.size, file.mimetype]
        );

        uploadedDocs.push({
          id: uploadResult.insertId,
          name: file.originalname,
          url: cloudResult.secure_url
        });
      }
    }

    // Save upload refs into comments
    if (uploadedDocs.length > 0) {
      const docsJson = JSON.stringify(uploadedDocs);
      await connection.query(
        'UPDATE rhp_applications SET comments = ? WHERE id = ?',
        [`Uploaded Documents: ${docsJson}`, applicationId]
      );
    }

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'RHP application submitted successfully',
      data: {
        applicationId,
        firstName,
        lastName,
        status: 'applied',
        documents: uploadedDocs
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Submit application error:', error);
    res.status(500).json({ success: false, error: 'Failed to process application: ' + error.message });
  } finally {
    connection.release();
  }
};

// Get applications with role-based filtering
const getApplications = async (req, res) => {
  const { status, districtId, blockId } = req.query;
  const user = req.user;

  try {
    let query = `
      SELECT a.*, d.name as district_name, b.name as block_name 
      FROM rhp_applications a
      JOIN districts d ON a.district_id = d.id
      JOIN blocks b ON a.block_id = b.id
      WHERE 1=1
    `;
    const params = [];

    // Filter based on query strings
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (districtId) {
      query += ' AND a.district_id = ?';
      params.push(parseInt(districtId));
    }
    if (blockId) {
      query += ' AND a.block_id = ?';
      params.push(parseInt(blockId));
    }

    // Role-based restrictions
    if (user.role === 'field_manager') {
      // Field Managers can only view applications in their manager's coverage district/block
      // Let's get manager's profile district/block
      const [mgr] = await db.query('SELECT district_id, block_id FROM field_officers WHERE user_id = ?', [user.userId]);
      if (mgr.length > 0) {
        query += ' AND a.district_id = ?';
        params.push(mgr[0].district_id);
      }
    } else if (user.role === 'field_officer') {
      // Field Officers can only view applications in their specific district
      const [fo] = await db.query('SELECT district_id FROM field_officers WHERE user_id = ?', [user.userId]);
      if (fo.length > 0) {
        query += ' AND a.district_id = ?';
        params.push(fo[0].district_id);
      }
    }

    query += ' ORDER BY a.created_at DESC';

    const [applications] = await db.query(query, params);
    res.json({ success: true, data: applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Update status with auto RHP creation and inventory seeding on approval
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comments } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: 'Status is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check application details
    const [apps] = await connection.query('SELECT * FROM rhp_applications WHERE id = ?', [id]);
    if (apps.length === 0) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }
    const app = apps[0];

    // Check if application is already approved
    if (app.status === 'approved' && status === 'approved') {
      return res.status(400).json({ success: false, error: 'Application is already approved' });
    }

    // Update status and comments
    await connection.query(
      'UPDATE rhp_applications SET status = ?, comments = ?, updated_by_user_id = ? WHERE id = ?',
      [status, comments || app.comments, req.user.userId, id]
    );

    let createdUser = null;
    let createdRhp = null;

    // Auto RHP account creation and seeding on Approval
    if (status === 'approved') {
      // Check if user account with the applicant's phone number already exists
      const [existingUsers] = await connection.query('SELECT id FROM users WHERE phone = ?', [app.phone]);
      let userId;

      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        // Update role to RHP if it was something else
        await connection.query('UPDATE users SET role = "rhp" WHERE id = ?', [userId]);
      } else {
        // Generate a unique email
        const slug = `${app.first_name.toLowerCase()}.${app.last_name.toLowerCase()}`;
        const randomNum = Math.floor(100 + Math.random() * 900);
        const email = `${slug}${randomNum}@saviess.org`;
        
        // Generate default password (e.g. phone number or a standard default)
        const salt = await bcrypt.genSalt(10);
        const defaultPassword = `Saviess@${app.phone.slice(-4)}`; // Saviess@Last4Digits
        const passwordHash = await bcrypt.hash(defaultPassword, salt);

        const [userResult] = await connection.query(
          'INSERT INTO users (email, password_hash, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, "rhp", ?)',
          [email, passwordHash, app.first_name, app.last_name, app.phone]
        );
        userId = userResult.insertId;
        createdUser = { email, defaultPassword };
      }

      // Create RHP Profile
      const centerName = `${app.first_name}'s Vision Center`;
      const [rhpResult] = await connection.query(
        `INSERT INTO rhps (user_id, application_id, center_name, district_id, block_id, village, status) 
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [userId, id, centerName, app.district_id, app.block_id, app.village]
      );
      const rhpId = rhpResult.insertId;
      createdRhp = { id: rhpId, centerName };

      // Seeding local inventory (inventory_rhp) for standard power ranges
      // We will seed standard reading powers (from +1.00 to +3.00 in steps of +0.25)
      const standardPowers = [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
      for (const power of standardPowers) {
        const powerStr = power.toFixed(2);
        const sku = `RD-SPH+${powerStr}-CYL-0.00`;
        const itemName = `Reading Glasses SPH +${powerStr}`;
        
        await connection.query(
          `INSERT INTO inventory_rhp 
           (rhp_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, safety_stock_level, unit_price) 
           VALUES (?, ?, ?, 'reading', ?, ?, 0.00, 0.00, 0, 2, 120.00)`,
          [rhpId, itemName, sku, power, power]
        );
      }
    }

    await connection.commit();
    res.json({
      success: true,
      message: `Application status updated to '${status}' successfully`,
      createdUser,
      createdRhp
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update application status error:', error);
    res.status(500).json({ success: false, error: 'Database transaction failed: ' + error.message });
  } finally {
    connection.release();
  }
};

module.exports = {
  submitApplication,
  getApplications,
  updateStatus
};
