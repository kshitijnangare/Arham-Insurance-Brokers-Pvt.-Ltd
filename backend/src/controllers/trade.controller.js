import { query } from '../config/db.js';
import tradeQueue from '../queues/tradeQueue.js';

// ─── SSE Client Manager ───────────────────────────────────────────────────────

/**
 * Manages all active Server-Sent Events (SSE) connections.
 *
 * Design:
 *  - Each connected browser client is stored in a Map keyed by a unique ID.
 *  - `broadcast()` iterates the map and writes SSE-formatted events to each response.
 *  - Disconnected clients are removed via the `close` event on the request.
 *
 * This is intentionally a simple in-process store. For multi-process deployments,
 * replace broadcast() with a Redis Pub/Sub fan-out.
 */
class SSEManager {
  constructor() {
    /** @type {Map<string, import('express').Response>} */
    this._clients = new Map();
    this._counter  = 0;
  }

  /**
   * Registers a new SSE client response.
   * @param {import('express').Response} res
   * @returns {string} clientId
   */
  addClient(res) {
    const id = `sse-${++this._counter}-${Date.now()}`;
    this._clients.set(id, res);
    console.log(`[SSE] Client connected: ${id}. Total: ${this._clients.size}`);
    return id;
  }

  /**
   * Removes a client by ID.
   * @param {string} id
   */
  removeClient(id) {
    this._clients.delete(id);
    console.log(`[SSE] Client disconnected: ${id}. Total: ${this._clients.size}`);
  }

  /**
   * Sends a JSON event to all connected clients.
   * @param {object} payload
   */
  broadcast(payload) {
    const data = JSON.stringify(payload);
    let sent = 0;
    for (const [, res] of this._clients) {
      try {
        res.write(`data: ${data}\n\n`);
        sent++;
      } catch (err) {
        // Client may have disconnected between check and write – safe to ignore
        console.warn('[SSE] Write failed for a client (likely disconnected).');
      }
    }
    console.log(`[SSE] Broadcast sent to ${sent}/${this._clients.size} clients.`);
  }

  /**
   * Returns the number of currently connected clients.
   * @returns {number}
   */
  clientCount() {
    return this._clients.size;
  }
}

// Singleton exported for use in the worker
export const sseManager = new SSEManager();

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/trades
 *
 * Returns all persisted trade records from PostgreSQL, newest first.
 * Supports optional pagination:
 *   ?page=1&limit=100
 */
export const getTrades = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
    const offset = (page - 1) * limit;

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT
           id,
           trade_id        AS "tradeId",
           client_name     AS "clientName",
           symbol,
           quantity,
           price,
           trade_timestamp AS "timestamp",
           created_at      AS "createdAt"
         FROM trades
         ORDER BY trade_timestamp DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      query('SELECT COUNT(*) FROM trades'),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      success: true,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      trades: dataResult.rows,
    });
  } catch (err) {
    console.error('[TradeController] getTrades error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch trades from database.' });
  }
};

/**
 * GET /api/trades/metrics
 *
 * Returns aggregate metrics for the dashboard summary cards.
 */
export const getTradeMetrics = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*)                                     AS "totalTrades",
        COALESCE(SUM(quantity * price), 0)           AS "totalVolume",
        COALESCE(AVG(price), 0)                      AS "avgPrice",
        COUNT(DISTINCT symbol)                       AS "uniqueSymbols",
        COUNT(DISTINCT client_name)                  AS "uniqueClients",
        MAX(trade_timestamp)                         AS "lastTradeAt"
      FROM trades
    `);

    const row = result.rows[0];

    res.status(200).json({
      success:      true,
      totalTrades:  parseInt(row.totalTrades, 10),
      totalVolume:  parseFloat(row.totalVolume),
      avgPrice:     parseFloat(parseFloat(row.avgPrice).toFixed(2)),
      uniqueSymbols: parseInt(row.uniqueSymbols, 10),
      uniqueClients: parseInt(row.uniqueClients, 10),
      lastTradeAt:   row.lastTradeAt,
    });
  } catch (err) {
    console.error('[TradeController] getTradeMetrics error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to compute metrics.' });
  }
};

/**
 * POST /api/trades/trigger
 *
 * Enqueues a new BSE pull job into BullMQ.
 * Returns HTTP 202 Accepted immediately — the pull happens asynchronously.
 */
export const triggerPull = async (req, res) => {
  try {
    // Check if a job is already active to prevent concurrent pulls
    const activeJobs  = await tradeQueue.getActive();
    const waitingJobs = await tradeQueue.getWaiting();

    if (activeJobs.length > 0 || waitingJobs.length > 0) {
      return res.status(409).json({
        success: false,
        error:   'A BSE pull is already in progress. Please wait for it to complete.',
        active:  activeJobs.length,
        waiting: waitingJobs.length,
      });
    }

    const job = await tradeQueue.add(
      'fetch-bse-trades',
      { count: req.body?.count || 3000, triggeredAt: new Date().toISOString() },
      { jobId: `bse-pull-${Date.now()}` },
    );

    console.log(`[TradeController] Enqueued job ${job.id}.`);

    // Notify connected SSE clients that a pull has started
    sseManager.broadcast({
      type:        'PULL_STARTED',
      jobId:       job.id,
      triggeredAt: new Date().toISOString(),
    });

    return res.status(202).json({
      success: true,
      message: 'BSE pull job enqueued. Dashboard will update automatically when complete.',
      jobId:   job.id,
    });
  } catch (err) {
    console.error('[TradeController] triggerPull error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to enqueue pull job.' });
  }
};

/**
 * GET /api/trades/status
 *
 * Returns the current job queue status (active, waiting, completed, failed counts).
 */
export const getQueueStatus = async (req, res) => {
  try {
    const [active, waiting, completed, failed] = await Promise.all([
      tradeQueue.getActive(),
      tradeQueue.getWaiting(),
      tradeQueue.getCompleted(),
      tradeQueue.getFailed(),
    ]);

    const isRunning = active.length > 0 || waiting.length > 0;

    res.status(200).json({
      success:   true,
      isRunning,
      active:    active.length,
      waiting:   waiting.length,
      completed: completed.length,
      failed:    failed.length,
      lastJob:   completed[0]
        ? {
            id:          completed[0].id,
            returnValue: completed[0].returnvalue,
            finishedAt:  new Date(completed[0].finishedOn).toISOString(),
          }
        : null,
    });
  } catch (err) {
    console.error('[TradeController] getQueueStatus error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to get queue status.' });
  }
};

/**
 * GET /api/trades/stream
 *
 * SSE endpoint. Browsers connect here once and receive push events without polling.
 *
 * Events emitted:
 *  - `connected`     – on first connection (handshake)
 *  - `PULL_STARTED`  – when a BullMQ job is enqueued
 *  - `PULL_COMPLETE` – when a BullMQ job finishes and DB is updated
 *  - `PULL_FAILED`   – when a BullMQ job exhausts all retries
 *  - `heartbeat`     – every 25 seconds to keep the TCP connection alive through proxies
 */
export const streamTrades = (req, res) => {
  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering if behind reverse proxy
  res.flushHeaders();

  // Register client
  const clientId = sseManager.addClient(res);

  // Immediate handshake event
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Heartbeat to prevent proxy / load balancer from closing idle connections
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    sseManager.removeClient(clientId);
  });
};
