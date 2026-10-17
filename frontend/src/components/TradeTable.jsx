import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, Sparkles } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
    .format(price);

const formatQuantity = (qty) =>
  new Intl.NumberFormat('en-IN').format(qty);

const formatDateTime = (isoString) =>
  isoString
    ? new Intl.DateTimeFormat('en-IN', {
        day:    '2-digit',
        month:  'short',
        year:   'numeric',
        hour:   '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(isoString))
    : '—';

// ─── Sort Icon ────────────────────────────────────────────────────────────────

const SortIcon = ({ column, sortBy, sortDir }) => {
  if (sortBy !== column) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
    : <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />;
};

// ─── Columns definition ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'tradeId',    label: 'Trade ID',   sortable: true  },
  { key: 'clientName', label: 'Client',     sortable: true  },
  { key: 'symbol',     label: 'Symbol',     sortable: true  },
  { key: 'quantity',   label: 'Qty',        sortable: true  },
  { key: 'price',      label: 'Price',      sortable: true  },
  { key: 'value',      label: 'Value',      sortable: false },
  { key: 'timestamp',  label: 'Trade Time', sortable: true  },
];

// ─── TradeTable ───────────────────────────────────────────────────────────────

/**
 * TradeTable
 *
 * Displays trade records with:
 *  - Client-side search/filter by trade ID, client name, or symbol
 *  - Column sorting (asc/desc)
 *  - Green row highlight animation for newly arrived trades (after SSE event)
 *  - Skeleton loader while initial fetch is in progress
 *  - Pagination info
 *
 * @param {{
 *   trades:      Array<object>,
 *   newTradeIds: Set<string>,
 *   loading:     boolean,
 *   pagination:  { total: number, page: number, limit: number, pages: number },
 * }} props
 */
const TradeTable = ({ trades, newTradeIds, loading, pagination }) => {
  const [search,  setSearch]  = useState('');
  const [sortBy,  setSortBy]  = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');

  // ── Filter ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return trades;
    return trades.filter(
      (t) =>
        t.tradeId.toLowerCase().includes(q)    ||
        t.clientName.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q),
    );
  }, [trades, search]);

  // ── Sort ────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let aVal = a[sortBy] ?? '';
      let bVal = b[sortBy] ?? '';

      if (sortBy === 'quantity' || sortBy === 'price') {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      } else if (sortBy === 'timestamp') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 :  1;
      if (aVal > bVal) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortBy === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col.key);
      setSortDir('desc');
    }
  };

  // ─── Skeleton rows ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="h-9 w-64 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }).map((_, i) => (
                <tr key={i}>
                  {COLUMNS.map((c) => (
                    <td key={c.key}>
                      <div
                        className="h-4 bg-slate-100 rounded animate-pulse"
                        style={{ width: `${50 + Math.random() * 50}%`, animationDelay: `${i * 40}ms` }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            id="trade-search-input"
            type="text"
            placeholder="Search by ID, client, symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>

        {/* Record count */}
        <div className="flex items-center gap-3 text-sm text-slate-500 flex-shrink-0">
          {newTradeIds.size > 0 && (
            <span className="badge badge-indigo animate-fade-in">
              <Sparkles className="w-3 h-3" />
              {newTradeIds.size} new
            </span>
          )}
          <span>
            Showing <strong className="text-slate-700">{sorted.length.toLocaleString('en-IN')}</strong>
            {' '}of <strong className="text-slate-700">{pagination.total.toLocaleString('en-IN')}</strong> trades
          </span>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="data-table" id="trades-data-table">
          <thead className="sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col)}
                  className={col.sortable ? 'cursor-pointer select-none group' : ''}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable && (
                      <SortIcon column={col.key} sortBy={sortBy} sortDir={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center py-16 text-slate-400">
                  {search ? 'No trades match your search.' : 'No trades yet. Trigger a BSE pull to get started.'}
                </td>
              </tr>
            ) : (
              sorted.map((trade) => {
                const isNew = newTradeIds.has(trade.tradeId);
                const value = (trade.quantity * trade.price).toFixed(2);

                return (
                  <tr
                    key={trade.tradeId}
                    className={isNew ? 'row-new' : ''}
                  >
                    <td>
                      <span className="font-mono text-xs text-indigo-600 font-medium">
                        {trade.tradeId}
                      </span>
                    </td>
                    <td className="font-medium text-slate-800">{trade.clientName}</td>
                    <td>
                      <span className="badge badge-indigo font-mono">
                        {trade.symbol}
                      </span>
                    </td>
                    <td className="text-right font-mono text-slate-700">
                      {formatQuantity(trade.quantity)}
                    </td>
                    <td className="text-right font-mono text-slate-700">
                      {formatPrice(trade.price)}
                    </td>
                    <td className="text-right font-mono text-emerald-700 font-medium">
                      {formatPrice(parseFloat(value))}
                    </td>
                    <td className="text-xs text-slate-500">
                      {formatDateTime(trade.timestamp)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradeTable;
