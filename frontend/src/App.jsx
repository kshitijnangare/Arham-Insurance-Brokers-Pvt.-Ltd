import React, { useEffect, useRef, useCallback } from 'react';
import { PlayCircle, RefreshCw, Loader2 } from 'lucide-react';
import useTradeStore from './store/useTradeStore.js';
import DashboardHeader from './components/DashboardHeader.jsx';
import StatusBanner    from './components/StatusBanner.jsx';
import MetricsCards    from './components/MetricsCards.jsx';
import TradeTable      from './components/TradeTable.jsx';

const SSE_URL = '/api/trades/stream';

/**
 * App
 *
 * Root component that:
 *  1. Fetches initial trades + metrics on mount.
 *  2. Opens a persistent SSE connection and routes events to Zustand.
 *  3. Reconnects the SSE stream if the connection drops (exponential backoff).
 *  4. Renders all dashboard sub-components.
 */
function App() {
  const {
    trades, metrics, pullStatus, sseStatus, newTradeIds,
    isLoadingTrades, isLoadingMetrics, isTriggeringPull,
    error, lastSyncedAt, pagination,
    fetchTrades, fetchMetrics, triggerPull,
    handleSseEvent, setSseStatus, clearError,
  } = useTradeStore();

  // ── Initial data load ──────────────────────────────────────────────────
  useEffect(() => {
    fetchTrades();
    fetchMetrics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── SSE connection with reconnect ──────────────────────────────────────
  const sseRef          = useRef(null);
  const reconnectDelay  = useRef(1000);
  const reconnectTimer  = useRef(null);

  const connectSSE = useCallback(() => {
    // Close existing connection if any
    if (sseRef.current) {
      sseRef.current.close();
    }

    setSseStatus('connecting');
    const es = new EventSource(SSE_URL);
    sseRef.current = es;

    es.onopen = () => {
      setSseStatus('connected');
      reconnectDelay.current = 1000; // Reset backoff on successful connect
    };

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleSseEvent(payload);
      } catch (err) {
        console.warn('[SSE] Failed to parse message:', event.data, err);
      }
    };

    es.onerror = () => {
      es.close();
      setSseStatus('disconnected');

      // Exponential backoff: 1s → 2s → 4s → … → max 30s
      const delay = Math.min(reconnectDelay.current, 30_000);
      reconnectDelay.current = delay * 2;

      console.warn(`[SSE] Disconnected. Reconnecting in ${delay}ms…`);
      reconnectTimer.current = setTimeout(connectSSE, delay);
    };
  }, [handleSseEvent, setSseStatus]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (sseRef.current)     sseRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectSSE]);

  // ── Trigger pull handler ───────────────────────────────────────────────
  const handleTriggerPull = async () => {
    clearError();
    try {
      await triggerPull();
    } catch {
      // Error is already set in store
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      <DashboardHeader sseStatus={sseStatus} />

      <StatusBanner
        pullStatus={pullStatus}
        isTriggeringPull={isTriggeringPull}
        onTriggerPull={handleTriggerPull}
        error={error}
        lastSyncedAt={lastSyncedAt}
      />

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-6 flex flex-col gap-6">

        {/* ── Page title row ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Trade Records</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Stored in PostgreSQL · Updated via SSE · No polling
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Refresh metrics manually */}
            <button
              id="refresh-metrics-btn"
              onClick={() => { fetchTrades(); fetchMetrics(); }}
              disabled={isLoadingTrades}
              className="btn-secondary"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingTrades ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {/* Trigger BSE pull */}
            <button
              id="trigger-pull-main-btn"
              onClick={handleTriggerPull}
              disabled={isTriggeringPull || pullStatus === 'running'}
              className="btn-primary"
            >
              {isTriggeringPull ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Triggering…
                </>
              ) : pullStatus === 'running' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pull Running…
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4" />
                  Trigger BSE API Pull
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Error banner ───────────────────────────────────────────── */}
        {error && pullStatus !== 'running' && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex justify-between items-center animate-fade-in">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700 font-bold ml-4 text-lg leading-none"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Metrics cards ──────────────────────────────────────────── */}
        <MetricsCards metrics={metrics} loading={isLoadingMetrics && !metrics} />

        {/* ── Trade table ────────────────────────────────────────────── */}
        <TradeTable
          trades={trades}
          newTradeIds={newTradeIds}
          loading={isLoadingTrades}
          pagination={pagination}
        />

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <footer className="text-center text-xs text-slate-400 pb-4">
          BSE Trades System · Node.js + BullMQ + PostgreSQL + SSE · Built for Arham Insurance
        </footer>

      </main>
    </div>
  );
}

export default App;
