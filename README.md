# BSE Trades System

A production-ready, real-time trade ingestion dashboard built to solve a specific infrastructure constraint: **the BSE Exchange API pull takes up to 15 minutes, but our network kills any HTTP connection held open longer than 30 seconds.**

---

## Architecture at a Glance

```
Browser (React + Vite)
  │
  ├─► GET /api/trades          → PostgreSQL (instant, already-stored records)
  ├─► POST /api/trades/trigger → BullMQ (enqueue job, HTTP 202 immediately)
  └─► GET /api/trades/stream   → SSE (long-lived push channel, no polling)
            ▲
            │ push event on pull completion
            │
  Node.js + Express
      ├── BullMQ Worker ──────► GET /api/bse/getTrades (waits 15 min internally)
      │                                  │
      │                                  ▼
      │                          PostgreSQL (bulk upsert)
      │                                  │
      └──────────────────────────────────┘
                 SSE broadcast to all open dashboards
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full diagram and design rationale.

---

## Tech Stack

| Layer      | Technology                                        |
|------------|--------------------------------------------------|
| Backend    | Node.js 20+, Express (Pure ESM), BullMQ, IORedis |
| Database   | PostgreSQL 15+ (local or Supabase pooler)        |
| Queue      | BullMQ (Redis-backed)                            |
| Frontend   | React 18, Vite 5, Tailwind CSS 3, Zustand, Axios |
| Real-time  | Server-Sent Events (SSE)                         |

---

## Prerequisites

- **Node.js** ≥ 20.x  
- **Redis** ≥ 7.x (running locally on default port `6379`)  
- **PostgreSQL** ≥ 14 (local or Supabase)

---

## Setup Instructions

### 1. Clone and enter the project

```bash
git clone <your-repo-url>
cd bse-trades-system
```

### 2. Start Redis (Windows)

If you have Redis installed via WSL or Redis for Windows:

```bash
# WSL
wsl redis-server

# Or if using Memurai (Redis-compatible for Windows)
memurai
```

Verify Redis is running:
```bash
redis-cli ping
# Expected: PONG
```

### 3. Create the PostgreSQL database

Connect to your local PostgreSQL instance (via psql or pgAdmin) and run:

```sql
CREATE DATABASE ftat_db;
```

> The `trades` table is created **automatically** when the backend starts (`initDb()`).
> You do **not** need to run any manual migration script.

For **Supabase**, create a project and note your Connection Pooler credentials.

### 4. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Edit `.env` and set your credentials:

```env
PORT=5000
REDIS_URL=redis://127.0.0.1:6379

# For quick testing, set delay to 15 seconds:
BSE_PULL_DELAY_MS=15000
# For realistic simulation, set to 15 minutes:
# BSE_PULL_DELAY_MS=900000

# Local PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=ftat_db
DB_SSL=false

# --- OR Supabase Connection Pooler ---
# DB_HOST=aws-1-ap-south-1.pooler.supabase.com
# DB_PORT=5432
# DB_USER=postgres.your_project_ref
# DB_PASSWORD=your_supabase_password
# DB_NAME=postgres
# DB_SSL=true
```

### 5. Install dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 6. Start the backend

```bash
cd backend
npm run dev
```

You should see:
```
[Redis] Connected.
[DB] trades table ready.
🚀 BSE Trades Backend running on http://localhost:5000
```

### 7. Start the frontend

Open a **new terminal**:

```bash
cd frontend
npm run dev
```

Vite will start on **http://localhost:5173**.

---

## Usage

1. Open **http://localhost:5173** in your browser.
2. The dashboard loads instantly, showing any already-stored trades.
3. Click **"Trigger BSE API Pull"** — the server responds in `<100ms` with HTTP 202.
4. The status banner shows **"BSE pull in progress"** with a spinner.
5. After the configured delay (`BSE_PULL_DELAY_MS`), the BullMQ worker finishes, saves trades to PostgreSQL, and broadcasts an SSE event.
6. The dashboard **automatically** updates with new trades highlighted in blue — **no page refresh, no polling, no cron job**.

---

## API Reference

| Method | Endpoint                  | Description                                  |
|--------|---------------------------|----------------------------------------------|
| GET    | `/api/trades`             | Paginated list of trades from PostgreSQL     |
| GET    | `/api/trades/metrics`     | Aggregate summary metrics                    |
| GET    | `/api/trades/status`      | BullMQ queue status                          |
| POST   | `/api/trades/trigger`     | Enqueue a BSE pull job (HTTP 202)            |
| GET    | `/api/trades/stream`      | SSE stream for real-time push events         |
| GET    | `/api/bse/getTrades`      | Mock BSE API (simulates 15-min delay)        |
| GET    | `/health`                 | Health check                                 |

### Query Parameters (`/api/trades`)

| Param   | Default | Description                   |
|---------|---------|-------------------------------|
| `page`  | `1`     | Page number                   |
| `limit` | `500`   | Records per page (max 2000)   |

---

## SSE Events

The frontend connects to `/api/trades/stream` once. Events pushed by the backend:

| Event Type      | Trigger                                         |
|-----------------|------------------------------------------------|
| `connected`     | On SSE handshake                                |
| `PULL_STARTED`  | When a pull job is enqueued                     |
| `PULL_COMPLETE` | When the worker finishes and DB is updated      |
| `PULL_FAILED`   | When the worker exhausts all retry attempts     |

---

## Project Structure

```
bse-trades-system/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # PostgreSQL pool + initDb()
│   │   │   └── redis.js           # IORedis singleton
│   │   ├── controllers/
│   │   │   ├── mockBse.controller.js   # GET /api/bse/getTrades
│   │   │   └── trade.controller.js     # REST + SSEManager + SSE stream
│   │   ├── queues/
│   │   │   ├── tradeQueue.js      # BullMQ Queue
│   │   │   └── tradeWorker.js     # BullMQ Worker (fetch → upsert → SSE)
│   │   ├── routes/
│   │   │   └── api.js             # Express router
│   │   ├── mock/
│   │   │   └── mockData.js        # Trade record generator (3000 records)
│   │   └── index.js               # Express entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axiosInstance.js
│   │   ├── components/
│   │   │   ├── DashboardHeader.jsx
│   │   │   ├── StatusBanner.jsx
│   │   │   ├── TradeTable.jsx
│   │   │   └── MetricsCards.jsx
│   │   ├── store/
│   │   │   └── useTradeStore.js   # Zustand global store
│   │   ├── App.jsx                # SSE connection + root layout
│   │   ├── main.jsx
│   │   └── index.css
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── ARCHITECTURE.md
└── README.md
```

---

## Development Notes

- **Changing the mock delay**: Edit `BSE_PULL_DELAY_MS` in `.env`. `15000` = 15 seconds for quick testing.
- **Worker in same process**: For simplicity, the BullMQ worker runs inside the Express process. In production, move it to a separate worker dyno/container.
- **Multi-process SSE**: The `SSEManager` is in-process. For clustered/multi-instance deployments, replace `broadcast()` with Redis Pub/Sub.
- **Supabase SSL**: Set `DB_SSL=true` in `.env` and uncomment the Supabase variables.
