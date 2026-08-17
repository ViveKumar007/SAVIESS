const db = require('../config/db');
const { sendDbError } = require('../utils/errors');

// ============================================================================
// PARTNER MANAGEMENT — CRUD for Program Director
// ============================================================================

// List all partners (optional district filter)
const getPartners = async (req, res) => {
  const { districtId, status } = req.query;

  try {
    let query = `
      SELECT p.*, d.name as district_name,
             u.first_name as creator_first, u.last_name as creator_last
      FROM partners p
      LEFT JOIN districts d ON p.district_id = d.id
      LEFT JOIN users u ON p.created_by_user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (districtId) {
      query += ' AND p.district_id = ?';
      params.push(parseInt(districtId));
    }
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const [partners] = await db.query(query, params);
    res.json({ success: true, data: partners });
  } catch (error) {
    console.error('Get partners error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Create a new partner
const createPartner = async (req, res) => {
  const { name, type, contactPerson, phone, email, districtId, notes } = req.body;

  if (!name || !contactPerson) {
    return res.status(400).json({ success: false, error: 'Partner name and contact person are required' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO partners (name, type, contact_person, phone, email, district_id, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, type || 'other', contactPerson, phone || null, email || null, districtId || null, notes || null, req.user.userId]
    );

    res.status(201).json({
      success: true,
      message: 'Partner created successfully',
      data: { id: result.insertId, name, type: type || 'other', contactPerson }
    });
  } catch (error) {
    console.error('Create partner error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Update an existing partner
const updatePartner = async (req, res) => {
  const { id } = req.params;
  const { name, type, contactPerson, phone, email, districtId, status, notes } = req.body;

  try {
    const [existing] = await db.query('SELECT id FROM partners WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Partner not found' });
    }

    await db.query(
      `UPDATE partners SET name = COALESCE(?, name), type = COALESCE(?, type),
       contact_person = COALESCE(?, contact_person), phone = COALESCE(?, phone),
       email = COALESCE(?, email), district_id = COALESCE(?, district_id),
       status = COALESCE(?, status), notes = COALESCE(?, notes)
       WHERE id = ?`,
      [name, type, contactPerson, phone, email, districtId, status, notes, id]
    );

    res.json({ success: true, message: 'Partner updated successfully' });
  } catch (error) {
    console.error('Update partner error:', error);
    sendDbError(res, error, 'Database error');
  }
};

// Soft-delete partner (set inactive)
const deletePartner = async (req, res) => {
  const { id } = req.params;

  try {
    const [existing] = await db.query('SELECT id FROM partners WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Partner not found' });
    }

    await db.query('UPDATE partners SET status = "inactive" WHERE id = ?', [id]);
    res.json({ success: true, message: 'Partner deactivated successfully' });
  } catch (error) {
    console.error('Delete partner error:', error);
    sendDbError(res, error, 'Database error');
  }
};

module.exports = {
  getPartners,
  createPartner,
  updatePartner,
  deletePartner
};
