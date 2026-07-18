const db = require('../config/db');

// ── Named constants (previously magic numbers) ──
const TOOLKIT_LOW_STOCK_THRESHOLD = 5;
const FO_LOCATION_STALENESS_MINUTES = 30;
const DEFAULT_PAGE_LIMIT = 100;

// Diagnostic helper: verify active database connection and name
const verifyDbConnection = async () => {
  try {
    const [rows] = await db.query('SELECT DATABASE() as db_name');
    return rows[0]?.db_name || null;
  } catch (err) {
    console.error('[DB-CHECK] Connection verification failed:', err.message);
    return null;
  }
};

// Consolidated dashboard stats summary
const getDashboardSummary = async (req, res) => {
  const startTime = Date.now();
  try {
    const activeDb = await verifyDbConnection();
    console.log(`[DASHBOARD] getDashboardSummary called | Active DB: ${activeDb} | User: ${req.user?.userId} (${req.user?.role})`);

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
    const [toolkitRaw] = await db.query('SELECT *, (available_quantity <= ?) as lowStock FROM toolkit_inventory', [TOOLKIT_LOW_STOCK_THRESHOLD]);
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
      `SELECT COUNT(*) as count FROM fo_live_location WHERE last_updated >= NOW() - INTERVAL ${FO_LOCATION_STALENESS_MINUTES} MINUTE`
    );

    const elapsed = Date.now() - startTime;
    console.log(`[DASHBOARD] getDashboardSummary completed in ${elapsed}ms | RHPs: ${rhpStats.total}, Screenings: ${screeningStats.totalScreened}, Dispensings: ${dispensingStats.totalGlassesSold}`);

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
    const elapsed = Date.now() - startTime;
    console.error(`[DASHBOARD] getDashboardSummary FAILED after ${elapsed}ms:`, error.message);
    console.error('[DASHBOARD] Full error stack:', error.stack);
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
  const { search, startDate, endDate, page = 1, limit = DEFAULT_PAGE_LIMIT } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const startTime = Date.now();

  try {
    const activeDb = await verifyDbConnection();
    console.log(`[ADMIN-DATA] getAllPatients | DB: ${activeDb} | Filters: search=${search || 'none'}, startDate=${startDate || 'none'}, endDate=${endDate || 'none'}, page=${page}`);

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

    const elapsed = Date.now() - startTime;
    console.log(`[ADMIN-DATA] getAllPatients completed in ${elapsed}ms | Total: ${countResult[0].total}, Returned: ${patients.length}`);

    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: patients });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ADMIN-DATA] getAllPatients FAILED after ${elapsed}ms:`, error.message);
    console.error('[ADMIN-DATA] Stack:', error.stack);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all screenings logged by all RHPs (admin view)
const getAllScreenings = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = DEFAULT_PAGE_LIMIT } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const startTime = Date.now();

  try {
    console.log(`[ADMIN-DATA] getAllScreenings | Filters: search=${search || 'none'}, startDate=${startDate || 'none'}, endDate=${endDate || 'none'}, page=${page}`);

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

    const elapsed = Date.now() - startTime;
    console.log(`[ADMIN-DATA] getAllScreenings completed in ${elapsed}ms | Total: ${countResult[0].total}, Returned: ${screenings.length}`);

    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: screenings });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ADMIN-DATA] getAllScreenings FAILED after ${elapsed}ms:`, error.message);
    console.error('[ADMIN-DATA] Stack:', error.stack);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all glass dispensings recorded by all RHPs (admin view)
