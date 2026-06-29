const path = require('path');
const envPath = path.resolve(__dirname, '../../.env');
const dotenvResult = require('dotenv').config({ path: envPath });
const mysql = require('mysql2/promise');

// Startup diagnostic: warn loudly if .env was not loaded
if (dotenvResult.error) {
  console.error(`[DB-CRITICAL] Failed to load .env from ${envPath}: ${dotenvResult.error.message}`);
  console.error('[DB-CRITICAL] All database config will use fallback defaults (localhost/saviess_vep). This is almost certainly wrong!');
}
if (!process.env.DB_HOST) {
  console.warn('[DB-WARNING] DB_HOST not set in environment. Falling back to "localhost".');
}
console.log(`[DB-CONFIG] Host: ${process.env.DB_HOST || 'localhost'} | DB: ${process.env.DB_NAME || 'saviess_vep'} | Port: ${process.env.DB_PORT || '3306'} | SSL: ${process.env.DB_SSL || 'false'}`);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'saviess_vep',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // SSL required for cloud database providers like TiDB Serverless
  ...(process.env.DB_SSL === 'true' && {
    ssl: { rejectUnauthorized: true }
  })
});

// Set SQL_MODE on each new connection to ensure compatibility
// TiDB is MySQL-compatible but setting explicit sql_mode ensures consistency
pool.on('connection', (connection) => {
  connection.query("SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
});

// Test the connection pool on startup and verify database identity
async function testConnection() {
  const expectedDb = process.env.DB_NAME || 'saviess_vep';
  try {
    const connection = await pool.getConnection();
    
    // Verify which database is actually active
    const [dbCheck] = await connection.query('SELECT DATABASE() as active_db');
    const activeDb = dbCheck[0]?.active_db;
    
    if (activeDb !== expectedDb) {
      console.warn(`[DB-WARNING] Database mismatch! Expected "${expectedDb}" but connected to "${activeDb}".`);
      console.warn('[DB-WARNING] Check DB_NAME in your .env file. Data may be read from/written to the wrong database.');
    } else {
      console.log(`Database connected successfully to "${activeDb}" (verified)`);
    }
    
    connection.release();
  } catch (error) {
    console.error('Error connecting to the database on startup:', error.message);
    console.warn('Server will remain running. The connection pool will automatically retry on incoming requests.');
  }
}

testConnection();

module.exports = pool;
