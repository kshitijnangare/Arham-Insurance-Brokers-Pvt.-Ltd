import React from 'react';
import { TrendingUp, Activity } from 'lucide-react';

/**
 * DashboardHeader
 *
 * Displays the application title, logo mark, and the live SSE connection indicator.
 * The SSE dot is green when connected, amber when connecting, red when disconnected.
 *
 * @param {{ sseStatus: 'connecting'|'connected'|'disconnected' }} props
 */
const DashboardHeader = ({ sseStatus }) => {
  const sseLabel = {
    connecting:   'Connecting…',
    connected:    'Live',
    disconnected: 'Disconnected',
  }[sseStatus] || 'Unknown';

  const sseDotClass = {
    connecting:   'bg-amber-400',
    connected:    'bg-emerald-500',
    disconnected: 'bg-red-500',
  }[sseStatus] || 'bg-slate-400';

  const sseBadgeClass = {
    connecting:   'badge-yellow',
    connected:    'badge-green',
    disconnected: 'badge-red',
  }[sseStatus] || 'badge-slate';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-slate-800 tracking-tight leading-none">
              BSE Trades Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time ingestion monitoring
            </p>
          </div>
        </div>

        {/* Right side: SSE status */}
        <div className="flex items-center gap-3">
          <div className={`badge ${sseBadgeClass} gap-1.5`}>
            <span className={`status-dot ${sseDotClass} ${sseStatus === 'connected' ? 'animate-pulse' : ''}`} />
            <Activity className="w-3 h-3" />
            <span>SSE {sseLabel}</span>
          </div>
        </div>

      </div>
    </header>
  );
};

export default DashboardHeader;
