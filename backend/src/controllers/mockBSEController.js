import { generateMockTrades } from '../mock/mockData.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * GET /api/bse/getTrades
 *
 * Simulates the BSE Exchange API.
 * - Responds only after the configured delay (BSE_PULL_DELAY_MS, default 15 min).
 * - This endpoint is called exclusively by the BullMQ worker, which runs outside
 *   the browser's 30-second connection timeout.
 *
 * Query params:
 *   ?count=<number>  (optional) – how many trade records to return (default 3000)
 *   ?delay=<ms>      (optional) – override delay in ms (for ad-hoc testing only)
 */
export const getTrades = async (req, res) => {
  const count = Math.min(parseInt(req.query.count, 10) || 3000, 10000);
  const delay = parseInt(req.query.delay, 10) || Number(process.env.BSE_PULL_DELAY_MS) || 900_000;

  console.log(`[MockBSE] Pull started. Returning ${count} trades after ${delay}ms delay…`);

  // Simulate the long network pull (15 minutes in production, configurable for dev)
  await new Promise((resolve) => setTimeout(resolve, delay));

  const trades = generateMockTrades(count);

  console.log(`[MockBSE] Pull complete. Sending ${trades.length} records.`);

  res.status(200).json({
    success: true,
    count: trades.length,
    pulledAt: new Date().toISOString(),
    trades,
  });
};
