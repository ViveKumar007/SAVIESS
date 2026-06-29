const db = require('../config/db');

// ============================================================================
// KPI TRACKING — Targets & Actuals for Program Director
// ============================================================================

// Get KPI targets (filterable by district + month)
const getTargets = async (req, res) => {
  const { districtId, month } = req.query;

  try {
    let query = `
      SELECT kt.*, d.name as district_name
      FROM kpi_targets kt
      JOIN districts d ON kt.district_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (districtId) {
      query += ' AND kt.district_id = ?';
      params.push(parseInt(districtId));
    }
    if (month) {
      query += ' AND kt.target_month = ?';
      params.push(month);
    }

    query += ' ORDER BY kt.target_month DESC, d.name ASC';

    const [targets] = await db.query(query, params);
    res.json({ success: true, data: targets });
  } catch (error) {
    console.error('Get KPI targets error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Set KPI targets for a district/month (upsert)
const setTargets = async (req, res) => {
  const { districtId, targetMonth, screeningsTarget, dispensingsTarget, rhpOnboardingTarget, revenueTarget } = req.body;

  if (!districtId || !targetMonth) {
    return res.status(400).json({ success: false, error: 'District ID and target month are required' });
  }

  try {
    await db.query(
      `INSERT INTO kpi_targets (district_id, target_month, screenings_target, dispensings_target, rhp_onboarding_target, revenue_target, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         screenings_target = VALUES(screenings_target),
         dispensings_target = VALUES(dispensings_target),
         rhp_onboarding_target = VALUES(rhp_onboarding_target),
         revenue_target = VALUES(revenue_target)`,
      [
        parseInt(districtId),
        targetMonth,
        screeningsTarget || 0,
        dispensingsTarget || 0,
        rhpOnboardingTarget || 0,
        revenueTarget || 0,
        req.user.userId
      ]
    );

    res.json({ success: true, message: 'KPI targets saved successfully' });
  } catch (error) {
    console.error('Set KPI targets error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Compute actual KPIs from live data (screenings, dispensings, rhps)
const getActuals = async (req, res) => {
  const { month } = req.query;
  // Default to current month
  const targetMonth = month || new Date().toISOString().slice(0, 7) + '-01';
  const monthStart = targetMonth;
  const nextMonth = new Date(new Date(targetMonth).setMonth(new Date(targetMonth).getMonth() + 1)).toISOString().slice(0, 10);

  try {
    // Screenings per district in the month
    const [screeningActuals] = await db.query(`
      SELECT r.district_id, d.name as district_name, COUNT(s.id) as actual_screenings
      FROM screenings s
      JOIN rhps r ON s.screened_by_rhp_id = r.id
      JOIN districts d ON r.district_id = d.id
      WHERE s.screening_date >= ? AND s.screening_date < ?
      GROUP BY r.district_id, d.name
    `, [monthStart, nextMonth]);

    // Dispensings per district in the month
    const [dispensingActuals] = await db.query(`
      SELECT r.district_id, d.name as district_name, COUNT(g.id) as actual_dispensings,
             COALESCE(SUM(g.amount_paid), 0) as actual_revenue
      FROM glass_dispensing g
      JOIN rhps r ON g.dispensed_by_rhp_id = r.id
      JOIN districts d ON r.district_id = d.id
      WHERE g.dispensing_date >= ? AND g.dispensing_date < ?
      GROUP BY r.district_id, d.name
    `, [monthStart, nextMonth]);

    // New RHPs onboarded per district in the month
    const [rhpActuals] = await db.query(`
      SELECT r.district_id, d.name as district_name, COUNT(r.id) as actual_onboarded
      FROM rhps r
      JOIN districts d ON r.district_id = d.id
      WHERE r.created_at >= ? AND r.created_at < ?
      GROUP BY r.district_id, d.name
    `, [monthStart, nextMonth]);

    // Get all targets for this month
    const [targets] = await db.query(`
      SELECT kt.*, d.name as district_name
      FROM kpi_targets kt
      JOIN districts d ON kt.district_id = d.id
      WHERE kt.target_month = ?
    `, [monthStart]);

    // Get all districts
    const [districts] = await db.query('SELECT id, name FROM districts ORDER BY name ASC');

    // Build merged result per district
    const result = districts.map(district => {
      const target = targets.find(t => t.district_id === district.id) || {};
      const sActual = screeningActuals.find(s => s.district_id === district.id) || {};
      const dActual = dispensingActuals.find(d => d.district_id === district.id) || {};
      const rActual = rhpActuals.find(r => r.district_id === district.id) || {};

      return {
        districtId: district.id,
        districtName: district.name,
        screenings: {
          target: target.screenings_target || 0,
          actual: sActual.actual_screenings || 0
        },
        dispensings: {
          target: target.dispensings_target || 0,
          actual: dActual.actual_dispensings || 0
        },
        rhpOnboarding: {
          target: target.rhp_onboarding_target || 0,
          actual: rActual.actual_onboarded || 0
        },
        revenue: {
          target: parseFloat(target.revenue_target) || 0,
          actual: parseFloat(dActual.actual_revenue) || 0
        }
      };
    });

    res.json({ success: true, month: monthStart, data: result });
  } catch (error) {
    console.error('Get KPI actuals error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

module.exports = {
  getTargets,
  setTargets,
  getActuals
};
