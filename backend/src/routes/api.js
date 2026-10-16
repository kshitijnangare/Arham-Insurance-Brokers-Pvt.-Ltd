import { Router } from 'express';
import { getTrades as getBseTrades } from '../controllers/mockBse.controller.js';
import {
  getTrades,
  getTradeMetrics,
  triggerPull,
  getQueueStatus,
  streamTrades,
} from '../controllers/trade.controller.js';

const router = Router();

// ─── Mock BSE Exchange Endpoint ──────────────────────────────────────────────
// Called internally by the BullMQ worker — not exposed to the browser directly.
router.get('/bse/getTrades', getBseTrades);

// ─── Trade Data REST Endpoints ────────────────────────────────────────────────
router.get('/trades',         getTrades);         // Paginated trade list from DB
router.get('/trades/metrics', getTradeMetrics);   // Summary metrics for dashboard cards
router.get('/trades/status',  getQueueStatus);    // BullMQ queue status
router.post('/trades/trigger', triggerPull);      // Kick off a BSE pull job (HTTP 202)

// ─── Real-Time SSE Stream ─────────────────────────────────────────────────────
// Dashboard clients connect here once and receive push events.
router.get('/trades/stream',  streamTrades);

export default router;
