const db = require('../config/db');
const { uploadStream } = require('../utils/uploadHandler');
const { sendDbError } = require('../utils/errors');

// Log a visit with photo upload and GPS coordinates
const logVisit = async (req, res) => {
  const { targetRhpId, visitDate, purpose, latitude, longitude, addressCaptured, notes, checkInTime, checkOutTime } = req.body;

  if (!visitDate || !purpose || !latitude || !longitude) {
    return res.status(400).json({ success: false, error: 'Required fields missing: visitDate, purpose, latitude, longitude' });
  }

  // Get FO Profile associated with user
  const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
  if (fos.length === 0) {
    return res.status(403).json({ success: false, error: 'Only registered Field Officers can log visit sheets' });
  }
  const foId = fos[0].id;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let proofImageId = null;

    // Handle photo upload
    if (req.file) {
      const cloudResult = await uploadStream(req.file.buffer, 'visits', req.file.mimetype);

      const [proofResult] = await connection.query(
        `INSERT INTO proof_uploads 
         (uploader_user_id, file_name, file_url, public_id, file_size_bytes, mime_type, module_context) 
         VALUES (?, ?, ?, ?, ?, ?, 'visit_proof')`,
        [req.user.userId, req.file.originalname, cloudResult.secure_url, cloudResult.public_id, req.file.size, req.file.mimetype]
      );
      proofImageId = proofResult.insertId;
    }

    // Insert visit
    const [visitResult] = await connection.query(
      `INSERT INTO fo_visits 
       (fo_id, target_rhp_id, visit_date, purpose, latitude, longitude, address_captured, notes, status, check_in_time, check_out_time, proof_image_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`,
      [
        foId, 
        targetRhpId ? parseInt(targetRhpId) : null, 
        visitDate, 
        purpose, 
        parseFloat(latitude), 
        parseFloat(longitude), 
        addressCaptured || '', 
        notes || '',
        checkInTime || null,
        checkOutTime || null,
        proofImageId
      ]
    );

    await connection.commit();
    res.status(201).json({
      success: true,
      message: 'Visit sheet logged successfully',
      visitId: visitResult.insertId
    });
  } catch (error) {
    await connection.rollback();
    console.error('Log visit error:', error);
    sendDbError(res, error, 'Database transaction failed');
  } finally {
    connection.release();
  }
};

// Get visits with role filtering
const getVisits = async (req, res) => {
  const { status, startDate, endDate } = req.query;
  const user = req.user;

  try {
    let query = `
      SELECT v.*, f.user_id as fo_user_id, u.first_name as fo_first, u.last_name as fo_last,
             r.center_name, ru.first_name as rhp_first, ru.last_name as rhp_last,
             p.file_url as proof_image_url
      FROM fo_visits v
      JOIN field_officers f ON v.fo_id = f.id
      JOIN users u ON f.user_id = u.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      LEFT JOIN users ru ON r.user_id = ru.id
      LEFT JOIN proof_uploads p ON v.proof_image_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += ' AND v.status = ?';
      params.push(status);
    }
    if (startDate) {
      query += ' AND v.visit_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND v.visit_date <= ?';
      params.push(endDate);
    }

    // Role filters
    if (user.role === 'field_officer') {
      const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [user.userId]);
      if (fos.length > 0) {
        query += ' AND v.fo_id = ?';
        params.push(fos[0].id);
      } else {
        return res.json({ success: true, data: [] });
      }
    } else if (user.role === 'field_manager') {
      // Manage FOs assigned to this field manager
      query += ' AND f.manager_id = ?';
      params.push(user.userId);
    }

    query += ' ORDER BY v.visit_date DESC, v.created_at DESC';

    const [visits] = await db.query(query, params);
    res.json({ success: true, data: visits });
  } catch (error) {
    console.error('Get visits error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Internal function to process GPS coordinates (Reusable helper)
const processLocationTracking = async (foId, latitude, longitude, accuracy, batteryLevel) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const acc = accuracy ? parseFloat(accuracy) : null;
  const batt = batteryLevel ? parseInt(batteryLevel) : null;

  // Upsert live location
  await db.query(
    `INSERT INTO fo_live_location (fo_id, latitude, longitude, accuracy, battery_level, last_updated) 
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE 
       latitude = VALUES(latitude), 
       longitude = VALUES(longitude), 
       accuracy = VALUES(accuracy), 
       battery_level = VALUES(battery_level), 
       last_updated = CURRENT_TIMESTAMP`,
    [foId, lat, lng, acc, batt]
  );

  // Insert location history trail
  await db.query(
    'INSERT INTO fo_location_history (fo_id, latitude, longitude, accuracy, captured_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [foId, lat, lng, acc]
  );
};

// REST HTTP Fallback Location Updates
const postLocation = async (req, res) => {
  const { latitude, longitude, accuracy, batteryLevel } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, error: 'Latitude and longitude coordinates are required' });
  }

  try {
    const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
    if (fos.length === 0) {
      return res.status(403).json({ success: false, error: 'Only field officers can post GPS location updates' });
    }
    const foId = fos[0].id;

    await processLocationTracking(foId, latitude, longitude, accuracy, batteryLevel);
    res.json({ success: true, message: 'Location updated successfully via fallback endpoint' });
  } catch (error) {
    console.error('Post location fallback error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Get all live tracking locations for last 30 minutes
const getAllLiveLocations = async (req, res) => {
  try {
    const [locations] = await db.query(
      `SELECT l.*, u.first_name, u.last_name, u.phone, fo.coverage_area 
       FROM fo_live_location l
       JOIN field_officers fo ON l.fo_id = fo.id
       JOIN users u ON fo.user_id = u.id
       WHERE l.last_updated >= NOW() - INTERVAL 30 MINUTE`
    );
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('Get all live locations error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Stop tracking (Clock-out offline)
const stopTracking = async (req, res) => {
  try {
    const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
    if (fos.length === 0) {
      return res.status(403).json({ success: false, error: 'Only field officers can adjust tracking profiles' });
    }
    const foId = fos[0].id;

    await db.query('DELETE FROM fo_live_location WHERE fo_id = ?', [foId]);
    res.json({ success: true, message: 'Live tracking stopped. Account marked offline' });
  } catch (error) {
    console.error('Stop tracking error:', error);
    sendDbError(res, error, 'Database error');
  }
};

module.exports = {
  logVisit,
  getVisits,
  postLocation,
  getAllLiveLocations,
  stopTracking,
  processLocationTracking
};
