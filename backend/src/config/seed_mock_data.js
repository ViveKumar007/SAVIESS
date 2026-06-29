/**
 * Seed realistic mock data for the admin dashboard.
 * Populates: patients, screenings, glass_dispensing, fo_visits, rhp_applications, field_reports
 * Uses the existing seeded users, RHP (id=1), and FO (id=1).
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'test',
    port: parseInt(process.env.DB_PORT || '3306'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });

  console.log('Starting mock data seeding...');

  // ---- 1. Seed RHP Applications (6 applications across different statuses) ----
  console.log('  Seeding RHP applications...');
  const appStatuses = ['applied', 'under_review', 'interviewed', 'training_scheduled', 'approved', 'rejected'];
  const applicants = [
    { fn: 'Sunita', ln: 'Devi', gender: 'female', age: 32, phone: '+919800100001', village: 'Rajgir', qual: '12th Pass + ASHA Training' },
    { fn: 'Ravi', ln: 'Prasad', gender: 'male', age: 28, phone: '+919800100002', village: 'Bihar Sharif', qual: 'Graduate + Paramedical' },
    { fn: 'Aarti', ln: 'Kumari', gender: 'female', age: 35, phone: '+919800100003', village: 'Bodh Gaya', qual: 'ANM Diploma' },
    { fn: 'Manoj', ln: 'Yadav', gender: 'male', age: 40, phone: '+919800100004', village: 'Nalanda Town', qual: 'B.Sc Nursing' },
    { fn: 'Rekha', ln: 'Singh', gender: 'female', age: 30, phone: '+919800100005', village: 'Sherghati Town', qual: '10th Pass + Health Worker' },
    { fn: 'Deepak', ln: 'Kumar', gender: 'male', age: 26, phone: '+919800100006', village: 'Danapur', qual: 'B.Pharma' },
  ];
  for (let i = 0; i < applicants.length; i++) {
    const a = applicants[i];
    const distId = (i % 3) + 1;
    const blockId = (i % 3) + 1;
    const daysAgo = 30 + (i * 5);
    await conn.query(
      `INSERT IGNORE INTO rhp_applications (first_name, last_name, gender, age, phone, district_id, block_id, village, qualification, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [a.fn, a.ln, a.gender, a.age, a.phone, distId, blockId, a.village, a.qual, appStatuses[i], daysAgo]
    );
  }
  console.log('    ✓ 6 RHP applications seeded');

  // ---- 2. Seed Patients (15 patients registered by RHP id=1) ----
  console.log('  Seeding patients...');
  const patientNames = [
    { fn: 'Ram', ln: 'Bahadur', gender: 'male', age: 55, phone: '+919811000001', village: 'Harnaut Village' },
    { fn: 'Sita', ln: 'Devi', gender: 'female', age: 48, phone: '+919811000002', village: 'Harnaut Village' },
    { fn: 'Mohan', ln: 'Lal', gender: 'male', age: 62, phone: '+919811000003', village: 'Rajgir' },
    { fn: 'Geeta', ln: 'Kumari', gender: 'female', age: 44, phone: '+919811000004', village: 'Bihar Sharif' },
    { fn: 'Suresh', ln: 'Prasad', gender: 'male', age: 70, phone: '+919811000005', village: 'Nalanda Town' },
    { fn: 'Lakshmi', ln: 'Devi', gender: 'female', age: 58, phone: '+919811000006', village: 'Bodh Gaya' },
    { fn: 'Rajesh', ln: 'Kumar', gender: 'male', age: 51, phone: '+919811000007', village: 'Sherghati Town' },
    { fn: 'Pushpa', ln: 'Rani', gender: 'female', age: 66, phone: '+919811000008', village: 'Danapur' },
    { fn: 'Vijay', ln: 'Singh', gender: 'male', age: 45, phone: '+919811000009', village: 'Harnaut Village' },
    { fn: 'Kamla', ln: 'Devi', gender: 'female', age: 53, phone: '+919811000010', village: 'Rajgir' },
    { fn: 'Anil', ln: 'Yadav', gender: 'male', age: 42, phone: '+919811000011', village: 'Bihar Sharif' },
    { fn: 'Savitri', ln: 'Kumari', gender: 'female', age: 60, phone: '+919811000012', village: 'Nalanda Town' },
    { fn: 'Dinesh', ln: 'Mahto', gender: 'male', age: 38, phone: '+919811000013', village: 'Bodh Gaya' },
    { fn: 'Meena', ln: 'Sinha', gender: 'female', age: 47, phone: '+919811000014', village: 'Sherghati Town' },
    { fn: 'Bhola', ln: 'Nath', gender: 'male', age: 72, phone: '+919811000015', village: 'Harnaut Village' },
  ];
  const patientIds = [];
  for (let i = 0; i < patientNames.length; i++) {
    const p = patientNames[i];
    const distId = (i % 3) + 1;
    const blockId = (i % 3) + 1;
    const daysAgo = 25 - i; // Spread across 25 days
    const [result] = await conn.query(
      `INSERT INTO patients (first_name, last_name, gender, age, phone, district_id, block_id, village, created_by_rhp_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [p.fn, p.ln, p.gender, p.age, p.phone, distId, blockId, p.village, daysAgo]
    );
    patientIds.push(result.insertId);
  }
  console.log(`    ✓ ${patientIds.length} patients seeded`);

  // ---- 3. Seed Screenings (one per patient) ----
  console.log('  Seeding screenings...');
  const screeningTypes = ['presbyopia', 'refractive_error', 'cataract_suspect', 'normal', 'presbyopia'];
  const vaValues = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'];
  const screeningIds = [];
  for (let i = 0; i < patientIds.length; i++) {
    const sType = screeningTypes[i % screeningTypes.length];
    const vaL = vaValues[i % vaValues.length];
    const vaR = vaValues[(i + 1) % vaValues.length];
    const sphL = (1.0 + (i * 0.25)).toFixed(2);
    const sphR = (1.0 + (i * 0.25) + 0.25).toFixed(2);
    const cylL = (i % 3 === 0 ? -0.50 : 0.00).toFixed(2);
    const cylR = (i % 4 === 0 ? -0.75 : 0.00).toFixed(2);
    const referral = (sType === 'cataract_suspect') ? 1 : 0;
    const daysAgo = 24 - i;

    const [result] = await conn.query(
      `INSERT INTO screenings (patient_id, screened_by_rhp_id, screening_date, visual_acuity_left, visual_acuity_right,
        spherical_left, spherical_right, cylindrical_left, cylindrical_right, axis_left, axis_right,
        screening_type, referral_recommended, created_at)
       VALUES (?, 1, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [patientIds[i], daysAgo, vaL, vaR, sphL, sphR, cylL, cylR, (i * 15) % 180, ((i + 3) * 20) % 180, sType, referral, daysAgo]
    );
    screeningIds.push(result.insertId);
  }
  console.log(`    ✓ ${screeningIds.length} screenings seeded`);

  // ---- 4. Seed Glass Dispensings (for 10 of the 15 patients) ----
  console.log('  Seeding glass dispensings...');
  const frameTypes = ['Full Rim', 'Half Rim', 'Rimless', 'Full Rim', 'Half Rim'];
  const frameColors = ['Black', 'Brown', 'Blue', 'Grey', 'Tortoise'];
  const glassTypes = ['reading', 'bifocal', 'single_vision'];
  let dispensingCount = 0;
  for (let i = 0; i < 10; i++) {
    const cost = 120 + (i * 30);
    const paid = cost - (i % 3 === 0 ? 20 : 0);
    const subsidyApplied = i % 4 === 0 ? 1 : 0;
    const subsidyAmt = subsidyApplied ? 50 : 0;
    const sphL = (1.0 + (i * 0.25)).toFixed(2);
    const sphR = (1.25 + (i * 0.25)).toFixed(2);
    const invoiceNum = `INV-2026-${String(1001 + i).padStart(4, '0')}`;
    const daysAgo = 22 - (i * 2);

    await conn.query(
      `INSERT INTO glass_dispensing (screening_id, patient_id, dispensed_by_rhp_id, dispensing_date,
        left_power_sph, right_power_sph, left_power_cyl, right_power_cyl,
        frame_type, frame_color, glass_type, cost, amount_paid, subsidy_applied, subsidy_amount, invoice_number, created_at)
       VALUES (?, ?, 1, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, 0.00, 0.00, ?, ?, ?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [screeningIds[i], patientIds[i], daysAgo, sphL, sphR,
       frameTypes[i % frameTypes.length], frameColors[i % frameColors.length], glassTypes[i % glassTypes.length],
       cost, paid, subsidyApplied, subsidyAmt, invoiceNum, daysAgo]
    );
    dispensingCount++;
  }
  console.log(`    ✓ ${dispensingCount} glass dispensings seeded`);

  // ---- 5. Seed FO Visits (12 visits by FO id=1 to RHP id=1) ----
  console.log('  Seeding FO visits...');
  const purposes = ['routine', 'onboarding', 'training_audit', 'inventory_delivery', 'routine', 'other'];
  const visitStatuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'planned'];
  let visitCount = 0;
  const visitIds = [];
  for (let i = 0; i < 12; i++) {
    const daysAgo = 24 - (i * 2);
    const lat = (25.5941 + (Math.random() * 0.1 - 0.05)).toFixed(8);
    const lng = (85.1376 + (Math.random() * 0.1 - 0.05)).toFixed(8);
    const purpose = purposes[i % purposes.length];
    const status = visitStatuses[i % visitStatuses.length];
    const notes = [
      'Routine check, RHP operations normal. Stock levels adequate.',
      'Completed onboarding documentation and toolkit handover.',
      'Training audit: RHP demonstrated correct screening technique.',
      'Delivered 20 units of reading glasses (SPH +1.50 to +2.50).',
      'Monthly routine visit. Reviewed patient records and financials.',
      'Special visit for community eye camp coordination.',
      'Verified toolkit condition. Trial lens set in good working order.',
      'Observed 3 patient screenings during visit. Quality satisfactory.',
      'Collected monthly sales data and indent requests.',
      'Follow-up on previously flagged stock discrepancy - resolved.',
      'Coordinated with Block Health Officer for outreach camp.',
      'Quarterly performance review discussion with RHP.',
    ][i];

    const [result] = await conn.query(
      `INSERT INTO fo_visits (fo_id, target_rhp_id, visit_date, purpose, latitude, longitude, address_captured, notes, status,
        check_in_time, check_out_time, created_at)
       VALUES (1, 1, DATE_SUB(CURDATE(), INTERVAL ? DAY), ?, ?, ?, 'Near Harnaut Primary Health Center, Nalanda', ?, ?,
        DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY) + INTERVAL 2 HOUR, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [daysAgo, purpose, lat, lng, notes, status, daysAgo, daysAgo, daysAgo]
    );
    visitIds.push(result.insertId);
    visitCount++;
  }
  console.log(`    ✓ ${visitCount} FO visits seeded`);

  // ---- 6. Seed Field Reports (for 6 of the completed visits) ----
  console.log('  Seeding field reports...');
  const reportTexts = [
    'RHP Preeti is maintaining good patient records. Screening accuracy is improving. Recommended for advanced training.',
    'Onboarding completed successfully. RHP has set up the vision center as per guidelines. Toolkit handed over.',
    'Training audit passed. RHP demonstrated proficiency in using trial lens set and Snellen chart.',
    'Inventory delivery completed. All items verified and stock register updated. No discrepancies found.',
    'Monthly review completed. 8 patients screened this month, 3 glasses dispensed. Revenue collection on track.',
    'Community outreach camp planned for next week. RHP has coordinated with local ASHA workers.',
  ];
  const reportStatuses = ['approved', 'approved', 'pending', 'approved', 'pending', 'rejected'];
  for (let i = 0; i < 6; i++) {
    await conn.query(
      `INSERT INTO field_reports (visit_id, fo_id, report_text, status, reviewed_by_user_id, review_comments, reviewed_at, created_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [
        visitIds[i],
        reportTexts[i],
        reportStatuses[i],
        reportStatuses[i] !== 'pending' ? 3 : null,  // manager user_id=3 reviews
        reportStatuses[i] === 'rejected' ? 'Needs more detail on screening quality observations.' : (reportStatuses[i] === 'approved' ? 'Good report. Keep up the monitoring.' : null),
        reportStatuses[i] !== 'pending' ? conn.format('DATE_SUB(NOW(), INTERVAL ? DAY)', [20 - (i * 3)]) : null,
        22 - (i * 3)
      ]
    );
  }
  // Fix the reviewed_at — re-update with proper dates
  for (let i = 0; i < 6; i++) {
    if (reportStatuses[i] !== 'pending') {
      await conn.query(
        `UPDATE field_reports SET reviewed_at = DATE_SUB(NOW(), INTERVAL ? DAY) WHERE visit_id = ?`,
        [20 - (i * 3), visitIds[i]]
      );
    }
  }
  console.log('    ✓ 6 field reports seeded');

  // ---- 7. Seed Partners (3 partners) ----
  console.log('  Seeding partners...');
  const partners = [
    { name: 'VisionSpring India', type: 'ngo', contact: 'Dr. Amit Shah', phone: '+919800200001', email: 'amit@visionspring.org', distId: 1 },
    { name: 'Bihar State Health Society', type: 'government', contact: 'Dr. Priya Verma', phone: '+919800200002', email: 'priya@bshs.gov.in', distId: 2 },
    { name: 'Essilor India Foundation', type: 'corporate', contact: 'Rahul Mehta', phone: '+919800200003', email: 'rahul@essilor.org', distId: 3 },
  ];
  for (const p of partners) {
    await conn.query(
      `INSERT IGNORE INTO partners (name, type, contact_person, phone, email, district_id, status, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 2, DATE_SUB(NOW(), INTERVAL 45 DAY))`,
      [p.name, p.type, p.contact, p.phone, p.email, p.distId]
    );
  }
  console.log('    ✓ 3 partners seeded');

  // ---- Final row count verification ----
  console.log('\n=== Verification: Row counts after seeding ===');
  const checkTables = ['rhp_applications', 'patients', 'screenings', 'glass_dispensing', 'fo_visits', 'field_reports', 'partners'];
  for (const tbl of checkTables) {
    const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tbl}\``);
    console.log(`    ${tbl}: ${rows[0].cnt} rows`);
  }

  console.log('\n✅ Mock data seeding completed successfully!');
  console.log('   Restart the backend server and refresh the admin dashboard to see the data.');

  conn.end();
})().catch(e => {
  console.error('Seeding error:', e.message);
  console.error(e.stack);
  process.exit(1);
});
