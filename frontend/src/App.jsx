import React, { useEffect, useRef, useCallback, useState } from 'react';
import { PlayCircle, RefreshCw, Loader2, Menu } from 'lucide-react';
import useTradeStore from './store/useTradeStore.js';
import Sidebar from './components/Sidebar.jsx';
import StatusBanner from './components/StatusBanner.jsx';
import MetricsCards from './components/MetricsCards.jsx';
import TradeTable from './components/TradeTable.jsx';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const SSE_URL = `${API_BASE_URL}/api/trades/stream`;

/**
 * App
 *
 * Root component with vertical collapsible sidebar layout:
 *  1. Left-fixed collapsible Sidebar.
 *  2. Main content area that automatically resizes based on sidebar state.
 *  3. Connects to SSE endpoint and handles real-time updates.
 */
function App() {
  const [collapsed, setCollapsed] = useState(false);

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
  const sseRef = useRef(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef(null);

  const connectSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
    }

    setSseStatus('connecting');
    const es = new EventSource(SSE_URL);
    sseRef.current = es;

    es.onopen = () => {
      setSseStatus('connected');
      reconnectDelay.current = 1000;
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

      const delay = Math.min(reconnectDelay.current, 30_000);
      reconnectDelay.current = delay * 2;

      console.warn(`[SSE] Disconnected. Reconnecting in ${delay}ms…`);
      reconnectTimer.current = setTimeout(connectSSE, delay);
    };
  }, [handleSseEvent, setSseStatus]);

  useEffect(() => {
    connectSSE();
    return () => {
      if (sseRef.current) sseRef.current.close();
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

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Fixed Vertical Sidebar ───────────────────────────────────── */}
      <Sidebar
        sseStatus={sseStatus}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      {/* ── Main Content Area (Offset by sidebar width) ──────────────── */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${collapsed ? 'ml-20' : 'ml-64'
          }`}
      >
        {/* Top bar with quick mobile/toggle access and sync status */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 h-16 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            {/* <button
              onClick={() => setCollapsed((prev) => !prev)}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none"
              title="Toggle Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button> */}
            <div>
              <h1 className="text-base font-bold text-slate-800 tracking-tight leading-none">
                BSE Live Trade Monitoring
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Exchange Ingestion Engine & Automated Pipeline
              </p>
            </div>
          </div>

          {/* <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              30s HTTP Timeout Protected
            </span>
          </div> */}
        </header>

        {/* Global Pull Status Banner */}
        <StatusBanner
          pullStatus={pullStatus}
          isTriggeringPull={isTriggeringPull}
          onTriggerPull={handleTriggerPull}
          error={error}
          lastSyncedAt={lastSyncedAt}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
          {/* Action Row */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Live Trade Records
              </h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                id="refresh-metrics-btn"
                onClick={() => { fetchTrades(); fetchMetrics(); }}
                disabled={isLoadingTrades}
                className="btn-secondary"
                title="Refresh trade records and stats"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingTrades ? 'animate-spin' : ''}`} />
                Refresh
              </button>

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

          {/* Error Banner */}
          {error && pullStatus !== 'running' && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-4 py-3 flex justify-between items-center animate-fade-in">
              <span>{error}</span>
              <button
                onClick={clearError}
                className="text-rose-500 hover:text-rose-700 font-bold ml-4 text-lg leading-none"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {/* Metrics Overview */}
          <MetricsCards metrics={metrics} loading={isLoadingMetrics && !metrics} />

          {/* Trade Table */}
          <TradeTable
            trades={trades}
            newTradeIds={newTradeIds}
            loading={isLoadingTrades}
            pagination={pagination}
          />

          {/* Page Footer */}
          <footer className="text-center text-xs text-slate-400 pb-4 pt-2">
            BSE Trades System · Arham Insurance Brokers Pvt. Ltd.
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
