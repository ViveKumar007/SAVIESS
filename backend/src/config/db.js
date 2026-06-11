require('dotenv').config();
const mysql = require('mysql2/promise');

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

// Test the connection pool on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connected successfully to ' + (process.env.DB_NAME || 'saviess_vep'));
    connection.release();
  } catch (error) {
    console.error('Error connecting to the database on startup:', error.message);
    process.exit(1); // Exit if DB connection fails to ensure production stability
  }
}

testConnection();

module.exports = pool;
