const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Generate Access Token
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      profileId: user.profileId || null,
      districtId: user.districtId || null,
      blockId: user.blockId || null
    },
    process.env.JWT_SECRET || 'saviess_secret_key_2026',
    { expiresIn: '1h' } // 1 hour expiration
  );
};

// Generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET || 'saviess_refresh_secret_key_2026',
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
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
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
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
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
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
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

    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.userId]);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  changePassword
};
