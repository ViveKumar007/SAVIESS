const db = require('../config/db');

// ── Named constants (previously magic numbers) ──
const TOOLKIT_LOW_STOCK_THRESHOLD = 5;
const DEFAULT_UNIT_PRICE = 120.00;

// Get Central Warehouse Inventory
const getCentralInventory = async (req, res) => {
  const { glassType, lowStock } = req.query;
  try {
    let query = 'SELECT * FROM inventory_central WHERE 1=1';
    const params = [];

    if (glassType) {
      query += ' AND glass_type = ?';
      params.push(glassType);
    }
    if (lowStock === 'true') {
      query += ' AND quantity <= safety_stock_level';
    }

    const [items] = await db.query(query, params);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get central inventory error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Add Central Warehouse Stock
const addCentralStock = async (req, res) => {
  const { itemName, sku, glassType, leftPowerSph, rightPowerSph, leftPowerCyl, rightPowerCyl, quantity, unitPrice, supplierInfo } = req.body;

  if (!itemName || !sku || !glassType || quantity === undefined || !unitPrice) {
    return res.status(400).json({ success: false, error: 'Required fields missing: itemName, sku, glassType, quantity, unitPrice' });
  }

  try {
    // Check if SKU exists
    const [existing] = await db.query('SELECT id, quantity FROM inventory_central WHERE sku = ?', [sku]);

    if (existing.length > 0) {
      // Increment stock
      await db.query(
        'UPDATE inventory_central SET quantity = quantity + ?, unit_price = ?, last_restocked_at = CURRENT_TIMESTAMP WHERE sku = ?',
        [parseInt(quantity), parseFloat(unitPrice), sku]
      );
    } else {
      // Insert new SKU record
      await db.query(
        `INSERT INTO inventory_central 
         (item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, unit_price, supplier_info, last_restocked_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          itemName, sku, glassType, 
          leftPowerSph ? parseFloat(leftPowerSph) : 0, 
          rightPowerSph ? parseFloat(rightPowerSph) : 0, 
          leftPowerCyl ? parseFloat(leftPowerCyl) : 0, 
          rightPowerCyl ? parseFloat(rightPowerCyl) : 0, 
          parseInt(quantity), parseFloat(unitPrice), supplierInfo || ''
        ]
      );
    }

    res.json({ success: true, message: 'Stock restocked successfully inside central warehouse' });
  } catch (error) {
    console.error('Add central stock error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Dispatch stock directly to RHP (Manual transfer)
const dispatchToRhp = async (req, res) => {
  const { rhpId, sku, quantity } = req.body;

  if (!rhpId || !sku || !quantity || parseInt(quantity) <= 0) {
    return res.status(400).json({ success: false, error: 'Required: rhpId, sku, quantity (greater than 0)' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify central warehouse stock
    const [centralStock] = await connection.query(
      'SELECT id, item_name, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, unit_price FROM inventory_central WHERE sku = ?',
      [sku]
    );

    if (centralStock.length === 0) {
      throw new Error(`SKU ${sku} not found in central warehouse`);
    }

    const centralItem = centralStock[0];
    if (centralItem.quantity < parseInt(quantity)) {
      throw new Error(`Insufficient stock in central warehouse for SKU ${sku}. Available: ${centralItem.quantity}`);
    }

    // Deduct from central warehouse
    await connection.query(
      'UPDATE inventory_central SET quantity = quantity - ? WHERE sku = ?',
      [parseInt(quantity), sku]
    );

    // Upsert into RHP local store
    const [rhpStock] = await connection.query(
      'SELECT id FROM inventory_rhp WHERE rhp_id = ? AND sku = ?',
      [parseInt(rhpId), sku]
    );

    if (rhpStock.length > 0) {
      await connection.query(
        'UPDATE inventory_rhp SET quantity = quantity + ?, last_restocked_at = CURRENT_TIMESTAMP WHERE rhp_id = ? AND sku = ?',
        [parseInt(quantity), parseInt(rhpId), sku]
      );
    } else {
      await connection.query(
        `INSERT INTO inventory_rhp 
         (rhp_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, unit_price, last_restocked_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          parseInt(rhpId), centralItem.item_name, sku, centralItem.glass_type,
          centralItem.left_power_sph, centralItem.right_power_sph,
          centralItem.left_power_cyl, centralItem.right_power_cyl,
          parseInt(quantity), centralItem.unit_price
        ]
      );
    }

    await connection.commit();
    res.json({ success: true, message: `Dispatched ${quantity} of SKU ${sku} to RHP successfully` });
  } catch (error) {
    await connection.rollback();
    console.error('Dispatch to RHP error:', error);
    res.status(500).json({ success: false, error: 'Dispatch transaction failed: ' + error.message });
  } finally {
    connection.release();
  }
};

// Get local inventory for RHP
const getRhpInventory = async (req, res) => {
  const { rhpId } = req.params;
  try {
    const [items] = await db.query('SELECT * FROM inventory_rhp WHERE rhp_id = ?', [rhpId]);
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Get RHP inventory error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Get Toolkits Catalog with Low Stock Flags
const getToolkitInventory = async (req, res) => {
  try {
    const [items] = await db.query('SELECT * FROM toolkit_inventory');
    const enriched = items.map(item => ({
      ...item,
      lowStock: item.available_quantity <= TOOLKIT_LOW_STOCK_THRESHOLD
    }));
    res.json({ success: true, data: enriched });
  } catch (error) {
    console.error('Get toolkit inventory error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Add/restock toolkits
const addToolkits = async (req, res) => {
  const { itemName, sku, quantity, unitPrice, description } = req.body;

  if (!itemName || !sku || quantity === undefined || !unitPrice) {
    return res.status(400).json({ success: false, error: 'Required fields missing: itemName, sku, quantity, unitPrice' });
  }

  try {
    const [existing] = await db.query('SELECT id FROM toolkit_inventory WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      await db.query(
        'UPDATE toolkit_inventory SET total_quantity = total_quantity + ?, available_quantity = available_quantity + ?, unit_price = ? WHERE sku = ?',
        [parseInt(quantity), parseInt(quantity), parseFloat(unitPrice), sku]
      );
    } else {
      await db.query(
        `INSERT INTO toolkit_inventory (item_name, sku, total_quantity, available_quantity, unit_price, description) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [itemName, sku, parseInt(quantity), parseInt(quantity), parseFloat(unitPrice), description || '']
      );
    }
    res.json({ success: true, message: 'Toolkits restocked successfully' });
  } catch (error) {
    console.error('Add toolkits error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Issue Toolkit to RHP
const issueToolkit = async (req, res) => {
  const { rhpId, toolkitItemId, quantity, issuedDate, conditionOnIssue } = req.body;

  if (!rhpId || !toolkitItemId || !quantity || !issuedDate) {
    return res.status(400).json({ success: false, error: 'Required: rhpId, toolkitItemId, quantity, issuedDate' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Verify toolkit availability
    const [toolkits] = await connection.query(
      'SELECT id, item_name, available_quantity FROM toolkit_inventory WHERE id = ?',
      [toolkitItemId]
    );

    if (toolkits.length === 0) {
      throw new Error('Toolkit catalog item not found');
    }

    const toolkit = toolkits[0];
    if (toolkit.available_quantity < parseInt(quantity)) {
      throw new Error(`Insufficient available toolkits. Required: ${quantity}, Available: ${toolkit.available_quantity}`);
    }

    // Deduct stock
    await connection.query(
      'UPDATE toolkit_inventory SET available_quantity = available_quantity - ? WHERE id = ?',
      [parseInt(quantity), toolkitItemId]
    );

    // Insert log row
    await connection.query(
      `INSERT INTO toolkit_issuance_log 
       (rhp_id, toolkit_item_id, quantity, issued_by_user_id, issued_date, status, condition_on_issue) 
       VALUES (?, ?, ?, ?, ?, 'issued', ?)`,
      [parseInt(rhpId), parseInt(toolkitItemId), parseInt(quantity), req.user.userId, issuedDate, conditionOnIssue || 'Good']
    );

    // Update RHP Profile flag
    await connection.query('UPDATE rhps SET toolkit_issued = 1 WHERE id = ?', [parseInt(rhpId)]);

    // Update training_attendance notes of this RHP candidate if they exist
    // Find the RHP's base user_id
    const [rhpUser] = await connection.query('SELECT user_id FROM rhps WHERE id = ?', [parseInt(rhpId)]);
    if (rhpUser.length > 0) {
      const userId = rhpUser[0].user_id;
      await connection.query(
        `UPDATE training_attendance 
         SET remarks = CONCAT(IFNULL(remarks, ''), ' [Toolkit issued on ', ?, ']') 
         WHERE trainee_user_id = ?`,
        [issuedDate, userId]
      );
    }

    await connection.commit();
    res.json({ success: true, message: `Issued toolkit ${toolkit.item_name} to RHP successfully` });
  } catch (error) {
    await connection.rollback();
    console.error('Issue toolkit error:', error);
    res.status(500).json({ success: false, error: 'Toolkit issuance transaction failed: ' + error.message });
  } finally {
    connection.release();
  }
};

// Raise Indent (RHP requisition)
const raiseIndent = async (req, res) => {
  const { requestDate, items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0 || !requestDate) {
    return res.status(400).json({ success: false, error: 'Required: requestDate and a non-empty items array' });
  }

  // Get RHP profile ID associated with user
  const [rhps] = await db.query('SELECT id, district_id FROM rhps WHERE user_id = ?', [req.user.userId]);
  if (rhps.length === 0) {
    return res.status(403).json({ success: false, error: 'Only registered RHPs can submit stock indents' });
  }
  const rhpId = rhps[0].id;

  // Find associated FO for the RHP's region to populate field_officer_id (Optional compile check)
  const [fos] = await db.query('SELECT id FROM field_officers WHERE district_id = ? LIMIT 1', [rhps[0].district_id]);
  const foId = fos.length > 0 ? fos[0].id : null;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Calculate total items count
    const totalItems = items.reduce((acc, cur) => acc + parseInt(cur.quantityRequested), 0);

    // Write indent header
    const [indentResult] = await connection.query(
      `INSERT INTO indents 
       (requester_rhp_id, field_officer_id, status, total_items, request_date) 
       VALUES (?, ?, 'pending_approval', ?, ?)`,
      [rhpId, foId, totalItems, requestDate]
    );

    const indentId = indentResult.insertId;

    // Write line items
    for (const item of items) {
      await connection.query(
        `INSERT INTO indent_items 
         (indent_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity_requested, quantity_approved, unit_price) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          indentId, item.itemName, item.sku, item.glassType,
          item.leftPowerSph ? parseFloat(item.leftPowerSph) : 0,
          item.rightPowerSph ? parseFloat(item.rightPowerSph) : 0,
          item.leftPowerCyl ? parseFloat(item.leftPowerCyl) : 0,
          item.rightPowerCyl ? parseFloat(item.rightPowerCyl) : 0,
          parseInt(item.quantityRequested), parseFloat(item.unitPrice || DEFAULT_UNIT_PRICE)
        ]
      );
    }

    // Update with generated indent code comments
    const indentCode = `IND-${indentId.toString().padStart(5, '0')}`;
    await connection.query('UPDATE indents SET comments = ? WHERE id = ?', [`Indent reference: ${indentCode}`, indentId]);

    await connection.commit();
    res.status(201).json({ success: true, message: 'Indent raised successfully', indentId, indentCode });
  } catch (error) {
    await connection.rollback();
    console.error('Raise indent error:', error);
    res.status(500).json({ success: false, error: 'Database transaction failed: ' + error.message });
  } finally {
    connection.release();
  }
};

// Get indents with role filtering
const getIndents = async (req, res) => {
  try {
    let query = `
      SELECT i.*, r.center_name, u.first_name, u.last_name 
      FROM indents i
      JOIN rhps r ON i.requester_rhp_id = r.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.user.role === 'rhp') {
      const [rhps] = await db.query('SELECT id FROM rhps WHERE user_id = ?', [req.user.userId]);
      if (rhps.length > 0) {
        query += ' AND i.requester_rhp_id = ?';
        params.push(rhps[0].id);
      } else {
        return res.json({ success: true, data: [] });
      }
    } else if (req.user.role === 'field_officer') {
      const [fos] = await db.query('SELECT id FROM field_officers WHERE user_id = ?', [req.user.userId]);
      if (fos.length > 0) {
        query += ' AND i.field_officer_id = ?';
        params.push(fos[0].id);
      }
    }

    query += ' ORDER BY i.created_at DESC';

    const [indentsList] = await db.query(query, params);

    // Fetch line items for each indent
    const enrichedList = [];
    for (const indent of indentsList) {
      const [items] = await db.query('SELECT * FROM indent_items WHERE indent_id = ?', [indent.id]);
      enrichedList.push({
        ...indent,
        items
      });
    }

    res.json({ success: true, data: enrichedList });
  } catch (error) {
    console.error('Get indents error:', error);
    res.status(500).json({ success: false, error: 'Database error: ' + error.message });
  }
};

// Update indent status with automatic stock deduction on dispatch
const updateIndentStatus = async (req, res) => {
  const { id } = req.params;
  const { status, comments, itemsApproved } = req.body; // itemsApproved is an array: [{ itemId, quantityApproved }]

  if (!status) {
    return res.status(400).json({ success: false, error: 'Status is required' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Check indent info
    const [indents] = await connection.query('SELECT * FROM indents WHERE id = ?', [id]);
    if (indents.length === 0) {
      throw new Error('Indent not found');
    }
    const indent = indents[0];

    // Check if status is a transition to 'approved' and we have item approvals
    if (status === 'approved' && itemsApproved && Array.isArray(itemsApproved)) {
      for (const approval of itemsApproved) {
        await connection.query(
          'UPDATE indent_items SET quantity_approved = ? WHERE id = ? AND indent_id = ?',
          [parseInt(approval.quantityApproved), parseInt(approval.itemId), id]
        );
      }
      await connection.query(
        'UPDATE indents SET status = "approved", approval_date = CURRENT_DATE, approved_by_user_id = ?, comments = ? WHERE id = ?',
        [req.user.userId, comments || indent.comments, id]
      );
    } 
    // Dispatch flow: Deduct from central warehouse
    else if (status === 'dispatched') {
      if (indent.status !== 'approved' && indent.status !== 'pending_approval') {
        throw new Error(`Cannot dispatch indent from state: ${indent.status}`);
      }

      // Fetch approved line items
      const [lineItems] = await connection.query('SELECT * FROM indent_items WHERE indent_id = ?', [id]);
      for (const line of lineItems) {
        // Use approved quantity if approved, otherwise request quantity if pending
        const qtyToDispatch = indent.status === 'approved' ? line.quantity_approved : line.quantity_requested;
        
        // Deduct from central warehouse
        const [central] = await connection.query('SELECT quantity FROM inventory_central WHERE sku = ?', [line.sku]);
        if (central.length === 0 || central[0].quantity < qtyToDispatch) {
          throw new Error(`Insufficient central warehouse stock for SKU: ${line.sku}. Available: ${central.length > 0 ? central[0].quantity : 0}`);
        }

        await connection.query(
          'UPDATE inventory_central SET quantity = quantity - ? WHERE sku = ?',
          [qtyToDispatch, line.sku]
        );

        // Update line item status
        await connection.query(
          'UPDATE indent_items SET quantity_approved = ?, quantity_dispatched = ? WHERE id = ?',
          [qtyToDispatch, qtyToDispatch, line.id]
        );
      }

      await connection.query(
        'UPDATE indents SET status = "dispatched", dispatch_date = CURRENT_DATE, comments = ? WHERE id = ?',
        [comments || indent.comments, id]
      );
    } 
    // Delivery flow: Add to RHP inventory, auto dispatch if moving straight to delivered
    else if (status === 'delivered') {
      // Fetch line items
      const [lineItems] = await connection.query('SELECT * FROM indent_items WHERE indent_id = ?', [id]);
      
      // If it hasn't been dispatched yet, perform the dispatch deduction now
      if (indent.status !== 'dispatched') {
        for (const line of lineItems) {
          const qtyToDispatch = indent.status === 'approved' ? line.quantity_approved : line.quantity_requested;
          
          // Deduct from central
          const [central] = await connection.query('SELECT quantity FROM inventory_central WHERE sku = ?', [line.sku]);
          if (central.length === 0 || central[0].quantity < qtyToDispatch) {
            throw new Error(`Insufficient central warehouse stock for SKU: ${line.sku}. Available: ${central.length > 0 ? central[0].quantity : 0}`);
          }

          await connection.query(
            'UPDATE inventory_central SET quantity = quantity - ? WHERE sku = ?',
            [qtyToDispatch, line.sku]
          );

          await connection.query(
            'UPDATE indent_items SET quantity_approved = ?, quantity_dispatched = ? WHERE id = ?',
            [qtyToDispatch, qtyToDispatch, line.id]
          );
        }
      }

      // Reload lines to get correct dispatched quantity
      const [finalLines] = await connection.query('SELECT * FROM indent_items WHERE indent_id = ?', [id]);

      // Seed/update RHP inventory
      for (const line of finalLines) {
        const qtyToAdd = line.quantity_dispatched;

        const [rhpInv] = await connection.query(
          'SELECT id FROM inventory_rhp WHERE rhp_id = ? AND sku = ?',
          [indent.requester_rhp_id, line.sku]
        );

        if (rhpInv.length > 0) {
          await connection.query(
            'UPDATE inventory_rhp SET quantity = quantity + ?, last_restocked_at = CURRENT_TIMESTAMP WHERE id = ?',
            [qtyToAdd, rhpInv[0].id]
          );
        } else {
          await connection.query(
            `INSERT INTO inventory_rhp 
             (rhp_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, unit_price, last_restocked_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [
              indent.requester_rhp_id, line.item_name, line.sku, line.glass_type,
              line.left_power_sph, line.right_power_sph,
              line.left_power_cyl, line.right_power_cyl,
              qtyToAdd, line.unit_price
            ]
          );
        }
      }

      await connection.query(
        'UPDATE indents SET status = "delivered", delivery_date = CURRENT_DATE, comments = ? WHERE id = ?',
        [comments || indent.comments, id]
      );
    } 
    // Generic status update (cancelled, etc.)
    else {
      await connection.query('UPDATE indents SET status = ?, comments = ? WHERE id = ?', [status, comments || indent.comments, id]);
    }

    await connection.commit();
    res.json({ success: true, message: `Indent updated to status '${status}' successfully` });
  } catch (error) {
    await connection.rollback();
    console.error('Update indent status error:', error);
    res.status(500).json({ success: false, error: 'Database update transaction failed: ' + error.message });
  } finally {
    connection.release();
  }
};

module.exports = {
  getCentralInventory,
  addCentralStock,
  dispatchToRhp,
  getRhpInventory,
  getToolkitInventory,
  addToolkits,
  issueToolkit,
  raiseIndent,
  getIndents,
  updateIndentStatus
};
