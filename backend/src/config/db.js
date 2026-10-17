import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ override: false });

const { Pool } = pg;

/**
 * Constructs a PostgreSQL connection pool.
 * Supports both local PostgreSQL and Supabase Connection Pooler via env vars.
 *
 * When DB_SSL=true the pool uses { rejectUnauthorized: false } so that
 * self-signed / Supabase managed certs are accepted without bundling a CA.
 */
const sslConfig =
  process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: sslConfig,
  // Keep connections warm; BullMQ worker runs long-lived
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
});

/**
 * Runs a query against the pool.
 * @param {string} text  - Parameterised SQL string
 * @param {any[]}  params - Bound parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Verifies database connectivity and ensures the `trades` table exists.
 * Call this once at application startup.
 */
export const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS trades (
      id            SERIAL PRIMARY KEY,
      trade_id      VARCHAR(64)       UNIQUE NOT NULL,
      client_name   VARCHAR(128)      NOT NULL,
      symbol        VARCHAR(20)       NOT NULL,
      quantity      INTEGER           NOT NULL,
      price         NUMERIC(12, 2)    NOT NULL,
      trade_timestamp TIMESTAMPTZ     NOT NULL,
      created_at    TIMESTAMPTZ       DEFAULT NOW()
    );
  `);
  console.log('[DB] trades table ready.');
};

export default pool;
