const db = require('../config/db');

// ============================================================================
// FIELD REPORTS — Submit (FO) and Review (FM) workflow
// ============================================================================

// List field reports
// - Field Manager: sees reports from FOs they manage
// - Program Director / Admin: sees all reports
const getFieldReports = async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userRole = req.user.role;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Field Manager: scope to their managed FOs
    if (userRole === 'field_manager') {
      whereClause += ' AND fo.manager_id = ?';
      params.push(req.user.userId);
    }
    // Field Officer: scope to own reports
    if (userRole === 'field_officer') {
      whereClause += ' AND fr.fo_id = ?';
      params.push(req.user.profileId);
    }

    if (status) {
      whereClause += ' AND fr.status = ?';
      params.push(status);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM field_reports fr
      JOIN field_officers fo ON fr.fo_id = fo.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);

    const dataQuery = `
      SELECT fr.id, fr.report_text, fr.status, fr.review_comments, fr.reviewed_at, fr.created_at,
             v.visit_date, v.purpose, v.latitude, v.longitude, v.notes as visit_notes, v.status as visit_status,
             fu.first_name as fo_first, fu.last_name as fo_last, fu.phone as fo_phone,
             rh.center_name as rhp_center,
             ru.first_name as reviewer_first, ru.last_name as reviewer_last,
             pr.file_url as proof_image_url
      FROM field_reports fr
      JOIN field_officers fo ON fr.fo_id = fo.id
      JOIN users fu ON fo.user_id = fu.id
      JOIN fo_visits v ON fr.visit_id = v.id
      LEFT JOIN rhps rh ON v.target_rhp_id = rh.id
      LEFT JOIN users r ON rh.user_id = r.id
      LEFT JOIN users ru ON fr.reviewed_by_user_id = ru.id
      LEFT JOIN proof_uploads pr ON v.proof_image_id = pr.id
      ${whereClause}
      ORDER BY fr.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const [reports] = await db.query(dataQuery, params);
    res.json({ success: true, total: countResult[0].total, page: parseInt(page), data: reports });
  } catch (error) {
    console.error('Get field reports error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Field Officer submits a report for a visit
const submitFieldReport = async (req, res) => {
  const { visitId, reportText } = req.body;

  if (!visitId || !reportText) {
    return res.status(400).json({ success: false, error: 'Visit ID and report text are required' });
  }

  try {
    // Verify the visit belongs to this FO
    const [visit] = await db.query(
      'SELECT v.id, v.fo_id FROM fo_visits v JOIN field_officers fo ON v.fo_id = fo.id WHERE v.id = ? AND fo.user_id = ?',
      [visitId, req.user.userId]
    );
    if (visit.length === 0) {
      return res.status(403).json({ success: false, error: 'Visit not found or does not belong to you' });
    }

    // Check for duplicate report
    const [existing] = await db.query('SELECT id FROM field_reports WHERE visit_id = ?', [visitId]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'A report already exists for this visit' });
    }

    const [result] = await db.query(
      'INSERT INTO field_reports (visit_id, fo_id, report_text, status) VALUES (?, ?, ?, "pending")',
      [visitId, visit[0].fo_id, reportText]
    );

    res.status(201).json({
      success: true,
      message: 'Field report submitted for review',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('Submit field report error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Field Manager approves or rejects a report
const reviewFieldReport = async (req, res) => {
  const { id } = req.params;
  const { status, reviewComments } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Status must be "approved" or "rejected"' });
  }

  try {
    const [report] = await db.query('SELECT id, status FROM field_reports WHERE id = ?', [id]);
    if (report.length === 0) {
      return res.status(404).json({ success: false, error: 'Field report not found' });
    }
    if (report[0].status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Report has already been reviewed' });
    }

    await db.query(
      'UPDATE field_reports SET status = ?, reviewed_by_user_id = ?, review_comments = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.userId, reviewComments || null, id]
    );

    res.json({ success: true, message: `Field report ${status} successfully` });
  } catch (error) {
    console.error('Review field report error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

module.exports = {
  getFieldReports,
  submitFieldReport,
  reviewFieldReport
};
