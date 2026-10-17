import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config({ override: false });

/**
 * Shared IORedis connection used by both BullMQ Queue and Worker.
 *
 * BullMQ requires `maxRetriesPerRequest: null` so that it can manage
 * long-lived blocking commands without the client throwing timeout errors.
 */
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('connect', () => console.log('[Redis] Connected.'));
redisConnection.on('error', (err) => console.error('[Redis] Error:', err.message));

export default redisConnection;
