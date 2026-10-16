import { Worker } from 'bullmq';
import axios from 'axios';
import redisConnection from '../config/redis.js';
import { query } from '../config/db.js';
import { sseManager } from '../controllers/trade.controller.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * BullMQ Worker – processes trade ingestion jobs.
 *
 * Flow:
 *  1. Calls the Mock BSE API endpoint (which holds the connection for up to 15 min).
 *     This is safe because the worker runs in the Node process — not a browser connection.
 *  2. Receives all trades after the simulated delay.
 *  3. Bulk-upserts trade records into PostgreSQL (INSERT … ON CONFLICT DO NOTHING).
 *  4. Broadcasts an SSE event to all connected dashboard clients so they refresh instantly.
 */

const BSE_INTERNAL_URL = `http://localhost:${process.env.PORT || 5000}/api/bse/getTrades`;

// Allow the worker's axios call to wait longer than the mock delay + buffer (20 min)
const WORKER_TIMEOUT_MS = Number(process.env.BSE_PULL_DELAY_MS || 900_000) + 120_000;

const worker = new Worker(
  'trade-ingestion',
  async (job) => {
    const jobId = job.id;
    console.log(`[Worker] Starting job ${jobId}…`);

    // ── Step 1: Hit the slow BSE mock API ────────────────────────────────────
    let trades;
    try {
      const response = await axios.get(BSE_INTERNAL_URL, {
        timeout: WORKER_TIMEOUT_MS,
        params: { count: job.data?.count || 3000 },
      });
      trades = response.data.trades;
      console.log(`[Worker] Job ${jobId}: received ${trades.length} trades from BSE API.`);
    } catch (err) {
      console.error(`[Worker] Job ${jobId}: BSE API call failed – ${err.message}`);
      throw err; // BullMQ will retry via backoff policy
    }

    // ── Step 2: Bulk upsert into PostgreSQL ──────────────────────────────────
    // Build a parameterised multi-row INSERT statement for efficiency.
    // ON CONFLICT DO NOTHING prevents duplicate inserts on retries.
    const CHUNK_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
      const chunk = trades.slice(i, i + CHUNK_SIZE);

      const values = [];
      const placeholders = chunk.map((trade, idx) => {
        const base = idx * 6;
        values.push(
          trade.tradeId,
          trade.clientName,
          trade.symbol,
          trade.quantity,
          trade.price,
          trade.timestamp,
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      });

      const sql = `
        INSERT INTO trades (trade_id, client_name, symbol, quantity, price, trade_timestamp)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (trade_id) DO NOTHING
      `;

      await query(sql, values);
      insertedCount += chunk.length;
      console.log(`[Worker] Job ${jobId}: upserted chunk ${Math.ceil(i / CHUNK_SIZE) + 1} (${insertedCount}/${trades.length}).`);
    }

    // ── Step 3: Broadcast SSE event to all open dashboards ───────────────────
    const totalResult = await query('SELECT COUNT(*) FROM trades');
    const totalInDb = parseInt(totalResult.rows[0].count, 10);

    sseManager.broadcast({
      type:        'PULL_COMPLETE',
      jobId,
      newTrades:   trades.length,
      totalInDb,
      completedAt: new Date().toISOString(),
    });

    console.log(`[Worker] Job ${jobId}: complete. SSE broadcast sent to ${sseManager.clientCount()} clients.`);

    return { inserted: trades.length, totalInDb };
  },
  {
    connection: redisConnection,
    concurrency: 1, // Only one BSE pull at a time
    limiter: {
      max: 1,
      duration: 1000,
    },
  },
);

worker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);

  // Notify connected dashboards that the pull failed
  sseManager.broadcast({
    type:      'PULL_FAILED',
    jobId:     job?.id,
    reason:    err.message,
    failedAt:  new Date().toISOString(),
  });
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err.message);
});

export default worker;
