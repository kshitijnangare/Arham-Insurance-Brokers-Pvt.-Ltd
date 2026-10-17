import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDb } from './config/db.js';
import apiRouter from './routes/api.js';
import dotenv from 'dotenv';

// ─── Import worker to register it in the same process ────────────────────────
// The worker must be imported so BullMQ can process queued jobs.
// In a production environment with high load, move this to a separate process.
import './queues/tradeWorker.js';

const app = express();
const PORT = process.env.PORT || 5000;
dotenv.config();


// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative dev port
    'http://127.0.0.1:5173',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

// SSE connections must NOT be parsed as JSON — only apply JSON parsing to /api routes
// that are not the stream endpoint.
app.use((req, res, next) => {
  if (req.path === '/api/trades/stream') return next();
  express.json()(req, res, next);
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[App] Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error.' });
});

// ─── Startup ─────────────────────────────────────────────────────────────────

const start = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`\n🚀 BSE Trades Backend running on http://localhost:${PORT}`);
      console.log(`   Health:  http://localhost:${PORT}/health`);
      console.log(`   API:     http://localhost:${PORT}/api/trades`);
      console.log(`   SSE:     http://localhost:${PORT}/api/trades/stream`);
      console.log(`   BSE API: http://localhost:${PORT}/api/bse/getTrades`);
      console.log(`   Delay:   ${process.env.BSE_PULL_DELAY_MS}ms\n`);
    });
  } catch (err) {
    console.error('[App] Startup failed:', err.message);
    process.exit(1);
  }
};

start();
