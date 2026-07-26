const db = require('./db');
const bcrypt = require('bcrypt');

// ── Named constants (match authController / applicationController) ──
const DEFAULT_UNIT_PRICE = 120.00;
const DEFAULT_SAFETY_STOCK_RHP = 2;
const DEFAULT_SAFETY_STOCK_CENTRAL = 10;

async function seed() {
  console.log('Starting database seeding...');
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // 1. Seed States (All 28 States + 8 Union Territories)
    console.log('Seeding states...');
    await connection.query(`INSERT IGNORE INTO states (name, code) VALUES
      ('Andhra Pradesh', 'AP'), ('Arunachal Pradesh', 'AR'), ('Assam', 'AS'), ('Bihar', 'BR'),
      ('Chhattisgarh', 'CG'), ('Goa', 'GA'), ('Gujarat', 'GJ'), ('Haryana', 'HR'),
      ('Himachal Pradesh', 'HP'), ('Jharkhand', 'JH'), ('Karnataka', 'KA'), ('Kerala', 'KL'),
      ('Madhya Pradesh', 'MP'), ('Maharashtra', 'MH'), ('Manipur', 'MN'), ('Meghalaya', 'ML'),
      ('Mizoram', 'MZ'), ('Nagaland', 'NL'), ('Odisha', 'OD'), ('Punjab', 'PB'),
      ('Rajasthan', 'RJ'), ('Sikkim', 'SK'), ('Tamil Nadu', 'TN'), ('Telangana', 'TG'),
      ('Tripura', 'TR'), ('Uttar Pradesh', 'UP'), ('Uttarakhand', 'UK'), ('West Bengal', 'WB'),
      ('Andaman and Nicobar Islands', 'AN'), ('Chandigarh', 'CH'),
      ('Dadra and Nagar Haveli and Daman and Diu', 'DD'), ('Delhi', 'DL'),
      ('Jammu and Kashmir', 'JK'), ('Ladakh', 'LA'), ('Lakshadweep', 'LD'), ('Puducherry', 'PY')
    `);

    // Get Bihar state_id for linking districts
    const [biharRows] = await connection.query('SELECT id FROM states WHERE code = "BR"');
    const biharStateId = biharRows.length > 0 ? biharRows[0].id : null;

    // 2. Seed Districts (Bihar)
    console.log('Seeding districts...');
    await connection.query('INSERT IGNORE INTO districts (id, name, state_id) VALUES (1, "Patna", ?), (2, "Nalanda", ?), (3, "Gaya", ?)', [biharStateId, biharStateId, biharStateId]);

    // 2. Seed Blocks
    console.log('Seeding blocks...');
    await connection.query('INSERT IGNORE INTO blocks (id, district_id, name) VALUES (1, 1, "Patna Sadar"), (2, 2, "Harnaut"), (3, 3, "Sherghati")');

    // 3. Hash Password for standard users
    const salt = await bcrypt.genSalt(10);
    const defaultHash = await bcrypt.hash('Saviess@2026', salt);

    // 4. Seed Users
    console.log('Seeding users...');
    
    // Admin
    const [adminCheck] = await connection.query('SELECT id FROM users WHERE email = "admin@saviess.org"');
    let adminUserId;
    if (adminCheck.length === 0) {
      const [res] = await connection.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active) VALUES ("admin@saviess.org", ?, "Sanjay", "Prasad", "super_admin", "+919999000001", 1)',
        [defaultHash]
      );
      adminUserId = res.insertId;
    } else {
      adminUserId = adminCheck[0].id;
    }

    // Program Director
    const [pdCheck] = await connection.query('SELECT id FROM users WHERE email = "pd@saviess.org"');
    if (pdCheck.length === 0) {
      await connection.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active) VALUES ("pd@saviess.org", ?, "Meera", "Sharma", "program_director", "+919999000005", 1)',
        [defaultHash]
      );
    }

    // Field Manager
    const [mgrCheck] = await connection.query('SELECT id FROM users WHERE email = "manager@saviess.org"');
    let mgrUserId;
    if (mgrCheck.length === 0) {
      const [res] = await connection.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active) VALUES ("manager@saviess.org", ?, "Anoop", "Sinha", "field_manager", "+919999000002", 1)',
        [defaultHash]
      );
      mgrUserId = res.insertId;
    } else {
      mgrUserId = mgrCheck[0].id;
    }

    // Field Officer
    const [foCheck] = await connection.query('SELECT id FROM users WHERE email = "fo@saviess.org"');
    let foUserId;
    if (foCheck.length === 0) {
      const [res] = await connection.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active) VALUES ("fo@saviess.org", ?, "Vivek", "Singh", "field_officer", "+919999000003", 1)',
        [defaultHash]
      );
      foUserId = res.insertId;
      
      // Create Field Officer profile
      await connection.query(
        'INSERT IGNORE INTO field_officers (user_id, manager_id, district_id, block_id, coverage_area, status) VALUES (?, ?, 1, 1, "Patna Sadar blocks coverage", "active")',
        [foUserId, mgrUserId]
      );
    }

    // RHP
    const [rhpCheck] = await connection.query('SELECT id FROM users WHERE email = "rhp@saviess.org"');
    let rhpUserId;
    if (rhpCheck.length === 0) {
      const [res] = await connection.query(
        'INSERT INTO users (email, password_hash, first_name, last_name, role, phone, is_active) VALUES ("rhp@saviess.org", ?, "Preeti", "Kumari", "rhp", "+919999000004", 1)',
        [defaultHash]
      );
      rhpUserId = res.insertId;

      // Create RHP Profile
      const [rhpProfileRes] = await connection.query(
        'INSERT IGNORE INTO rhps (user_id, center_name, district_id, block_id, village, status, toolkit_issued) VALUES (?, "Preeti\'s Vision Center", 2, 2, "Harnaut Village", "active", 1)',
        [rhpUserId]
      );
      const rhpId = rhpProfileRes.insertId;

      // Seed default inventory_rhp
      const powers = [1.00, 1.50, 2.00, 2.50, 3.00];
      for (const p of powers) {
        const pStr = p.toFixed(2);
        await connection.query(
          `INSERT IGNORE INTO inventory_rhp 
           (rhp_id, item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, safety_stock_level, unit_price) 
           VALUES (?, ?, ?, "reading", ?, ?, 0.00, 0.00, 5, ?, ?)`,
          [rhpId, `Reading Glasses SPH +${pStr}`, `RD-SPH+${pStr}-CYL-0.00`, p, p, DEFAULT_SAFETY_STOCK_RHP, DEFAULT_UNIT_PRICE]
        );
      }
    }

    // 5. Seed Central Warehouse Inventory
    console.log('Seeding central inventory warehouse...');
    const centralStockItems = [
      { name: 'Reading Glasses SPH +1.00', sku: 'RD-SPH+1.00-CYL-0.00', power: 1.00, qty: 100 },
      { name: 'Reading Glasses SPH +1.50', sku: 'RD-SPH+1.50-CYL-0.00', power: 1.50, qty: 120 },
      { name: 'Reading Glasses SPH +2.00', sku: 'RD-SPH+2.00-CYL-0.00', power: 2.00, qty: 90 },
      { name: 'Reading Glasses SPH +2.50', sku: 'RD-SPH+2.50-CYL-0.00', power: 2.50, qty: 85 },
      { name: 'Reading Glasses SPH +3.00', sku: 'RD-SPH+3.00-CYL-0.00', power: 3.00, qty: 110 }
    ];

    for (const item of centralStockItems) {
      await connection.query(
        `INSERT INTO inventory_central 
         (item_name, sku, glass_type, left_power_sph, right_power_sph, left_power_cyl, right_power_cyl, quantity, safety_stock_level, unit_price, supplier_info, last_restocked_at) 
         VALUES (?, ?, 'reading', ?, ?, 0.00, 0.00, ?, ?, ?, 'VisionSpring Central supplier', CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [item.name, item.sku, item.power, item.power, item.qty, DEFAULT_SAFETY_STOCK_CENTRAL, DEFAULT_UNIT_PRICE]
      );
    }

    // 6. Seed Toolkit Inventory Catalog
    console.log('Seeding toolkits inventory...');
    await connection.query(
      `INSERT INTO toolkit_inventory (item_name, sku, total_quantity, available_quantity, unit_price, description) 
       VALUES 
       ("ASHA Snellen Acuity Charts", "TK-SNELLEN-01", 50, 45, 250.00, "Standard 6m visual acuity distance chart"),
       ("Standard Trial Lens Set Cases", "TK-LENSCASE-02", 30, 28, 4500.00, "232 trial lenses set with frame container"),
       ("Adjustable Trial Frames", "TK-FRAME-03", 40, 38, 800.00, "Comfortable multi-axis trial frame adjustment")
       ON DUPLICATE KEY UPDATE total_quantity = VALUES(total_quantity)`
    );

    // 7. Seed PD Module — Eyeglass Colors & Sample Stock
    console.log('Seeding PD eyeglass colors & stock...');
    
    // Ensure default colors exist (migration may have already inserted them)
    await connection.query(`INSERT IGNORE INTO pd_eyeglass_colors (name, hex_code, emoji) VALUES
      ('Red',   '#EF4444', '🔴'),
      ('Brown', '#92400E', '🟤'),
      ('Blue',  '#3B82F6', '🔵')
    `);

    // Get color IDs
    const [colorRows] = await connection.query('SELECT id, name FROM pd_eyeglass_colors ORDER BY id ASC');
    const colorMap = {};
    for (const c of colorRows) { colorMap[c.name] = c.id; }

    // Initialize stock rows (if not already present)
    for (const c of colorRows) {
      await connection.query(
        'INSERT IGNORE INTO pd_eyeglass_stock (color_id, quantity) VALUES (?, 0)',
        [c.id]
      );
    }

    // Add sample stock (only if stock is 0 — first-time seed)
    const sampleStock = { 'Red': 150, 'Brown': 120, 'Blue': 80 };
    for (const [colorName, qty] of Object.entries(sampleStock)) {
      if (colorMap[colorName]) {
        const [current] = await connection.query(
          'SELECT quantity FROM pd_eyeglass_stock WHERE color_id = ?', [colorMap[colorName]]
        );
        if (current.length > 0 && current[0].quantity === 0) {
          await connection.query(
            'UPDATE pd_eyeglass_stock SET quantity = ? WHERE color_id = ?',
            [qty, colorMap[colorName]]
          );
          // Audit log for the seed stock
          await connection.query(
            'INSERT INTO pd_eyeglass_stock_log (color_id, quantity_added, performed_by, notes) VALUES (?, ?, ?, ?)',
            [colorMap[colorName], qty, adminUserId, 'Initial seed stock']
          );
        }
      }
    }

    await connection.commit();
    console.log('Database seeded successfully!');
  } catch (error) {
    await connection.rollback();
    console.error('Seeding transaction failed:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// Execute seeding if this script is run directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seed;
