import React from 'react';
import {
  BarChart2, DollarSign, Users, Layers, TrendingUp, Clock,
} from 'lucide-react';

/**
 * Formats a large number with Indian number system commas (e.g. 1,23,45,678).
 */
const formatIndian = (num) => {
  if (num === null || num === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(Math.round(num));
};

/**
 * Formats a currency value in INR crores if ≥ 1 Cr, else in lakhs.
 */
const formatVolume = (num) => {
  if (!num) return '₹0';
  if (num >= 1e7) return `₹${(num / 1e7).toFixed(2)} Cr`;
  if (num >= 1e5) return `₹${(num / 1e5).toFixed(2)} L`;
  return `₹${formatIndian(num)}`;
};

/**
 * Formats a date-time string into a human-readable relative time.
 */
const formatRelativeTime = (isoString) => {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─── Individual Metric Card ───────────────────────────────────────────────────

const MetricCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, loading }) => (
  <div className="metric-card animate-fade-in">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        {loading ? (
          <div className="mt-2 h-7 w-28 bg-slate-100 rounded animate-pulse" />
        ) : (
          <p className="mt-1 text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
        )}
        {sub && !loading && (
          <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
        )}
      </div>
      <div className={`metric-icon ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} strokeWidth={2} />
      </div>
    </div>
  </div>
);

// ─── MetricsCards Container ───────────────────────────────────────────────────

/**
 * MetricsCards
 *
 * Renders 5 summary metric cards pulled from the /api/trades/metrics endpoint.
 *
 * @param {{ metrics: object|null, loading: boolean }} props
 */
const MetricsCards = ({ metrics, loading }) => {
  const cards = [
    {
      icon:       BarChart2,
      label:      'Total Trades',
      value:      loading ? '—' : formatIndian(metrics?.totalTrades ?? 0),
      sub:        metrics?.totalTrades ? `${metrics.totalTrades.toLocaleString('en-IN')} records in DB` : null,
      iconBg:     'bg-indigo-50',
      iconColor:  'text-indigo-600',
    },
    {
      icon:       DollarSign,
      label:      'Total Volume',
      value:      loading ? '—' : formatVolume(metrics?.totalVolume ?? 0),
      sub:        'Qty × Price across all trades',
      iconBg:     'bg-emerald-50',
      iconColor:  'text-emerald-600',
    },
    {
      icon:       TrendingUp,
      label:      'Avg. Price',
      value:      loading ? '—' : `₹${formatIndian(metrics?.avgPrice ?? 0)}`,
      sub:        'Weighted average trade price',
      iconBg:     'bg-amber-50',
      iconColor:  'text-amber-600',
    },
    {
      icon:       Layers,
      label:      'Symbols',
      value:      loading ? '—' : formatIndian(metrics?.uniqueSymbols ?? 0),
      sub:        `of ${metrics?.uniqueClients ?? 0} unique clients`,
      iconBg:     'bg-blue-50',
      iconColor:  'text-blue-600',
    },
    {
      icon:       Clock,
      label:      'Last Trade',
      value:      loading ? '—' : formatRelativeTime(metrics?.lastTradeAt),
      sub:        metrics?.lastTradeAt
        ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
            .format(new Date(metrics.lastTradeAt))
        : 'No trades yet',
      iconBg:     'bg-slate-100',
      iconColor:  'text-slate-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <MetricCard key={card.label} {...card} loading={loading} />
      ))}
    </div>
  );
};

export default MetricsCards;
