/**
 * Seed remaining mock data: field_reports and partners.
 * (patients, screenings, dispensings, visits already seeded)
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

  console.log('Seeding remaining mock data...');

  // Get visit IDs
  const [visits] = await conn.query('SELECT id FROM fo_visits ORDER BY id ASC LIMIT 12');
  const visitIds = visits.map(v => v.id);
  console.log(`  Found ${visitIds.length} visit IDs`);

  // ---- 1. Seed Field Reports ----
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
  const reviewComments = [
    'Good report. Keep up the monitoring.',
    'Good report. Keep up the monitoring.',
    null,
    'Good report. Keep up the monitoring.',
    null,
    'Needs more detail on screening quality observations.',
  ];

  for (let i = 0; i < 6 && i < visitIds.length; i++) {
    const isPending = reportStatuses[i] === 'pending';
    const daysAgoCreated = 22 - (i * 3);
    const daysAgoReviewed = 20 - (i * 3);

    if (isPending) {
      await conn.query(
        `INSERT INTO field_reports (visit_id, fo_id, report_text, status, created_at)
         VALUES (?, 1, ?, 'pending', DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [visitIds[i], reportTexts[i], daysAgoCreated]
      );
    } else {
      await conn.query(
        `INSERT INTO field_reports (visit_id, fo_id, report_text, status, reviewed_by_user_id, review_comments, reviewed_at, created_at)
         VALUES (?, 1, ?, ?, 3, ?, DATE_SUB(NOW(), INTERVAL ? DAY), DATE_SUB(NOW(), INTERVAL ? DAY))`,
        [visitIds[i], reportTexts[i], reportStatuses[i], reviewComments[i], daysAgoReviewed, daysAgoCreated]
      );
    }
  }
  console.log('    ✓ 6 field reports seeded');

  // ---- 2. Seed Partners ----
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

  // ---- Final verification ----
  console.log('\n=== Final row counts ===');
  const checkTables = ['users', 'rhp_applications', 'patients', 'screenings', 'glass_dispensing', 'fo_visits', 'field_reports', 'partners', 'inventory_central', 'toolkit_inventory'];
  for (const tbl of checkTables) {
    try {
      const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tbl}\``);
      console.log(`    ${tbl}: ${rows[0].cnt} rows`);
    } catch (e) {
      console.log(`    ${tbl}: ERROR`);
    }
  }

  console.log('\n✅ All mock data seeded successfully!');
  console.log('   Restart the backend server and refresh the admin dashboard.');

  conn.end();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
