const db = require('../config/db');
const { sendDbError } = require('../utils/errors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ── Named constants (previously magic numbers) ──
const STANDARD_READING_POWERS = [1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00];
const DEFAULT_UNIT_PRICE = 120.00;
const DEFAULT_SAFETY_STOCK = 2;

// Generate Access Token
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      profileId: user.profileId || null,
      districtId: user.districtId || null,
      blockId: user.blockId || null,
      firstName: user.first_name || user.firstName || null,
      lastName: user.last_name || user.lastName || null
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // 1 hour expiration
  );
};

// Generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' } // 7 days expiration
  );
};

// Register controller with role restrictions
const register = async (req, res) => {
  const { email, password, firstName, lastName, role, phone } = req.body;

  if (!email || !password || !firstName || !lastName || !role || !phone) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  try {
    // Check if any user exists in the database
    const [userCount] = await db.query('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCount[0].count === 0;

    // Role restriction check
    if (!isFirstUser) {
      // Must be authenticated to create users
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
      }

      // Only super_admin can create admin roles. Program_director/field_manager can create field_officers/rhps.
      if (req.user.role !== 'super_admin') {
        if (['super_admin', 'program_director', 'field_manager'].includes(role)) {
          return res.status(403).json({ success: false, error: 'Forbidden: Only super_admin can provision admin and manager roles' });
        }
        if (req.user.role !== 'program_director' && req.user.role !== 'field_manager') {
          return res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges to register accounts' });
        }
      }
    }

    // Check if user already exists
    const [existingUsers] = await db.query('SELECT id FROM users WHERE email = ? OR phone = ?', [email, phone]);
    if (existingUsers.length > 0) {
      return res.status(400).json({ success: false, error: 'User with this email or phone already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [email, passwordHash, firstName, lastName, role, phone]
    );

    const newUserId = result.insertId;

    res.status(201).json({
      success: true,
      data: {
        id: newUserId,
        email,
        firstName,
        lastName,
        role,
        phone
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Login controller
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required' });
  }

  try {
    // Get user details
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated. Please contact administrator.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Fetch profile id if user is RHP or Field Officer
    let profileId = null;
    let districtId = null;
    let blockId = null;

    if (user.role === 'rhp') {
      const [rhpProfile] = await db.query('SELECT id, district_id, block_id FROM rhps WHERE user_id = ?', [user.id]);
      if (rhpProfile.length > 0) {
        profileId = rhpProfile[0].id;
        districtId = rhpProfile[0].district_id;
        blockId = rhpProfile[0].block_id;
      }
    } else if (user.role === 'field_officer') {
      const [foProfile] = await db.query('SELECT id, district_id, block_id FROM field_officers WHERE user_id = ?', [user.id]);
      if (foProfile.length > 0) {
        profileId = foProfile[0].id;
        districtId = foProfile[0].district_id;
        blockId = foProfile[0].block_id;
      }
    }

    // Compile token payload
    const tokenUser = { ...user, profileId, districtId, blockId };

    const accessToken = generateAccessToken(tokenUser);
    const refreshToken = generateRefreshToken(tokenUser);

    // Update last login
    await db.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Set HTTP-only cookie for refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      accessToken,
      requiresPasswordChange: !!user.must_change_password,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        phone: user.phone,
        profileId,
        districtId,
        blockId
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Refresh — exchange the httpOnly refresh-token cookie for a new access token
const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0 || !users[0].is_active) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    const user = users[0];

    let profileId = null;
    let districtId = null;
    let blockId = null;
    if (user.role === 'rhp') {
      const [rhpProfile] = await db.query('SELECT id, district_id, block_id FROM rhps WHERE user_id = ?', [user.id]);
      if (rhpProfile.length > 0) {
        profileId = rhpProfile[0].id; districtId = rhpProfile[0].district_id; blockId = rhpProfile[0].block_id;
      }
    } else if (user.role === 'field_officer') {
      const [foProfile] = await db.query('SELECT id, district_id, block_id FROM field_officers WHERE user_id = ?', [user.id]);
      if (foProfile.length > 0) {
        profileId = foProfile[0].id; districtId = foProfile[0].district_id; blockId = foProfile[0].block_id;
      }
    }

    const accessToken = generateAccessToken({ ...user, profileId, districtId, blockId });
    res.json({ success: true, accessToken });
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, email, first_name, last_name, role, phone, is_active, last_login, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0];
    let profileData = {};

    if (user.role === 'rhp') {
      const [rhp] = await db.query('SELECT * FROM rhps WHERE user_id = ?', [user.id]);
      if (rhp.length > 0) profileData = rhp[0];
    } else if (user.role === 'field_officer') {
      const [fo] = await db.query('SELECT * FROM field_officers WHERE user_id = ?', [user.id]);
      if (fo.length > 0) profileData = fo[0];
    }

    res.json({
      success: true,
      data: {
        ...user,
        profile: profileData
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Change password
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Old and new passwords are required' });
  }

  try {
    const [users] = await db.query('SELECT password_hash FROM users WHERE id = ?', [req.user.userId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = users[0];

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Incorrect old password' });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [newHash, req.user.userId]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// ============================================================================
// Provision User — Admin creates FO or RHP with full profile in one transaction
// ============================================================================
const provisionUser = async (req, res) => {
  const { firstName, lastName, phone, email, role, centerName, village, coverageArea } = req.body;
  // Accept both numeric IDs (from dropdowns) and text names (from pincode lookup)
  let { districtId, blockId } = req.body;
  const { pincode, area, city, district, state, block } = req.body;

  // Validate common fields
  if (!firstName || !lastName || !phone || !role) {
    return res.status(400).json({ success: false, error: 'Required fields: firstName, lastName, phone, role' });
  }

  if (!['field_officer', 'field_manager', 'program_director', 'rhp'].includes(role)) {
    return res.status(400).json({ success: false, error: 'Role must be field_officer, field_manager, program_director, or rhp' });
  }

  // Role-hierarchy check: a caller may only ever provision roles below their own level.
  // super_admin -> any role. program_director -> field_officer/field_manager/rhp.
  // field_manager -> field_officer/rhp only. Mirrors the equivalent (unreachable) check
  // already written in register() above.
  const callerRole = req.user.role;
  const provisionableRoles = {
    super_admin: ['field_officer', 'field_manager', 'program_director', 'rhp'],
    program_director: ['field_officer', 'field_manager', 'rhp'],
    field_manager: ['field_officer', 'rhp']
  };
  if (!provisionableRoles[callerRole] || !provisionableRoles[callerRole].includes(role)) {
    return res.status(403).json({ success: false, error: `Forbidden: your role (${callerRole}) cannot provision a ${role} account` });
  }

  // For field_officer, field_manager, program_director: resolve text-based location to IDs if numeric IDs not provided
  if (['field_officer', 'field_manager', 'program_director'].includes(role) && !districtId && district) {
    const connection2 = await db.getConnection();
    try {
      // Find or create district
      let [dRows] = await connection2.query('SELECT id FROM districts WHERE name = ?', [district]);
      if (dRows.length === 0) {
        const [dInsert] = await connection2.query('INSERT INTO districts (name) VALUES (?)', [district]);
        districtId = dInsert.insertId;
      } else {
        districtId = dRows[0].id;
      }

      // Find or create block (use the block text, or fall back to area/city)
      const blockName = block || area || city || 'Default';
      let [bRows] = await connection2.query('SELECT id FROM blocks WHERE district_id = ? AND name = ?', [districtId, blockName]);
      if (bRows.length === 0) {
        const [bInsert] = await connection2.query('INSERT INTO blocks (district_id, name) VALUES (?, ?)', [districtId, blockName]);
        blockId = bInsert.insertId;
      } else {
        blockId = bRows[0].id;
      }
    } finally {
      connection2.release();
    }
  }

  // For roles that require district/block IDs
  if (['field_officer', 'field_manager', 'program_director', 'rhp'].includes(role) && (!districtId || !blockId)) {
    return res.status(400).json({ success: false, error: 'District and Block information is required. Please enter a valid pincode or select from dropdown.' });
  }

  // RHP-specific validation
  if (role === 'rhp' && (!centerName || !village)) {
    return res.status(400).json({ success: false, error: 'Center name and village are required for RHP role' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check for existing user with same phone
    const [existing] = await connection.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'A user with this phone number already exists' });
    }

    // Auto-generate email if not provided
    const slug = `${firstName.toLowerCase().replace(/\s+/g, '')}.${lastName.toLowerCase().replace(/\s+/g, '')}`;
    const randomNum = Math.floor(100 + Math.random() * 900);
    const generatedEmail = email || `${slug}${randomNum}@saviess.org`;

    // Check email uniqueness
    const [emailCheck] = await connection.query('SELECT id FROM users WHERE email = ?', [generatedEmail]);
    if (emailCheck.length > 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'A user with this email already exists. Try providing a unique email.' });
    }

    // Generate default password: Saviess@<last4digits>
    const last4 = phone.replace(/\D/g, '').slice(-4);
    const defaultPassword = `Saviess@${last4}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 1. Create user record — auto-generated password, so force a change on first login
    const [userResult] = await connection.query(
      'INSERT INTO users (email, password_hash, first_name, last_name, role, phone, must_change_password) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [generatedEmail, passwordHash, firstName, lastName, role, phone]
    );
    const userId = userResult.insertId;

    let profileData = {};

    // 2. Create role-specific profile
    if (role === 'field_officer') {
      const managerId = req.user.userId; // Admin who created becomes default manager
      const [foResult] = await connection.query(
        `INSERT INTO field_officers (user_id, manager_id, district_id, block_id, coverage_area, status) 
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, managerId, parseInt(districtId), parseInt(blockId), coverageArea || '']
      );
      profileData = { profileId: foResult.insertId, type: 'field_officer' };

    } else if (role === 'field_manager') {
      // Sequential employee code, same "read last, increment" convention as
      // generateAppCode() in rhpRegistrationController.js
      const [codeRows] = await connection.query(
        'SELECT employee_code FROM field_managers ORDER BY id DESC LIMIT 1'
      );
      let nextSeq = 1;
      if (codeRows.length > 0) {
        const lastSeq = parseInt(codeRows[0].employee_code.split('-')[1], 10);
        nextSeq = (Number.isNaN(lastSeq) ? 0 : lastSeq) + 1;
      }
      const employeeCode = `FM-${nextSeq.toString().padStart(5, '0')}`;

      const [fmResult] = await connection.query(
        `INSERT INTO field_managers (user_id, employee_code, district_id, block_id, coverage_area, availability_status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, employeeCode, parseInt(districtId), parseInt(blockId), coverageArea || '']
      );
      profileData = { profileId: fmResult.insertId, type: 'field_manager', employeeCode };

    } else if (role === 'rhp') {
      const [rhpResult] = await connection.query(
        `INSERT INTO rhps (user_id, center_name, district_id, block_id, village, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [userId, centerName, parseInt(districtId), parseInt(blockId), village]
      );
      const rhpId = rhpResult.insertId;
      profileData = { profileId: rhpId, type: 'rhp', centerName };

      // Seed default inventory for RHP (standard reading powers)
      for (const power of STANDARD_READING_POWERS) {
        const powerStr = power.toFixed(2);
        const sku = `RD-SPH+${powerStr}-CYL-0.00`;
        const itemName = `Reading Glasses SPH +${powerStr}`;
        await connection.query(
          `INSERT INTO inventory_rhp 
           (rhp_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, safety_stock_level, unit_price) 
           VALUES (?, ?, ?, 'reading', ?, ?, 0.00, 0.00, 0, ?, ?)`,
          [rhpId, itemName, sku, power, power, DEFAULT_SAFETY_STOCK, DEFAULT_UNIT_PRICE]
        );
      }
    }

    await connection.commit();

    const roleLabels = { field_officer: 'Field Officer', field_manager: 'Field Manager', program_director: 'Program Director', rhp: 'RHP' };
    res.status(201).json({
      success: true,
      message: `${roleLabels[role] || role} account provisioned successfully`,
      data: {
        userId,
        email: generatedEmail,
        defaultPassword,
        firstName,
        lastName,
        role,
        phone,
        ...profileData
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Provision user error:', error);
    sendDbError(res, error, 'Transaction failed');
  } finally {
    connection.release();
  }
};

module.exports = {
  register,
  login,
  refresh,
  getProfile,
  changePassword,
  provisionUser
};
