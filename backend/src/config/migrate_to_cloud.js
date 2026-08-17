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
  let sql3 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_add_states.sql'), 'utf8');
  let sql4 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_fm_teams.sql'), 'utf8');
  let sql5 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_rhp_registration.sql'), 'utf8');
  let sql6 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_pd_module.sql'), 'utf8');
  let sql7 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_field_manager_profile.sql'), 'utf8');
  let sql8 = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migration_audit_fixes.sql'), 'utf8');

  // Clean all SQL files
  const cleanSql = (content) => {
    return content
      .replace(/CREATE DATABASE IF NOT EXISTS.*?;/s, '')
      .replace(/USE saviess_vep;/g, '')
      .replace(/USE test;/g, '')
      .replace(/DELIMITER \$\$[\s\S]*?DELIMITER ;/g, '');
  };

  sql = cleanSql(sql);
  sql2 = cleanSql(sql2);
  sql3 = cleanSql(sql3);
  sql4 = cleanSql(sql4);
  sql5 = cleanSql(sql5);
  sql6 = cleanSql(sql6);
  sql7 = cleanSql(sql7);
  sql8 = cleanSql(sql8);

  const executeSql = async (conn, sqlContent, name) => {
    console.log(`Applying ${name}...`);
    // Split by semicolon, but handle comment lines and empty space
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (err) {
        // Ignore duplicate column (1060), duplicate key (1061), table already exists (1050), duplicate entry (1062), column doesn't exist to drop (1091), duplicate key in table (1022), duplicate foreign key constraint name (1826)
        if ([1022, 1050, 1060, 1061, 1062, 1091, 1826].includes(err.errno)) {
          console.log(`  [Note - Ignored]: ${err.message}`);
        } else {
          console.error(`  [Error in statement]: ${stmt}`);
          throw err;
        }
      }
    }
  };

  await executeSql(conn, sql, 'schema.sql');
  await executeSql(conn, sql2, 'migration_v2.sql');
  await executeSql(conn, sql3, 'migration_add_states.sql');
  await executeSql(conn, sql4, 'migration_fm_teams.sql');
  await executeSql(conn, sql5, 'migration_rhp_registration.sql');
  await executeSql(conn, sql6, 'migration_pd_module.sql');
  await executeSql(conn, sql7, 'migration_field_manager_profile.sql');
  await executeSql(conn, sql8, 'migration_audit_fixes.sql');
  console.log('✅ Schema and all migrations processed successfully!');

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
    await conn.query(trigger1.trim());
    console.log('✅ Trigger 1 created successfully!');
  } catch (e) {
    console.log('⚠️ Trigger 1 check:', e.message);
  }

  try {
    await conn.query(trigger2.trim());
    console.log('✅ Trigger 2 created successfully!');
  } catch (e) {
    console.log('⚠️ Trigger 2 check:', e.message);
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
