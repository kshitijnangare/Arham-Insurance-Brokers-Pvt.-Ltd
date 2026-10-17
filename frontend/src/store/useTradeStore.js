import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance.js';

/**
 * Zustand global store for the Trades Dashboard.
 *
 * State slices:
 *   trades        – array of trade records currently displayed
 *   metrics       – aggregate metrics for the summary cards
 *   pullStatus    – 'idle' | 'running' | 'completed' | 'failed'
 *   sseStatus     – 'connecting' | 'connected' | 'disconnected'
 *   isLoadingTrades  – true while initial trades fetch is in flight
 *   isLoadingMetrics – true while metrics fetch is in flight
 *   isTriggeringPull – true while POST /trigger is in flight
 *   error         – last error message string or null
 *   lastSyncedAt  – ISO timestamp of last successful pull
 *   newTradeIds   – Set of tradeId strings to highlight in the table
 *   pagination    – { page, limit, total, pages }
 */

const useTradeStore = create((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────────
  trades:           [],
  metrics:          null,
  pullStatus:       'idle',   // 'idle' | 'running' | 'completed' | 'failed'
  sseStatus:        'connecting',
  isLoadingTrades:  false,
  isLoadingMetrics: false,
  isTriggeringPull: false,
  error:            null,
  lastSyncedAt:     null,
  newTradeIds:      new Set(),
  pagination:       { page: 1, limit: 500, total: 0, pages: 0 },

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Fetches the initial page of trade records from the REST API.
   */
  fetchTrades: async (page = 1, limit = 500) => {
    set({ isLoadingTrades: true, error: null });
    try {
      const res = await axiosInstance.get('/trades', { params: { page, limit } });
      const { trades, total, pages } = res.data;
      set({
        trades,
        pagination:      { page, limit, total, pages },
        isLoadingTrades: false,
      });
    } catch (err) {
      set({ isLoadingTrades: false, error: err.message });
    }
  },

  /**
   * Fetches the latest page of trades and prepends any truly new records
   * (i.e. not already in the current list).
   * Called after an SSE PULL_COMPLETE event.
   */
  refreshTrades: async () => {
    const { pagination } = get();
    try {
      const res = await axiosInstance.get('/trades', {
        params: { page: 1, limit: pagination.limit },
      });
      const { trades: freshTrades, total, pages } = res.data;
      const existingIds = new Set(get().trades.map((t) => t.tradeId));

      const brandNew = freshTrades.filter((t) => !existingIds.has(t.tradeId));
      const newTradeIds = new Set(brandNew.map((t) => t.tradeId));

      set((state) => ({
        trades:     [...brandNew, ...state.trades],
        newTradeIds,
        pagination: { ...state.pagination, total, pages },
        lastSyncedAt: new Date().toISOString(),
      }));

      // Clear highlight after 3 seconds
      setTimeout(() => {
        set({ newTradeIds: new Set() });
      }, 3000);
    } catch (err) {
      console.error('[Store] refreshTrades error:', err.message);
    }
  },

  /**
   * Fetches aggregate metrics for the dashboard cards.
   */
  fetchMetrics: async () => {
    set({ isLoadingMetrics: true });
    try {
      const res = await axiosInstance.get('/trades/metrics');
      set({ metrics: res.data, isLoadingMetrics: false });
    } catch (err) {
      set({ isLoadingMetrics: false, error: err.message });
    }
  },

  /**
   * Posts to /trades/trigger to enqueue a BSE pull job.
   */
  triggerPull: async () => {
    set({ isTriggeringPull: true, error: null });
    try {
      const res = await axiosInstance.post('/trades/trigger');
      set({ isTriggeringPull: false, pullStatus: 'running' });
      return res.data;
    } catch (err) {
      set({ isTriggeringPull: false, error: err.message });
      throw err;
    }
  },

  /**
   * Handles an incoming SSE event object from the backend.
   */
  handleSseEvent: (event) => {
    switch (event.type) {
      case 'connected':
        set({ sseStatus: 'connected' });
        break;

      case 'PULL_STARTED':
        set({ pullStatus: 'running' });
        break;

      case 'PULL_COMPLETE':
        set({ pullStatus: 'completed' });
        // Re-fetch trades and metrics to display the new data
        get().refreshTrades();
        get().fetchMetrics();
        break;

      case 'PULL_FAILED':
        set({ pullStatus: 'failed', error: `Pull failed: ${event.reason}` });
        break;

      default:
        break;
    }
  },

  setSseStatus:  (sseStatus)  => set({ sseStatus }),
  setPullStatus: (pullStatus) => set({ pullStatus }),
  clearError:    ()           => set({ error: null }),
}));

export default useTradeStore;
