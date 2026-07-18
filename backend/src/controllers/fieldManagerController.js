const db = require('../config/db');

// ============================================================================
// FIELD MANAGER MODULE — Teams, Live Tracking, RHP Visits
// ============================================================================

// ── Named constants ──
const FO_LOCATION_STALENESS_MINUTES = 30;
const DEFAULT_PAGE_LIMIT = 20;

// ----------------------------------------------------------------------------
// 1. GET /fm/field-officers — List all FOs managed by this FM
//    Used for team assignment dropdowns and general overview
// ----------------------------------------------------------------------------
const getManagedFieldOfficers = async (req, res) => {
  const managerId = req.user.userId;

  try {
    const [fos] = await db.query(`
      SELECT fo.id as fo_id, fo.user_id, fo.status, fo.coverage_area,
             u.first_name, u.last_name, u.phone, u.email,
             d.name as district_name, b.name as block_name
      FROM field_officers fo
      JOIN users u ON fo.user_id = u.id
      JOIN districts d ON fo.district_id = d.id
      JOIN blocks b ON fo.block_id = b.id
      WHERE fo.manager_id = ?
      ORDER BY u.first_name ASC
    `, [managerId]);

    res.json({ success: true, data: fos });
  } catch (error) {
    console.error('[FM] getManagedFieldOfficers error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 2. POST /fm/teams — Create a new team
// ----------------------------------------------------------------------------
const createTeam = async (req, res) => {
  const { name, description } = req.body;
  const managerId = req.user.userId;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Team name is required' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO fm_teams (name, description, manager_user_id) VALUES (?, ?, ?)',
      [name.trim(), description || null, managerId]
    );

    res.status(201).json({
      success: true,
      message: 'Team created successfully',
      data: { id: result.insertId, name: name.trim(), description: description || null }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'A team with this name already exists' });
    }
    console.error('[FM] createTeam error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 3. GET /fm/teams — List all teams owned by the current FM with member counts
// ----------------------------------------------------------------------------
const getTeams = async (req, res) => {
  const managerId = req.user.userId;

  try {
    const [teams] = await db.query(`
      SELECT t.id, t.name, t.description, t.status, t.created_at, t.updated_at,
             COUNT(tm.id) as member_count
      FROM fm_teams t
      LEFT JOIN fm_team_members tm ON tm.team_id = t.id
      WHERE t.manager_user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `, [managerId]);

    // For each team, also fetch the member details
    for (const team of teams) {
      const [members] = await db.query(`
        SELECT tm.id as membership_id, tm.fo_id, tm.added_at,
               u.first_name, u.last_name, u.phone,
               fo.status as fo_status, fo.coverage_area,
               d.name as district_name, b.name as block_name
        FROM fm_team_members tm
        JOIN field_officers fo ON tm.fo_id = fo.id
        JOIN users u ON fo.user_id = u.id
        JOIN districts d ON fo.district_id = d.id
        JOIN blocks b ON fo.block_id = b.id
        WHERE tm.team_id = ?
        ORDER BY u.first_name ASC
      `, [team.id]);
      team.members = members;
    }

    res.json({ success: true, data: teams });
  } catch (error) {
    console.error('[FM] getTeams error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 4. PUT /fm/teams/:id — Update team name/description/status
// ----------------------------------------------------------------------------
const updateTeam = async (req, res) => {
  const { id } = req.params;
  const { name, description, status } = req.body;
  const managerId = req.user.userId;

  try {
    // Verify ownership
    const [team] = await db.query(
      'SELECT id FROM fm_teams WHERE id = ? AND manager_user_id = ?',
      [id, managerId]
    );
    if (team.length === 0) {
      return res.status(404).json({ success: false, error: 'Team not found or not owned by you' });
    }

    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name.trim()); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    params.push(id);
    await db.query(`UPDATE fm_teams SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true, message: 'Team updated successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, error: 'A team with this name already exists' });
    }
    console.error('[FM] updateTeam error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 5. DELETE /fm/teams/:id — Delete a team (cascades members)
// ----------------------------------------------------------------------------
const deleteTeam = async (req, res) => {
  const { id } = req.params;
  const managerId = req.user.userId;

  try {
    const [result] = await db.query(
      'DELETE FROM fm_teams WHERE id = ? AND manager_user_id = ?',
      [id, managerId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Team not found or not owned by you' });
    }

    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    console.error('[FM] deleteTeam error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 6. POST /fm/teams/:id/members — Add FOs to a team
//    Body: { foIds: [1, 2, 3] }
// ----------------------------------------------------------------------------
const addTeamMembers = async (req, res) => {
  const { id } = req.params;
  const { foIds } = req.body;
  const managerId = req.user.userId;

  if (!foIds || !Array.isArray(foIds) || foIds.length === 0) {
    return res.status(400).json({ success: false, error: 'foIds array is required' });
  }

  try {
    // Verify team ownership
    const [team] = await db.query(
      'SELECT id FROM fm_teams WHERE id = ? AND manager_user_id = ?',
      [id, managerId]
    );
    if (team.length === 0) {
      return res.status(404).json({ success: false, error: 'Team not found or not owned by you' });
    }

    // Verify all FOs belong to this manager
    const placeholders = foIds.map(() => '?').join(',');
    const [validFos] = await db.query(
      `SELECT id FROM field_officers WHERE id IN (${placeholders}) AND manager_id = ?`,
      [...foIds, managerId]
    );
    const validIds = validFos.map(f => f.id);

    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: 'None of the specified FOs are managed by you' });
    }

    // Insert members (ignore duplicates)
    let added = 0;
    for (const foId of validIds) {
      try {
        await db.query(
          'INSERT INTO fm_team_members (team_id, fo_id) VALUES (?, ?)',
          [id, foId]
        );
        added++;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
        // Skip duplicates silently
      }
    }

    res.json({ success: true, message: `${added} member(s) added to team`, added });
  } catch (error) {
    console.error('[FM] addTeamMembers error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 7. DELETE /fm/teams/:id/members/:foId — Remove an FO from a team
// ----------------------------------------------------------------------------
const removeTeamMember = async (req, res) => {
  const { id, foId } = req.params;
  const managerId = req.user.userId;

  try {
    // Verify team ownership
    const [team] = await db.query(
      'SELECT id FROM fm_teams WHERE id = ? AND manager_user_id = ?',
      [id, managerId]
    );
    if (team.length === 0) {
      return res.status(404).json({ success: false, error: 'Team not found or not owned by you' });
    }

    const [result] = await db.query(
      'DELETE FROM fm_team_members WHERE team_id = ? AND fo_id = ?',
      [id, foId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Member not found in this team' });
    }

    res.json({ success: true, message: 'Member removed from team' });
  } catch (error) {
    console.error('[FM] removeTeamMember error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 8. GET /fm/team-locations — Live GPS locations of FOs managed by this FM
// ----------------------------------------------------------------------------
const getTeamLocations = async (req, res) => {
  const managerId = req.user.userId;

  try {
    const [locations] = await db.query(`
      SELECT l.fo_id, l.latitude, l.longitude, l.accuracy, l.battery_level, l.last_updated,
             u.first_name, u.last_name, u.phone,
             fo.coverage_area, fo.status as fo_status,
             d.name as district_name, b.name as block_name
      FROM fo_live_location l
      JOIN field_officers fo ON l.fo_id = fo.id
      JOIN users u ON fo.user_id = u.id
      JOIN districts d ON fo.district_id = d.id
      JOIN blocks b ON fo.block_id = b.id
      WHERE fo.manager_id = ?
        AND l.last_updated >= NOW() - INTERVAL ? MINUTE
      ORDER BY l.last_updated DESC
    `, [managerId, FO_LOCATION_STALENESS_MINUTES]);

    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('[FM] getTeamLocations error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// ----------------------------------------------------------------------------
// 9. GET /fm/rhp-visits — All visits to RHP centers by managed FOs
//    Supports: pagination, date range filtering, purpose filter, search
// ----------------------------------------------------------------------------
const getRhpVisits = async (req, res) => {
  const managerId = req.user.userId;
  const { page = 1, limit = DEFAULT_PAGE_LIMIT, startDate, endDate, purpose, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    let whereClause = 'WHERE fo.manager_id = ? AND v.target_rhp_id IS NOT NULL';
    const params = [managerId];

    if (startDate) {
      whereClause += ' AND v.visit_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND v.visit_date <= ?';
      params.push(endDate);
    }
    if (purpose) {
      whereClause += ' AND v.purpose = ?';
      params.push(purpose);
    }
    if (search) {
      whereClause += ' AND (fu.first_name LIKE ? OR fu.last_name LIKE ? OR r.center_name LIKE ? OR r.village LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      JOIN users fu ON fo.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      ${whereClause}
    `;
    const [countResult] = await db.query(countQuery, params);

    // Data query
    const dataQuery = `
      SELECT v.id, v.visit_date, v.purpose, v.latitude, v.longitude, v.address_captured,
             v.notes, v.status, v.check_in_time, v.check_out_time,
             fu.first_name as fo_first, fu.last_name as fo_last, fu.phone as fo_phone,
             r.center_name as rhp_center, r.village as rhp_village,
             ru.first_name as rhp_first, ru.last_name as rhp_last,
             d.name as rhp_district, bl.name as rhp_block,
             p.file_url as proof_image_url, p.file_name as proof_file_name, p.mime_type as proof_mime_type,
             v.created_at
      FROM fo_visits v
      JOIN field_officers fo ON v.fo_id = fo.id
      JOIN users fu ON fo.user_id = fu.id
      LEFT JOIN rhps r ON v.target_rhp_id = r.id
      LEFT JOIN users ru ON r.user_id = ru.id
      LEFT JOIN districts d ON r.district_id = d.id
      LEFT JOIN blocks bl ON r.block_id = bl.id
      LEFT JOIN proof_uploads p ON v.proof_image_id = p.id
      ${whereClause}
      ORDER BY v.visit_date DESC, v.created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(parseInt(limit), offset);

    const [visits] = await db.query(dataQuery, params);

    res.json({
      success: true,
      total: countResult[0].total,
      page: parseInt(page),
      data: visits
    });
  } catch (error) {
    console.error('[FM] getRhpVisits error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

module.exports = {
  getManagedFieldOfficers,
  createTeam,
  getTeams,
  updateTeam,
  deleteTeam,
  addTeamMembers,
  removeTeamMember,
  getTeamLocations,
  getRhpVisits
};
