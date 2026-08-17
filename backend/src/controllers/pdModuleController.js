const db = require('../config/db');
const { uploadStream } = require('../utils/uploadHandler');
const { sendDbError } = require('../utils/errors');
const XLSX = require('xlsx');

// ============================================================================
// VISIT MANAGEMENT
// ============================================================================

// List field visits with pagination, date filter, search
const getFieldVisits = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, startDate, endDate } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let query = `
      SELECT v.*, u.first_name, u.last_name
      FROM pd_field_visits v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_deleted = 0
    `;
    const params = [];

    if (search) {
      query += ' AND (v.place LIKE ? OR v.key_observations LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (startDate) {
      query += ' AND v.visit_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND v.visit_date <= ?';
      params.push(endDate);
    }

    // Count query
    const countQuery = query.replace('SELECT v.*, u.first_name, u.last_name', 'SELECT COUNT(*) as total');
    const [countRows] = await db.query(countQuery, params);
    const total = countRows[0].total;

    query += ' ORDER BY v.visit_date DESC, v.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [visits] = await db.query(query, params);
    res.json({ success: true, data: visits, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get field visits error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Create a new field visit
const createFieldVisit = async (req, res) => {
  const { visitDate, place, keyObservations, areasForImprovement, remarks } = req.body;
  if (!visitDate || !place) {
    return res.status(400).json({ success: false, error: 'Visit date and place are required' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO pd_field_visits (user_id, visit_date, place, key_observations, areas_for_improvement, remarks)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.userId, visitDate, place, keyObservations || null, areasForImprovement || null, remarks || null]
    );
    res.status(201).json({ success: true, message: 'Field visit recorded', visitId: result.insertId });
  } catch (error) {
    console.error('Create field visit error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Update a field visit
const updateFieldVisit = async (req, res) => {
  const { id } = req.params;
  const { visitDate, place, keyObservations, areasForImprovement, remarks } = req.body;
  try {
    const [existing] = await db.query('SELECT id FROM pd_field_visits WHERE id = ? AND is_deleted = 0', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }
    await db.query(
      `UPDATE pd_field_visits SET visit_date = ?, place = ?, key_observations = ?, areas_for_improvement = ?, remarks = ?
       WHERE id = ?`,
      [visitDate, place, keyObservations || null, areasForImprovement || null, remarks || null, id]
    );
    res.json({ success: true, message: 'Field visit updated' });
  } catch (error) {
    console.error('Update field visit error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Soft-delete a field visit
const deleteFieldVisit = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('UPDATE pd_field_visits SET is_deleted = 1 WHERE id = ? AND is_deleted = 0', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Visit not found' });
    }
    res.json({ success: true, message: 'Field visit deleted' });
  } catch (error) {
    console.error('Delete field visit error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Export visits to Excel
const exportVisits = async (req, res) => {
  try {
    const [visits] = await db.query(`
      SELECT v.visit_date, v.place, v.key_observations, v.areas_for_improvement, v.remarks,
             u.first_name, u.last_name, v.created_at
      FROM pd_field_visits v
      JOIN users u ON v.user_id = u.id
      WHERE v.is_deleted = 0
      ORDER BY v.visit_date DESC
    `);
    const data = visits.map(v => ({
      'Date': v.visit_date,
      'Place': v.place,
      'Key Observations': v.key_observations || '',
      'Areas for Improvement': v.areas_for_improvement || '',
      'Remarks': v.remarks || '',
      'Recorded By': `${v.first_name} ${v.last_name}`,
      'Created At': v.created_at
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Field Visits');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=field_visits.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('Export visits error:', error);
    sendDbError(res, error, 'Export failed');
  }
};

// ============================================================================
// EYEGLASS COLORS
// ============================================================================

// Get all active colors
const getColors = async (req, res) => {
  try {
    const [colors] = await db.query('SELECT * FROM pd_eyeglass_colors WHERE is_active = 1 ORDER BY name ASC');
    res.json({ success: true, data: colors });
  } catch (error) {
    console.error('Get colors error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Add a new color
const addColor = async (req, res) => {
  const { name, hexCode, emoji } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Color name is required' });
  }
  try {
    const [existing] = await db.query('SELECT id FROM pd_eyeglass_colors WHERE name = ?', [name]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'Color already exists' });
    }
    const [result] = await db.query(
      'INSERT INTO pd_eyeglass_colors (name, hex_code, emoji) VALUES (?, ?, ?)',
      [name, hexCode || null, emoji || null]
    );
    // Also initialize stock row
    await db.query('INSERT INTO pd_eyeglass_stock (color_id, quantity) VALUES (?, 0)', [result.insertId]);
    res.status(201).json({ success: true, message: 'Color added', colorId: result.insertId });
  } catch (error) {
    console.error('Add color error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// ============================================================================
// EYEGLASS INVENTORY (STOCK)
// ============================================================================

// Get current stock per color
const getEyeglassStock = async (req, res) => {
  try {
    const [stock] = await db.query(`
      SELECT s.id, s.color_id, s.quantity, s.updated_at,
             c.name AS color_name, c.hex_code, c.emoji
      FROM pd_eyeglass_stock s
      JOIN pd_eyeglass_colors c ON s.color_id = c.id
      WHERE c.is_active = 1
      ORDER BY c.name ASC
    `);

    // Also get recent stock log
    const [log] = await db.query(`
      SELECT l.*, c.name AS color_name, c.emoji, u.first_name, u.last_name
      FROM pd_eyeglass_stock_log l
      JOIN pd_eyeglass_colors c ON l.color_id = c.id
      JOIN users u ON l.performed_by = u.id
      ORDER BY l.created_at DESC LIMIT 20
    `);

    res.json({ success: true, data: { stock, log } });
  } catch (error) {
    console.error('Get eyeglass stock error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Add stock for a color
const addEyeglassStock = async (req, res) => {
  const { colorId, quantity, notes } = req.body;
  if (!colorId || !quantity || Number.isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
    return res.status(400).json({ success: false, error: 'Color and a positive quantity are required' });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Update stock
    const [result] = await connection.query(
      'UPDATE pd_eyeglass_stock SET quantity = quantity + ? WHERE color_id = ?',
      [parseInt(quantity), parseInt(colorId)]
    );
    if (result.affectedRows === 0) {
      throw new Error('Color stock row not found. Run the migration first.');
    }

    // Audit log
    await connection.query(
      'INSERT INTO pd_eyeglass_stock_log (color_id, quantity_added, performed_by, notes) VALUES (?, ?, ?, ?)',
      [parseInt(colorId), parseInt(quantity), req.user.userId, notes || null]
    );

    await connection.commit();
    res.json({ success: true, message: `Added ${quantity} eyeglasses to stock` });
  } catch (error) {
    await connection.rollback();
    console.error('Add eyeglass stock error:', error);
    sendDbError(res, error, 'Stock update failed');
  } finally {
    connection.release();
  }
};

// ============================================================================
// FIELD OFFICER ALLOCATIONS
// ============================================================================

// List all active field officers (for dropdowns)
const getFieldOfficersList = async (req, res) => {
  try {
    const [fos] = await db.query(`
      SELECT fo.id AS fo_id, fo.user_id, fo.status,
             u.first_name, u.last_name, u.email, u.phone,
             d.name AS district_name, b.name AS block_name
      FROM field_officers fo
      JOIN users u ON fo.user_id = u.id
      JOIN districts d ON fo.district_id = d.id
      JOIN blocks b ON fo.block_id = b.id
      WHERE fo.status = 'active'
      ORDER BY u.first_name ASC
    `);
    res.json({ success: true, data: fos });
  } catch (error) {
    console.error('Get field officers list error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Get per-FO allocation breakdown by color
const getFoAllocations = async (req, res) => {
  let { foId } = req.query;

  // Field Officers may only ever see their own allocation, never another FO's
  if (req.user.role === 'field_officer') {
    const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
    if (fos.length === 0) {
      return res.status(403).json({ success: false, error: 'Only registered Field Officers can view their allocation' });
    }
    foId = fos[0].id;
  }

  try {
    let query = `
      SELECT a.id, a.fo_id, a.color_id, a.quantity, a.updated_at,
             c.name AS color_name, c.hex_code, c.emoji,
             u.first_name AS fo_first_name, u.last_name AS fo_last_name
      FROM pd_fo_allocation a
      JOIN pd_eyeglass_colors c ON a.color_id = c.id
      JOIN field_officers fo ON a.fo_id = fo.id
      JOIN users u ON fo.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    if (foId) {
      query += ' AND a.fo_id = ?';
      params.push(parseInt(foId));
    }
    query += ' ORDER BY u.first_name ASC, c.name ASC';
    const [allocations] = await db.query(query, params);

    // Allocation log (recent 30)
    let logQuery = `
      SELECT l.*, c.name AS color_name, c.emoji,
             u2.first_name AS performed_by_first, u2.last_name AS performed_by_last,
             u3.first_name AS fo_first_name, u3.last_name AS fo_last_name
      FROM pd_fo_allocation_log l
      JOIN pd_eyeglass_colors c ON l.color_id = c.id
      JOIN users u2 ON l.performed_by = u2.id
      JOIN field_officers fo ON l.fo_id = fo.id
      JOIN users u3 ON fo.user_id = u3.id
      WHERE 1=1
    `;
    const logParams = [];
    if (foId) {
      logQuery += ' AND l.fo_id = ?';
      logParams.push(parseInt(foId));
    }
    logQuery += ' ORDER BY l.created_at DESC LIMIT 30';
    const [log] = await db.query(logQuery, logParams);

    res.json({ success: true, data: { allocations, log } });
  } catch (error) {
    console.error('Get FO allocations error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Allocate eyeglasses from central stock to a Field Officer
const allocateToFo = async (req, res) => {
  const { foId, colorId, quantity, notes } = req.body;
  if (!foId || !colorId || !quantity || Number.isNaN(parseInt(quantity)) || parseInt(quantity) <= 0) {
    return res.status(400).json({ success: false, error: 'Field Officer, color, and a positive quantity are required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check central stock
    const [stockRows] = await connection.query(
      'SELECT quantity FROM pd_eyeglass_stock WHERE color_id = ?',
      [parseInt(colorId)]
    );
    if (stockRows.length === 0) {
      throw new Error('Color not found in stock');
    }
    if (stockRows[0].quantity < parseInt(quantity)) {
      throw new Error(`Insufficient central stock. Available: ${stockRows[0].quantity}, Requested: ${quantity}`);
    }

    // Deduct from central
    await connection.query(
      'UPDATE pd_eyeglass_stock SET quantity = quantity - ? WHERE color_id = ?',
      [parseInt(quantity), parseInt(colorId)]
    );

    // Upsert FO allocation
    const [existing] = await connection.query(
      'SELECT id FROM pd_fo_allocation WHERE fo_id = ? AND color_id = ?',
      [parseInt(foId), parseInt(colorId)]
    );
    if (existing.length > 0) {
      await connection.query(
        'UPDATE pd_fo_allocation SET quantity = quantity + ? WHERE fo_id = ? AND color_id = ?',
        [parseInt(quantity), parseInt(foId), parseInt(colorId)]
      );
    } else {
      await connection.query(
        'INSERT INTO pd_fo_allocation (fo_id, color_id, quantity) VALUES (?, ?, ?)',
        [parseInt(foId), parseInt(colorId), parseInt(quantity)]
      );
    }

    // Audit log
    await connection.query(
      'INSERT INTO pd_fo_allocation_log (fo_id, color_id, quantity_allocated, performed_by, notes) VALUES (?, ?, ?, ?, ?)',
      [parseInt(foId), parseInt(colorId), parseInt(quantity), req.user.userId, notes || null]
    );

    await connection.commit();
    res.json({ success: true, message: `Allocated ${quantity} eyeglasses to Field Officer` });
  } catch (error) {
    await connection.rollback();
    console.error('Allocate to FO error:', error);
    sendDbError(res, error, 'Allocation failed');
  } finally {
    connection.release();
  }
};

// ============================================================================
// PATIENT DISTRIBUTION
// ============================================================================

// Get distribution records
const getFoDistributions = async (req, res) => {
  let { foId, colorId, startDate, endDate, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Field Officers may only ever see their own distribution history, never another FO's
  if (req.user.role === 'field_officer') {
    const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
    if (fos.length === 0) {
      return res.status(403).json({ success: false, error: 'Only registered Field Officers can view their distributions' });
    }
    foId = fos[0].id;
  }

  try {
    let query = `
      SELECT d.*, c.name AS color_name, c.hex_code, c.emoji,
             u.first_name AS fo_first_name, u.last_name AS fo_last_name,
             u2.first_name AS dist_by_first, u2.last_name AS dist_by_last
      FROM pd_fo_distribution d
      JOIN pd_eyeglass_colors c ON d.color_id = c.id
      JOIN field_officers fo ON d.fo_id = fo.id
      JOIN users u ON fo.user_id = u.id
      JOIN users u2 ON d.distributed_by = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (foId) { query += ' AND d.fo_id = ?'; params.push(parseInt(foId)); }
    if (colorId) { query += ' AND d.color_id = ?'; params.push(parseInt(colorId)); }
    if (startDate) { query += ' AND d.distribution_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND d.distribution_date <= ?'; params.push(endDate); }

    const countQuery = query.replace(/SELECT d\.\*.*?WHERE/, 'SELECT COUNT(*) as total FROM pd_fo_distribution d JOIN pd_eyeglass_colors c ON d.color_id = c.id JOIN field_officers fo ON d.fo_id = fo.id JOIN users u ON fo.user_id = u.id JOIN users u2 ON d.distributed_by = u2.id WHERE');
    const [countRows] = await db.query(countQuery, params);
    const total = countRows[0].total;

    query += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [distributions] = await db.query(query, params);
    res.json({ success: true, data: distributions, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Get distributions error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Create a distribution record with mandatory proof upload
const createDistribution = async (req, res) => {
  let { foId } = req.body;
  const { colorId, quantity, patientName, patientPhone, patientDetails, distributionDate, notes } = req.body;

  // Field Officers can only ever distribute from their own inventory — never
  // trust a client-supplied foId for this role, always derive it server-side.
  if (req.user.role === 'field_officer') {
    const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
    if (fos.length === 0) {
      return res.status(403).json({ success: false, error: 'Only registered Field Officers can distribute eyeglasses' });
    }
    foId = fos[0].id;
  }

  if (!foId || !colorId || !quantity || Number.isNaN(parseInt(quantity)) || parseInt(quantity) <= 0 || !distributionDate) {
    return res.status(400).json({ success: false, error: 'Field Officer, color, quantity, and distribution date are required' });
  }

  // Mandatory proof
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Proof upload is mandatory. Please attach a photo or document.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check FO allocation for this color
    const [allocRows] = await connection.query(
      'SELECT quantity FROM pd_fo_allocation WHERE fo_id = ? AND color_id = ?',
      [parseInt(foId), parseInt(colorId)]
    );
    const available = allocRows.length > 0 ? allocRows[0].quantity : 0;
    if (available < parseInt(quantity)) {
      throw new Error(`Insufficient FO inventory. Available: ${available}, Requested: ${quantity}`);
    }

    // Upload proof to Cloudinary
    const cloudResult = await uploadStream(req.file.buffer, 'saviess_pd_distribution_proofs', req.file.mimetype);

    // Deduct from FO allocation
    await connection.query(
      'UPDATE pd_fo_allocation SET quantity = quantity - ? WHERE fo_id = ? AND color_id = ?',
      [parseInt(quantity), parseInt(foId), parseInt(colorId)]
    );

    // Insert distribution record
    await connection.query(
      `INSERT INTO pd_fo_distribution 
       (fo_id, color_id, quantity, patient_name, patient_phone, patient_details, proof_url, proof_public_id, distributed_by, distribution_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(foId), parseInt(colorId), parseInt(quantity),
        patientName || null, patientPhone || null, patientDetails || null,
        cloudResult.secure_url, cloudResult.public_id,
        req.user.userId, distributionDate, notes || null
      ]
    );

    await connection.commit();
    res.status(201).json({ success: true, message: `Distributed ${quantity} eyeglasses with proof recorded` });
  } catch (error) {
    await connection.rollback();
    console.error('Create distribution error:', error);
    sendDbError(res, error, 'Distribution failed');
  } finally {
    connection.release();
  }
};

// ============================================================================
// ANALYTICS DASHBOARD
// ============================================================================

const getAnalyticsSummary = async (req, res) => {
  try {
    // Total central stock
    const [stockRows] = await db.query(`
      SELECT COALESCE(SUM(s.quantity), 0) AS total_stock
      FROM pd_eyeglass_stock s
      JOIN pd_eyeglass_colors c ON s.color_id = c.id WHERE c.is_active = 1
    `);
    const totalStock = stockRows[0].total_stock;

    // Total allocated to FOs
    const [allocRows] = await db.query('SELECT COALESCE(SUM(quantity), 0) AS total_allocated FROM pd_fo_allocation');
    const totalAllocated = allocRows[0].total_allocated;

    // Total distributed
    const [distRows] = await db.query('SELECT COALESCE(SUM(quantity), 0) AS total_distributed FROM pd_fo_distribution');
    const totalDistributed = distRows[0].total_distributed;

    // Total ever added (from stock log)
    const [addedRows] = await db.query('SELECT COALESCE(SUM(quantity_added), 0) AS total_added FROM pd_eyeglass_stock_log');
    const totalAdded = addedRows[0].total_added;

    // By color breakdown
    const [byColor] = await db.query(`
      SELECT c.name, c.hex_code, c.emoji,
             COALESCE(s.quantity, 0) AS in_stock,
             COALESCE(a.allocated, 0) AS allocated,
             COALESCE(d.distributed, 0) AS distributed
      FROM pd_eyeglass_colors c
      LEFT JOIN pd_eyeglass_stock s ON c.id = s.color_id
      LEFT JOIN (SELECT color_id, SUM(quantity) AS allocated FROM pd_fo_allocation GROUP BY color_id) a ON c.id = a.color_id
      LEFT JOIN (SELECT color_id, SUM(quantity) AS distributed FROM pd_fo_distribution GROUP BY color_id) d ON c.id = d.color_id
      WHERE c.is_active = 1
      ORDER BY c.name ASC
    `);

    // By FO breakdown
    const [byFo] = await db.query(`
      SELECT u.first_name, u.last_name,
             COALESCE(SUM(a.quantity), 0) AS current_inventory,
             COALESCE(d.total_distributed, 0) AS total_distributed
      FROM field_officers fo
      JOIN users u ON fo.user_id = u.id
      LEFT JOIN pd_fo_allocation a ON fo.id = a.fo_id
      LEFT JOIN (
        SELECT fo_id, SUM(quantity) AS total_distributed FROM pd_fo_distribution GROUP BY fo_id
      ) d ON fo.id = d.fo_id
      WHERE fo.status = 'active'
      GROUP BY fo.id, u.first_name, u.last_name, d.total_distributed
      ORDER BY u.first_name ASC
    `);

    // Recent 10 distributions
    const [recentDist] = await db.query(`
      SELECT d.quantity, d.patient_name, d.distribution_date, d.proof_url, d.proof_public_id,
             c.name AS color_name, c.emoji,
             u.first_name AS fo_first, u.last_name AS fo_last
      FROM pd_fo_distribution d
      JOIN pd_eyeglass_colors c ON d.color_id = c.id
      JOIN field_officers fo ON d.fo_id = fo.id
      JOIN users u ON fo.user_id = u.id
      ORDER BY d.created_at DESC LIMIT 10
    `);

    // Recent visit summary
    const [recentVisits] = await db.query(`
      SELECT visit_date, place, key_observations
      FROM pd_field_visits
      WHERE is_deleted = 0
      ORDER BY visit_date DESC LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        summary: {
          totalAdded,
          totalStock,
          totalAllocated,
          totalDistributed,
          remaining: totalStock + totalAllocated // Stock in central + stock with FOs
        },
        byColor,
        byFo,
        recentDistributions: recentDist,
        recentVisits
      }
    });
  } catch (error) {
    console.error('Get analytics summary error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// ============================================================================
// EXPORT HELPERS
// ============================================================================

const exportInventory = async (req, res) => {
  try {
    const [stock] = await db.query(`
      SELECT c.name AS Color, c.emoji AS Emoji, s.quantity AS 'Central Stock',
             COALESCE(a.allocated, 0) AS 'Allocated to FOs',
             COALESCE(d.distributed, 0) AS 'Distributed to Patients'
      FROM pd_eyeglass_colors c
      LEFT JOIN pd_eyeglass_stock s ON c.id = s.color_id
      LEFT JOIN (SELECT color_id, SUM(quantity) AS allocated FROM pd_fo_allocation GROUP BY color_id) a ON c.id = a.color_id
      LEFT JOIN (SELECT color_id, SUM(quantity) AS distributed FROM pd_fo_distribution GROUP BY color_id) d ON c.id = d.color_id
      WHERE c.is_active = 1
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stock), 'Inventory');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=eyeglass_inventory.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('Export inventory error:', error);
    sendDbError(res, error, 'Export failed');
  }
};

const exportDistributions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT d.distribution_date AS 'Date', c.name AS 'Color', d.quantity AS 'Qty',
             d.patient_name AS 'Patient Name', d.patient_phone AS 'Patient Phone',
             u.first_name AS 'FO First Name', u.last_name AS 'FO Last Name',
             d.proof_url AS 'Proof URL', d.notes AS 'Notes'
      FROM pd_fo_distribution d
      JOIN pd_eyeglass_colors c ON d.color_id = c.id
      JOIN field_officers fo ON d.fo_id = fo.id
      JOIN users u ON fo.user_id = u.id
      ORDER BY d.distribution_date DESC
    `);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Distributions');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=distributions.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    console.error('Export distributions error:', error);
    sendDbError(res, error, 'Export failed');
  }
};

module.exports = {
  getFieldVisits,
  createFieldVisit,
  updateFieldVisit,
  deleteFieldVisit,
  exportVisits,
  getColors,
  addColor,
  getEyeglassStock,
  addEyeglassStock,
  getFieldOfficersList,
  getFoAllocations,
  allocateToFo,
  getFoDistributions,
  createDistribution,
  getAnalyticsSummary,
  exportInventory,
  exportDistributions
};
