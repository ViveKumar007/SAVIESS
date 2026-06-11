const db = require('../config/db');

// Consolidated dashboard stats summary
const getDashboardSummary = async (req, res) => {
  try {
    // 1. RHP Stats
    const [rhpRaw] = await db.query('SELECT status, COUNT(*) as count FROM rhps GROUP BY status');
    const rhpStats = { active: 0, suspended: 0, inactive: 0, total: 0 };
    rhpRaw.forEach(row => {
      if (row.status === 'active') rhpStats.active = row.count;
      else if (row.status === 'suspended') rhpStats.suspended = row.count;
      else if (row.status === 'inactive') rhpStats.inactive = row.count;
      rhpStats.total += row.count;
    });

    // 2. Application Stats
    const [appRaw] = await db.query('SELECT status, COUNT(*) as count FROM rhp_applications GROUP BY status');
    const appStats = { applied: 0, under_review: 0, interviewed: 0, training_scheduled: 0, approved: 0, rejected: 0, total: 0 };
    appRaw.forEach(row => {
      if (appStats[row.status] !== undefined) appStats[row.status] = row.count;
      appStats.total += row.count;
    });

    // 3. Screening Stats
    const [screenRaw] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(referral_recommended), 0) as referrals FROM screenings');
    const screeningStats = {
      totalScreened: screenRaw[0].total || 0,
      totalReferrals: parseInt(screenRaw[0].referrals) || 0
    };

    // 4. Dispensing Stats
    const [dispenseRaw] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(cost), 0) as totalCost, COALESCE(SUM(amount_paid), 0) as totalPaid FROM glass_dispensing');
    const dispensingStats = {
      totalGlassesSold: dispenseRaw[0].total || 0,
      totalRevenue: parseFloat(dispenseRaw[0].totalCost) || 0,
      totalCollected: parseFloat(dispenseRaw[0].totalPaid) || 0
    };

    // 5. Toolkit inventory counts with low stock warning flag
    const [toolkitRaw] = await db.query('SELECT *, (available_quantity <= 5) as lowStock FROM toolkit_inventory');
    const toolkitCounts = {
      totalItems: toolkitRaw.length,
      totalQuantity: toolkitRaw.reduce((acc, c) => acc + c.total_quantity, 0),
      availableQuantity: toolkitRaw.reduce((acc, c) => acc + c.available_quantity, 0),
      issuedQuantity: toolkitRaw.reduce((acc, c) => acc + (c.total_quantity - c.available_quantity), 0),
      items: toolkitRaw
    };

    // 6. Central stock by power (SKUs)
    const [centralStock] = await db.query(
      'SELECT id, item_name, sku, glass_type, quantity, safety_stock_level, (quantity <= safety_stock_level) as lowStock FROM inventory_central ORDER BY quantity ASC'
    );

    // 7. District Performance Metrics
    const [districtPerformance] = await db.query(`
      SELECT d.name as districtName, 
             COUNT(DISTINCT r.id) as rhpCount,
             COALESCE(SUM(r.total_patients_screened), 0) as totalScreened,
             COALESCE(SUM(r.total_glasses_dispensed), 0) as totalDispensed
      FROM districts d
      LEFT JOIN rhps r ON r.district_id = d.id
      GROUP BY d.id, d.name
    `);

    // 8. Monthly Screenings Trends (last 12 months)
    const [monthlyScreenings] = await db.query(`
      SELECT DATE_FORMAT(screening_date, '%b %Y') as month, 
             COUNT(*) as count 
      FROM screenings 
      GROUP BY DATE_FORMAT(screening_date, '%Y-%m'), DATE_FORMAT(screening_date, '%b %Y')
      ORDER BY DATE_FORMAT(screening_date, '%Y-%m') ASC
      LIMIT 12
    `);

    // 9. Power Demand Chart Data (Grouped by Spherical Left Power)
    const [powerDemand] = await db.query(`
      SELECT COALESCE(left_power_sph, 0.00) as power, 
             COUNT(*) as count 
      FROM glass_dispensing 
      GROUP BY left_power_sph
      ORDER BY left_power_sph ASC
    `);

    // 10. Field Officers currently online
    const [foOnline] = await db.query(
      'SELECT COUNT(*) as count FROM fo_live_location WHERE last_updated >= NOW() - INTERVAL 30 MINUTE'
    );

    res.json({
      success: true,
      data: {
        rhpStats,
        appStats,
        screeningStats,
        dispensingStats,
        toolkitCounts,
        centralStock,
        districtPerformance,
        monthlyScreenings,
        powerDemand,
        foOnlineCount: foOnline[0].count || 0
      }
    });
  } catch (error) {
    console.error('Get dashboard summary error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Field Officer daily visit logging audit checklist summary
const getFoDailySummary = async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const [summary] = await db.query(
      `SELECT fo.id as foId, u.first_name, u.last_name, u.phone,
              COALESCE(COUNT(v.id), 0) as visitCount,
              MAX(v.check_out_time) as lastActivity
       FROM field_officers fo
       JOIN users u ON fo.user_id = u.id
       LEFT JOIN fo_visits v ON v.fo_id = fo.id AND v.visit_date = ?
       GROUP BY fo.id, u.first_name, u.last_name, u.phone`,
      [targetDate]
    );

    res.json({
      success: true,
      date: targetDate,
      data: summary
    });
  } catch (error) {
    console.error('Get FO daily summary error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// ADMIN DATA TABLE ENDPOINTS — Detailed records entered by FOs and RHPs
// ============================================================================

// Get all patients registered across all RHPs (admin view)
const getAllPatients = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.village LIKE ? OR p.phone LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (startDate) {
      whereClause += ' AND p.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND p.created_at <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const countQuery = `SELECT COUNT(*) as total FROM patients p ${whereClause}`;
    const [countResult] = await db.query(countQuery, params);

    const dataQuery = `
      SELECT p.id, p.first_name, p.last_name, p.gender, p.age, p.phone, p.village,
             d.name as district_name, b.name as block_name,
             r.center_name as rhp_center, ru.first_name as rhp_first, ru.last_name as rhp_last,
             p.created_at
      FROM patients p
      JOIN districts d ON p.district_id = d.id
      JOIN blocks b ON p.block_id = b.id
      JOIN rhps r ON p.created_by_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const [patients] = await db.query(dataQuery, params);
    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: patients });
  } catch (error) {
    console.error('Get all patients error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all screenings logged by all RHPs (admin view)
const getAllScreenings = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR ru.first_name LIKE ? OR ru.last_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (startDate) {
      whereClause += ' AND s.screening_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND s.screening_date <= ?';
      params.push(endDate);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM screenings s
      JOIN patients p ON s.patient_id = p.id
      JOIN rhps r ON s.screened_by_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);

    const dataQuery = `
      SELECT s.id, s.screening_date, s.visual_acuity_left, s.visual_acuity_right,
             s.spherical_left, s.spherical_right, s.cylindrical_left, s.cylindrical_right,
             s.axis_left, s.axis_right, s.screening_type, s.referral_recommended,
             p.first_name as patient_first, p.last_name as patient_last, p.age, p.gender,
             r.center_name as rhp_center, ru.first_name as rhp_first, ru.last_name as rhp_last,
             s.created_at
      FROM screenings s
      JOIN patients p ON s.patient_id = p.id
      JOIN rhps r ON s.screened_by_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      ${whereClause}
      ORDER BY s.screening_date DESC, s.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const [screenings] = await db.query(dataQuery, params);
    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: screenings });
  } catch (error) {
    console.error('Get all screenings error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all glass dispensings recorded by all RHPs (admin view)
const getAllDispensings = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (p.first_name LIKE ? OR p.last_name LIKE ? OR g.invoice_number LIKE ? OR ru.first_name LIKE ? OR ru.last_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (startDate) {
      whereClause += ' AND g.dispensing_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND g.dispensing_date <= ?';
      params.push(endDate);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM glass_dispensing g
      JOIN patients p ON g.patient_id = p.id
      JOIN rhps r ON g.dispensed_by_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);

    const dataQuery = `
      SELECT g.id, g.dispensing_date, g.left_power_sph, g.right_power_sph,
             g.left_power_cyl, g.right_power_cyl, g.frame_type, g.frame_color,
             g.glass_type, g.cost, g.amount_paid, g.subsidy_applied, g.subsidy_amount,
             g.invoice_number,
             p.first_name as patient_first, p.last_name as patient_last, p.age, p.gender,
             r.center_name as rhp_center, ru.first_name as rhp_first, ru.last_name as rhp_last,
             g.created_at
      FROM glass_dispensing g
      JOIN patients p ON g.patient_id = p.id
      JOIN rhps r ON g.dispensed_by_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      ${whereClause}
      ORDER BY g.dispensing_date DESC, g.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const [dispensings] = await db.query(dataQuery, params);
    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: dispensings });
  } catch (error) {
    console.error('Get all dispensings error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all FO visit logs (admin view)
const getAllVisits = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = 100 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
      whereClause += ' AND (fu.first_name LIKE ? OR fu.last_name LIKE ? OR r.center_name LIKE ? OR v.purpose LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    if (startDate) {
      whereClause += ' AND v.visit_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND v.visit_date <= ?';
      params.push(endDate);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM fo_visits v
      JOIN field_officers f ON v.fo_id = f.id
      JOIN users fu ON f.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);

    const dataQuery = `
      SELECT v.id, v.visit_date, v.purpose, v.latitude, v.longitude, v.address_captured,
             v.notes, v.status, v.check_in_time, v.check_out_time,
             fu.first_name as fo_first, fu.last_name as fo_last, fu.phone as fo_phone,
             r.center_name as rhp_center, ru.first_name as rhp_first, ru.last_name as rhp_last,
             pr.file_url as proof_image_url,
             v.created_at
      FROM fo_visits v
      JOIN field_officers f ON v.fo_id = f.id
      JOIN users fu ON f.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      LEFT JOIN users ru ON r.user_id = ru.id
      LEFT JOIN proof_uploads pr ON v.proof_image_id = pr.id
      ${whereClause}
      ORDER BY v.visit_date DESC, v.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const [visits] = await db.query(dataQuery, params);
    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: visits });
  } catch (error) {
    console.error('Get all visits error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getFoDailySummary,
  getAllPatients,
  getAllScreenings,
  getAllDispensings,
  getAllVisits
};
