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

module.exports = {
  getDashboardSummary,
  getFoDailySummary
};
