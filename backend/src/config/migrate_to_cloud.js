const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function loadSchema() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'test',
    ssl: { rejectUnauthorized: true },
    multipleStatements: true
  });

  console.log('Connected to TiDB Serverless cloud MySQL. Loading schema...');

  let sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'schema.sql'), 'utf8');
  let sql2 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_v2.sql'), 'utf8');

  // Remove CREATE DATABASE and USE statements (TiDB Serverless uses 'test' database)
  sql = sql.replace(/CREATE DATABASE IF NOT EXISTS.*?;/s, '');
  sql = sql.replace(/USE saviess_vep;/g, '');
  sql2 = sql2.replace(/USE saviess_vep;/g, '');

  // Remove DELIMITER blocks (triggers) — not supported in multi-statement mode
  sql = sql.replace(/DELIMITER \$\$[\s\S]*?DELIMITER ;/g, '');

  await conn.query(sql);
  await conn.query(sql2);
  console.log('✅ Schema loaded successfully!');

  // Now create triggers separately (TiDB supports triggers)
  const trigger1 = `
    CREATE TRIGGER trg_after_screening_insert
    AFTER INSERT ON screenings
    FOR EACH ROW
    UPDATE rhps SET total_patients_screened = total_patients_screened + 1 WHERE id = NEW.screened_by_rhp_id;
  `;

  const trigger2 = `
    CREATE TRIGGER trg_after_dispense_insert
    AFTER INSERT ON glass_dispensing
    FOR EACH ROW
    UPDATE rhps SET total_glasses_dispensed = total_glasses_dispensed + 1 WHERE id = NEW.dispensed_by_rhp_id;
  `;

  try {
    await conn.query(trigger1);
    await conn.query(trigger2);
    console.log('✅ Triggers created successfully!');
  } catch (e) {
    console.log('⚠️ Triggers may already exist:', e.message);
  }

  // Verify tables
  const dbName = process.env.DB_NAME || 'test';
  const [tables] = await conn.query(`SHOW TABLES FROM \`${dbName}\``);
  console.log(`\n📊 Tables created: ${tables.length}`);
  tables.forEach(t => console.log('  -', Object.values(t)[0]));

  await conn.end();
  console.log('\n✅ TiDB Serverless cloud database schema migration complete!');
}

loadSchema().catch(e => {
  console.error('❌ Migration failed:', e.message);
  process.exit(1);
});