const getAllDispensings = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = DEFAULT_PAGE_LIMIT } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const startTime = Date.now();

  try {
    console.log(`[ADMIN-DATA] getAllDispensings | Filters: search=${search || 'none'}, startDate=${startDate || 'none'}, endDate=${endDate || 'none'}, page=${page}`);

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

    const elapsed = Date.now() - startTime;
    console.log(`[ADMIN-DATA] getAllDispensings completed in ${elapsed}ms | Total: ${countResult[0].total}, Returned: ${dispensings.length}`);

    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: dispensings });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ADMIN-DATA] getAllDispensings FAILED after ${elapsed}ms:`, error.message);
    console.error('[ADMIN-DATA] Stack:', error.stack);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get all FO visit logs (admin view)
const getAllVisits = async (req, res) => {
  const { search, startDate, endDate, page = 1, limit = DEFAULT_PAGE_LIMIT } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const startTime = Date.now();

  try {
    console.log(`[ADMIN-DATA] getAllVisits | Filters: search=${search || 'none'}, startDate=${startDate || 'none'}, endDate=${endDate || 'none'}, page=${page}`);

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

    const elapsed = Date.now() - startTime;
    console.log(`[ADMIN-DATA] getAllVisits completed in ${elapsed}ms | Total: ${countResult[0].total}, Returned: ${visits.length}`);

    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: visits });
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[ADMIN-DATA] getAllVisits FAILED after ${elapsed}ms:`, error.message);
    console.error('[ADMIN-DATA] Stack:', error.stack);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// PROGRAM DIRECTOR — State-level aggregated summary
