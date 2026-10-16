# Architecture Note – BSE Trades System

## 1. The Problem

The BSE Exchange API takes up to **15 minutes** to complete a full trade pull. Our infrastructure kills any HTTP connection held open for more than **30 seconds**. A naïve direct fetch from the browser or even a synchronous server-side fetch will always time out.

Additionally, the dashboard must:
- **Open instantly** showing already-stored trades (even during an ongoing pull)
- **Update automatically** when a pull completes — with no page refresh, no client-side polling loop, and no cron scheduler

---

## 2. System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (React + Vite)                             │
│                                                                              │
│  ┌─────────────────────┐   ┌──────────────────────┐   ┌──────────────────┐  │
│  │  DashboardHeader    │   │   MetricsCards       │   │  StatusBanner    │  │
│  └─────────────────────┘   └──────────────────────┘   └──────────────────┘  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     TradeTable (Zustand store)                          │ │
│  │  ● Instant render from DB on load                                       │ │
│  │  ● New rows highlighted blue on SSE push                                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ① GET /api/trades         ② POST /api/trades/trigger   ③ GET /api/trades/stream │
│       (REST)                      (REST, 202)                  (SSE)        │
└────────────────┬──────────────────────────┬──────────────────────┬──────────┘
                 │                          │                      │
                 ▼                          ▼                      │ (push)
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Node.js + Express (Pure ESM)  :5000                       │
│                                                                              │
│  ┌───────────────────────┐   ┌────────────────────────┐                     │
│  │  trade.controller.js  │   │  mockBse.controller.js │                     │
│  │  - GET /trades        │   │  - GET /bse/getTrades  │                     │
│  │  - GET /metrics       │   │    (sleeps BSE_DELAY)  │                     │
│  │  - POST /trigger ─────┼───┼──► BullMQ.add()        │                     │
│  │  - GET /stream (SSE)  │   └────────────────────────┘                     │
│  │  - SSEManager         │            ▲                                      │
│  └───────────┬───────────┘            │ internal HTTP call                  │
│              │ SSE broadcast          │                                      │
│  ┌───────────▼───────────────────────────────────────────┐                  │
│  │                    BullMQ Worker                      │                  │
│  │  1. axios.get(/api/bse/getTrades) — waits up to 17min │                  │
│  │  2. Bulk UPSERT 3000 rows into PostgreSQL (500/chunk) │                  │
│  │  3. sseManager.broadcast(PULL_COMPLETE)               │                  │
│  └───────────────────────────────────────────────────────┘                  │
│                                                                              │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
              ┌────────────────┴───────────────┐
              ▼                                ▼
    ┌──────────────────┐            ┌────────────────────┐
    │   PostgreSQL     │            │   Redis (BullMQ)   │
    │   trades table   │            │   job queue        │
    └──────────────────┘            └────────────────────┘
```

---

## 3. Design Decisions & Rationale

### 3.1 BullMQ + Redis — Decoupling the Long Pull

**Problem:** The 30-second network timeout applies to browser↔server TCP connections. If we fetch BSE data synchronously inside a request handler, both the browser and server connection drop before the pull completes.

**Solution:** When the user clicks "Trigger BSE API Pull", the Express route calls `tradeQueue.add()` and **immediately returns HTTP 202 Accepted** — the response is out within milliseconds. BullMQ enqueues a job into Redis. A Worker (running inside the same Node process, but in its own async loop) picks up the job and calls the BSE mock API with an Axios timeout of `BSE_PULL_DELAY_MS + 2 minutes`. No browser connection is involved in this chain.

**Why BullMQ over a raw `setTimeout`?**
- Retries with exponential backoff on failure
- Job visibility — can query active/waiting/completed/failed counts
- Redis persistence — survives process restarts
- Concurrency control — prevents duplicate simultaneous pulls

### 3.2 PostgreSQL — Instant Dashboard Load

Every time the worker completes a pull, it bulk-upserts trades into PostgreSQL using `INSERT … ON CONFLICT (trade_id) DO NOTHING`. This means:

- **Re-triggers are idempotent** — duplicate trade IDs are silently skipped.
- **The dashboard REST endpoint** (`GET /api/trades`) queries PostgreSQL directly and returns results in milliseconds, regardless of whether a pull is running.
- **The dashboard opens instantly** at any time — it does not wait for any in-flight pull.

### 3.3 SSE — Zero-Polling Real-Time Updates

**Why SSE over WebSockets?**
- One-directional (server → client) push is all we need.
- SSE is natively supported by all modern browsers via the `EventSource` API.
- No upgrade handshake, no ping/pong overhead, works through standard HTTP proxies.
- Simpler to implement and operationalise than a WebSocket server.

**How it works:**
1. The React app calls `new EventSource('/api/trades/stream')` once on mount.
2. The SSE endpoint sets `Content-Type: text/event-stream`, flushes headers, and registers the response in `SSEManager` (an in-process Map).
3. When the BullMQ worker finishes, it calls `sseManager.broadcast({ type: 'PULL_COMPLETE', … })`.
4. The broadcast iterates the Map and writes `data: <json>\n\n` to every open response.
5. The React `onmessage` handler dispatches the event to Zustand, which triggers `refreshTrades()` — a fresh REST call that prepends only genuinely new rows, highlighted in blue for 3 seconds.

**No polling. No scheduler. No page refresh.**

### 3.4 Heartbeat & Reconnect

- The SSE endpoint sends a `: heartbeat\n\n` comment every 25 seconds to keep the TCP connection alive through proxies and load balancers that close idle connections.
- The React `EventSource.onerror` handler implements **exponential backoff reconnection**: 1s → 2s → 4s → … → max 30s.

### 3.5 ESM Modules

All backend JavaScript uses `"type": "module"` in `package.json` and standard `import`/`export` syntax. No `require()` is used anywhere, satisfying the ESM requirement while remaining fully compatible with Node.js 20+.

---

## 4. Scalability Considerations

| Concern                  | Current Approach                | Production Path                          |
|--------------------------|---------------------------------|------------------------------------------|
| Worker co-location       | Same Express process            | Separate worker container/dyno           |
| SSE multi-instance       | In-process `Map`                | Redis Pub/Sub fan-out                    |
| Database writes          | 500-row chunk upserts           | Copy-based bulk load for > 100k rows     |
| BSE API reliability      | 3 retries + exponential backoff | Dead-letter queue + alerting             |
| Dashboard data volume    | 500 rows per page (paginated)   | Virtual scrolling for 100k+ rows         |

---

## 5. Data Flow Summary

```
User click
    │
    ▼
POST /api/trades/trigger
    │  HTTP 202 (< 100ms)
    ▼
BullMQ.add() → Redis
    │
    ▼  (async, no browser involvement)
BullMQ Worker picks up job
    │
    ▼
GET /api/bse/getTrades   (waits BSE_PULL_DELAY_MS)
    │  3000 trade records returned
    ▼
INSERT INTO trades … ON CONFLICT DO NOTHING
    │
    ▼
sseManager.broadcast(PULL_COMPLETE)
    │
    ▼
EventSource.onmessage → Zustand → refreshTrades()
    │
    ▼
New rows prepended to table, highlighted blue for 3s
```
