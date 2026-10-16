import { Queue } from 'bullmq';
import redisConnection from '../config/redis.js';

/**
 * The single BullMQ queue for trade ingestion jobs.
 * We reuse the same IORedis connection from config/redis.js.
 */
const tradeQueue = new Queue('trade-ingestion', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 50 },
    removeOnFail:     { count: 50 },
  },
});

tradeQueue.on('error', (err) => {
  console.error('[TradeQueue] Queue error:', err.message);
});

export default tradeQueue;