// ============================================================================
const getPdSummary = async (req, res) => {
  try {
    // 1. Total RHPs, FOs, Partners across all districts
    const [rhpCount] = await db.query('SELECT COUNT(*) as total, SUM(status="active") as active FROM rhps');
    const [foCount] = await db.query('SELECT COUNT(*) as total, SUM(status="active") as active FROM field_officers');

    let partnerCount = { total: 0, active: 0 };
    try {
      const [pCount] = await db.query('SELECT COUNT(*) as total, SUM(status="active") as active FROM partners');
      partnerCount = pCount[0];
    } catch (e) { /* partners table may not exist yet */ }

    // 2. Overall screening & dispensing totals
    const [screenTotals] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(referral_recommended), 0) as referrals FROM screenings');
    const [dispenseTotals] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(cost), 0) as totalCost, COALESCE(SUM(amount_paid), 0) as totalPaid, COALESCE(SUM(subsidy_amount), 0) as totalSubsidy FROM glass_dispensing');

    // 3. Training fees financial summary
    let trainingFees = { totalCharged: 0, totalPaid: 0 };
    try {
      const [tfRaw] = await db.query('SELECT COALESCE(SUM(amount_charged), 0) as totalCharged, COALESCE(SUM(amount_paid), 0) as totalPaid FROM training_fees');
      trainingFees = { totalCharged: parseFloat(tfRaw[0].totalCharged), totalPaid: parseFloat(tfRaw[0].totalPaid) };
    } catch (e) { /* table may be empty */ }

    // 4. District performance breakdown
    const [districtPerformance] = await db.query(`
      SELECT d.id as district_id, d.name as district_name,
             COUNT(DISTINCT r.id) as rhp_count,
             COALESCE(SUM(r.total_patients_screened), 0) as total_screened,
             COALESCE(SUM(r.total_glasses_dispensed), 0) as total_dispensed
      FROM districts d
      LEFT JOIN rhps r ON r.district_id = d.id
      GROUP BY d.id, d.name
      ORDER BY d.name ASC
    `);

    // 5. Revenue by district
    const [revenueByDistrict] = await db.query(`
      SELECT d.name as district_name,
             COUNT(g.id) as glasses_sold,
             COALESCE(SUM(g.cost), 0) as total_cost,
             COALESCE(SUM(g.amount_paid), 0) as total_paid,
             COALESCE(SUM(g.subsidy_amount), 0) as total_subsidy
      FROM glass_dispensing g
      JOIN rhps r ON g.dispensed_by_rhp_id = r.id
      JOIN districts d ON r.district_id = d.id
      GROUP BY d.id, d.name
      ORDER BY total_paid DESC
    `);

    // 6. Monthly screening trends (last 12 months)
    const [monthlyScreenings] = await db.query(`
      SELECT DATE_FORMAT(screening_date, '%b %Y') as month,
             COUNT(*) as count
      FROM screenings
      GROUP BY DATE_FORMAT(screening_date, '%Y-%m'), DATE_FORMAT(screening_date, '%b %Y')
      ORDER BY DATE_FORMAT(screening_date, '%Y-%m') ASC
      LIMIT 12
    `);

    // 7. Monthly dispensing trends (last 12 months)
    const [monthlyDispensings] = await db.query(`
      SELECT DATE_FORMAT(dispensing_date, '%b %Y') as month,
             COUNT(*) as count,
             COALESCE(SUM(amount_paid), 0) as revenue
      FROM glass_dispensing
      GROUP BY DATE_FORMAT(dispensing_date, '%Y-%m'), DATE_FORMAT(dispensing_date, '%b %Y')
      ORDER BY DATE_FORMAT(dispensing_date, '%Y-%m') ASC
      LIMIT 12
    `);

    // 8. Application pipeline stats
    const [appPipeline] = await db.query('SELECT status, COUNT(*) as count FROM rhp_applications GROUP BY status');

    res.json({
      success: true,
      data: {
        counts: {
          totalRhps: rhpCount[0].total || 0,
          activeRhps: parseInt(rhpCount[0].active) || 0,
          totalFos: foCount[0].total || 0,
          activeFos: parseInt(foCount[0].active) || 0,
          totalPartners: partnerCount.total || 0,
          activePartners: parseInt(partnerCount.active) || 0
        },
        screeningStats: {
          total: screenTotals[0].total || 0,
          referrals: parseInt(screenTotals[0].referrals) || 0
        },
        financials: {
          glassesSold: dispenseTotals[0].total || 0,
          totalRevenue: parseFloat(dispenseTotals[0].totalCost) || 0,
          totalCollected: parseFloat(dispenseTotals[0].totalPaid) || 0,
          totalSubsidy: parseFloat(dispenseTotals[0].totalSubsidy) || 0,
          outstanding: (parseFloat(dispenseTotals[0].totalCost) || 0) - (parseFloat(dispenseTotals[0].totalPaid) || 0),
          trainingFeesCharged: trainingFees.totalCharged,
          trainingFeesPaid: trainingFees.totalPaid
        },
        districtPerformance,
        revenueByDistrict,
        monthlyScreenings,
        monthlyDispensings,
        appPipeline
      }
    });
  } catch (error) {
    console.error('Get PD summary error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// FIELD MANAGER — Scoped summary for managed FOs
// ============================================================================
const getFmSummary = async (req, res) => {
  const managerId = req.user.userId;

  try {
    // 1. Managed field officers
    const [managedFos] = await db.query(`
      SELECT fo.id as fo_id, fo.status, u.first_name, u.last_name, u.phone,
             d.name as district_name, b.name as block_name,
             (SELECT COUNT(*) FROM fo_visits v WHERE v.fo_id = fo.id AND v.visit_date = CURDATE()) as visits_today,
             (SELECT COUNT(*) FROM fo_visits v WHERE v.fo_id = fo.id AND MONTH(v.visit_date) = MONTH(CURDATE()) AND YEAR(v.visit_date) = YEAR(CURDATE())) as visits_this_month
      FROM field_officers fo
      JOIN users u ON fo.user_id = u.id
      JOIN districts d ON fo.district_id = d.id
      JOIN blocks b ON fo.block_id = b.id
      WHERE fo.manager_id = ?
      ORDER BY u.first_name ASC
    `, [managerId]);

    const foIds = managedFos.map(f => f.fo_id);

    // 2. Pending field reports count
    let pendingReports = 0;
    let totalReports = 0;
    if (foIds.length > 0) {
      const placeholders = foIds.map(() => '?').join(',');
      const [reportCounts] = await db.query(
        `SELECT COUNT(*) as total, SUM(status = 'pending') as pending FROM field_reports WHERE fo_id IN (${placeholders})`,
        foIds
      );
      pendingReports = parseInt(reportCounts[0].pending) || 0;
      totalReports = reportCounts[0].total || 0;
    }

    // 3. RHP onboarding pipeline (applications)
    const [appStats] = await db.query('SELECT status, COUNT(*) as count FROM rhp_applications GROUP BY status');
    const appPipeline = { applied: 0, under_review: 0, interviewed: 0, training_scheduled: 0, approved: 0, rejected: 0, total: 0 };
    appStats.forEach(row => {
      if (appPipeline[row.status] !== undefined) appPipeline[row.status] = row.count;
      appPipeline.total += row.count;
    });

    // 4. Training batches summary
    const [trainingBatches] = await db.query(`
      SELECT tb.id, tb.name, tb.start_date, tb.end_date, tb.trainer_name, tb.status,
             (SELECT COUNT(*) FROM training_attendance ta WHERE ta.batch_id = tb.id) as total_attendance,
             (SELECT COUNT(DISTINCT ta.trainee_user_id) FROM training_attendance ta WHERE ta.batch_id = tb.id) as unique_trainees
      FROM training_batches tb
      ORDER BY tb.start_date DESC
      LIMIT 10
    `);

    // 5. Pending indent requests
    const [pendingIndents] = await db.query(`
      SELECT i.id, i.request_date, i.total_items, i.status, i.comments,
             r.center_name as rhp_center,
             ru.first_name as rhp_first, ru.last_name as rhp_last
      FROM indents i
      JOIN rhps r ON i.requester_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      WHERE i.status IN ('pending_approval', 'draft')
      ORDER BY i.request_date DESC
      LIMIT 20
    `);

    // 6. Overall quick stats
    const [totalVisitsToday] = await db.query(
      'SELECT COUNT(*) as count FROM fo_visits WHERE visit_date = CURDATE()'
    );

    res.json({
      success: true,
      data: {
        managedFos,
        reports: { pending: pendingReports, total: totalReports },
        appPipeline,
        trainingBatches,
        pendingIndents,
        quickStats: {
          totalFos: managedFos.length,
          activeFos: managedFos.filter(f => f.status === 'active').length,
          visitsToday: totalVisitsToday[0].count || 0
        }
      }
    });
  } catch (error) {
    console.error('Get FM summary error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ============================================================================
// FIELD MANAGER ADMIN MANAGEMENT — Admin overview of all Field Managers
// ============================================================================

// GET /dashboard/field-managers — List all FMs with aggregated stats
const getFieldManagers = async (req, res) => {
  try {
    const [managers] = await db.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.is_active,
             u.last_login, u.created_at,
             (SELECT COUNT(*) FROM field_officers fo WHERE fo.manager_id = u.id) as fo_count,
             (SELECT COUNT(*) FROM field_officers fo2 WHERE fo2.manager_id = u.id AND fo2.status = 'active') as active_fo_count,
             (SELECT COUNT(*) FROM fm_teams t WHERE t.manager_user_id = u.id) as team_count,
             (SELECT COUNT(*) FROM fo_visits v
              JOIN field_officers fo3 ON v.fo_id = fo3.id
              WHERE fo3.manager_id = u.id) as total_visits,
             (SELECT COUNT(*) FROM fo_visits v2
              JOIN field_officers fo4 ON v2.fo_id = fo4.id
              WHERE fo4.manager_id = u.id AND v2.status = 'completed') as completed_visits,
             (SELECT COUNT(DISTINCT v3.target_rhp_id) FROM fo_visits v3
              JOIN field_officers fo5 ON v3.fo_id = fo5.id
              WHERE fo5.manager_id = u.id AND v3.target_rhp_id IS NOT NULL) as rhp_coverage,
             (SELECT MAX(v4.visit_date) FROM fo_visits v4
              JOIN field_officers fo6 ON v4.fo_id = fo6.id
              WHERE fo6.manager_id = u.id) as last_visit_date
      FROM users u
      WHERE u.role = 'field_manager'
      ORDER BY u.first_name ASC
    `);

    res.json({ success: true, data: managers });
  } catch (error) {
    console.error('[ADMIN] getFieldManagers error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// GET /dashboard/field-managers/:userId — Full profile for a single FM
const getFieldManagerDetail = async (req, res) => {
  const { userId } = req.params;

  try {
    // 1. FM user profile
    const [users] = await db.query(
      'SELECT id, email, first_name, last_name, phone, is_active, last_login, created_at FROM users WHERE id = ? AND role = ?',
      [userId, 'field_manager']
    );
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'Field Manager not found' });
    }
    const fm = users[0];

    // 2. All FOs managed by this FM
    const [fieldOfficers] = await db.query(`
      SELECT fo.id as fo_id, fo.user_id, fo.status, fo.coverage_area,
             u.first_name, u.last_name, u.phone, u.email, u.is_active as user_active,
             d.name as district_name, b.name as block_name
      FROM field_officers fo
      JOIN users u ON fo.user_id = u.id
      JOIN districts d ON fo.district_id = d.id
      JOIN blocks b ON fo.block_id = b.id
      WHERE fo.manager_id = ?
      ORDER BY u.first_name ASC
    `, [userId]);

    // 3. Teams with members
    const [teams] = await db.query(`
      SELECT t.id, t.name, t.description, t.status, t.created_at,
             COUNT(tm.id) as member_count
      FROM fm_teams t
      LEFT JOIN fm_team_members tm ON tm.team_id = t.id
      WHERE t.manager_user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [userId]);

    for (const team of teams) {
      const [members] = await db.query(`
        SELECT tm.fo_id, u.first_name, u.last_name, u.phone, fo.status as fo_status
        FROM fm_team_members tm
        JOIN field_officers fo ON tm.fo_id = fo.id
        JOIN users u ON fo.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY u.first_name ASC
      `, [team.id]);
      team.members = members;
    }

    // 4. RHPs visited by this FM's FOs
    const [rhps] = await db.query(`
      SELECT DISTINCT r.id, r.center_name, r.village, r.status,
             ru.first_name as rhp_first, ru.last_name as rhp_last,
             d.name as district_name, b.name as block_name
      FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      JOIN rhps r ON v.target_rhp_id = r.id
      JOIN users ru ON r.user_id = ru.id
      JOIN districts d ON r.district_id = d.id
      JOIN blocks b ON r.block_id = b.id
      WHERE fo.manager_id = ? AND v.target_rhp_id IS NOT NULL
      ORDER BY r.center_name ASC
    `, [userId]);

    // 5. Performance metrics
    const [visitStats] = await db.query(`
      SELECT
        COUNT(*) as total_visits,
        SUM(CASE WHEN v.status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN v.status = 'planned' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN v.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN v.visit_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END) as this_month,
        SUM(CASE WHEN v.visit_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01')
                  AND v.visit_date < DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN 1 ELSE 0 END) as last_month
      FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      WHERE fo.manager_id = ?
    `, [userId]);

    // 6. Field report stats (graceful if table doesn't exist)
    let reportStats;
    try {
      const [rs] = await db.query(`
        SELECT
          COUNT(*) as total_reports,
          SUM(CASE WHEN fr.status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN fr.status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN fr.status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM field_reports fr
        JOIN field_officers fo ON fr.fo_id = fo.id
        WHERE fo.manager_id = ?
      `, [userId]);
      reportStats = rs;
    } catch (e) {
      reportStats = [{ total_reports: 0, approved: 0, pending: 0, rejected: 0 }];
    }

    // 7. Live locations of FOs
    const [liveLocations] = await db.query(`
      SELECT l.fo_id, l.latitude, l.longitude, l.accuracy, l.battery_level, l.last_updated,
             u.first_name, u.last_name
      FROM fo_live_location l
      JOIN field_officers fo ON l.fo_id = fo.id
      JOIN users u ON fo.user_id = u.id
      WHERE fo.manager_id = ?
        AND l.last_updated >= NOW() - INTERVAL ? MINUTE
      ORDER BY l.last_updated DESC
    `, [userId, FO_LOCATION_STALENESS_MINUTES]);

    // 8. Recent activity (last 10 visits)
    const [recentActivity] = await db.query(`
      SELECT v.id, v.visit_date, v.purpose, v.status, v.notes,
             fu.first_name as fo_first, fu.last_name as fo_last,
             r.center_name as rhp_center, v.created_at
      FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      JOIN users fu ON fo.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      WHERE fo.manager_id = ?
      ORDER BY v.visit_date DESC, v.created_at DESC
      LIMIT 10
    `, [userId]);

    res.json({
      success: true,
      data: {
        profile: fm,
        fieldOfficers,
        teams,
        rhps,
        metrics: {
          visits: visitStats[0] || {},
          reports: reportStats[0] || {}
        },
        liveLocations,
        recentActivity
      }
    });
  } catch (error) {
    console.error('[ADMIN] getFieldManagerDetail error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// GET /dashboard/field-managers/:userId/visits — Paginated visit history
const getFieldManagerVisitHistory = async (req, res) => {
  const { userId } = req.params;
  const { page = 1, limit = 20, startDate, endDate, status, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE fo.manager_id = ?';
    const params = [userId];

    if (startDate) { whereClause += ' AND v.visit_date >= ?'; params.push(startDate); }
    if (endDate) { whereClause += ' AND v.visit_date <= ?'; params.push(endDate); }
    if (status) { whereClause += ' AND v.status = ?'; params.push(status); }
    if (search) {
      whereClause += ' AND (fu.first_name LIKE ? OR fu.last_name LIKE ? OR r.center_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const [countResult] = await db.query(`
      SELECT COUNT(*) as total FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      JOIN users fu ON fo.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      ${whereClause}
    `, params);

    const dataParams = [...params, parseInt(limit), offset];
    const [visits] = await db.query(`
      SELECT v.id, v.visit_date, v.purpose, v.latitude, v.longitude,
             v.notes, v.status, v.check_in_time, v.check_out_time,
             fu.first_name as fo_first, fu.last_name as fo_last, fu.phone as fo_phone,
             r.center_name as rhp_center, r.village as rhp_village,
             ru.first_name as rhp_first, ru.last_name as rhp_last,
             p.file_url as proof_image_url, p.file_name as proof_file_name,
             v.created_at
      FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      JOIN users fu ON fo.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      LEFT JOIN users ru ON r.user_id = ru.id
      LEFT JOIN proof_uploads p ON v.proof_image_id = p.id
      ${whereClause}
      ORDER BY v.visit_date DESC, v.created_at DESC
      LIMIT ? OFFSET ?
    `, dataParams);

    res.json({
      success: true,
      total: countResult[0].total,
      page: parseInt(page),
      data: visits
    });
  } catch (error) {
    console.error('[ADMIN] getFieldManagerVisitHistory error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// PUT /dashboard/field-managers/:userId/status — Activate/deactivate
const updateFieldManagerStatus = async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ success: false, error: 'isActive field is required' });
  }

  try {
    const [user] = await db.query('SELECT id, role FROM users WHERE id = ? AND role = ?', [userId, 'field_manager']);
    if (user.length === 0) {
      return res.status(404).json({ success: false, error: 'Field Manager not found' });
    }

    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, userId]);

    res.json({ success: true, message: `Field Manager ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    console.error('[ADMIN] updateFieldManagerStatus error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// PUT /dashboard/field-managers/reassign-fo — Reassign FO to different manager
const reassignFieldOfficer = async (req, res) => {
  const { foId, newManagerUserId } = req.body;

  if (!foId || !newManagerUserId) {
    return res.status(400).json({ success: false, error: 'foId and newManagerUserId are required' });
  }

  try {
    // Verify new manager exists and is a field_manager
    const [mgr] = await db.query('SELECT id FROM users WHERE id = ? AND role = ?', [newManagerUserId, 'field_manager']);
    if (mgr.length === 0) {
      return res.status(404).json({ success: false, error: 'Target Field Manager not found' });
    }

    // Verify FO exists
    const [fo] = await db.query('SELECT id, manager_id FROM field_officers WHERE id = ?', [foId]);
    if (fo.length === 0) {
      return res.status(404).json({ success: false, error: 'Field Officer not found' });
    }

    await db.query('UPDATE field_officers SET manager_id = ? WHERE id = ?', [newManagerUserId, foId]);

    res.json({ success: true, message: 'Field Officer reassigned successfully' });
  } catch (error) {
    console.error('[ADMIN] reassignFieldOfficer error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getFoDailySummary,
  getAllPatients,
  getAllScreenings,
  getAllDispensings,
  getAllVisits,
  getPdSummary,
  getFmSummary,
  getFieldManagers,
  getFieldManagerDetail,
  getFieldManagerVisitHistory,
  updateFieldManagerStatus,
  reassignFieldOfficer
};
