import React from 'react';
import { RefreshCw, CheckCircle2, XCircle, Loader2, PlayCircle, AlertTriangle } from 'lucide-react';

/**
 * StatusBanner
 *
 * Shows a contextual banner below the header indicating the current pull state.
 * Transitions smoothly between: idle → running → completed / failed.
 *
 * @param {{
 *   pullStatus:       'idle'|'running'|'completed'|'failed',
 *   isTriggeringPull: boolean,
 *   onTriggerPull:    () => void,
 *   error:            string|null,
 *   lastSyncedAt:     string|null,
 *   bsePullDelayMs:   number,
 * }} props
 */
const StatusBanner = ({
  pullStatus,
  isTriggeringPull,
  onTriggerPull,
  error,
  lastSyncedAt,
  bsePullDelayMs = 15000,
}) => {
  const isRunning = pullStatus === 'running';
  const isIdle = pullStatus === 'idle' || pullStatus === 'completed';
  const isFailed = pullStatus === 'failed';

  const delayLabel =
    bsePullDelayMs >= 60000
      ? `${Math.round(bsePullDelayMs / 60000)} min`
      : `${bsePullDelayMs / 1000}M`;

  // Format last sync time
  const syncLabel = lastSyncedAt
    ? new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(lastSyncedAt))
    : null;

  return (
    <div className="animate-slide-down">
      {/* ── Running banner ─────────────────────────────────────────── */}
      {isRunning && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-blue-800">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
              <span className="font-semibold">BSE pull in progress</span>
              <span className="text-blue-600 hidden sm:inline">
                — fetching up to 3000 trades from the mock BSE API (delay: {delayLabel}).
                The dashboard will update automatically when complete.
              </span>
            </div>
            <span className="badge badge-blue whitespace-nowrap">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Syncing
            </span>
          </div>
        </div>
      )}

      {/* ── Completed banner ───────────────────────────────────────── */}
      {pullStatus === 'completed' && !isRunning && (
        <div className="bg-emerald-50 border-b border-emerald-200 animate-fade-in">
          <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-semibold">BSE pull complete</span>
              {syncLabel && (
                <span className="text-emerald-600 hidden sm:inline">
                  — New trades added at {syncLabel}
                </span>
              )}
            </div>
            <button
              id="trigger-pull-btn-banner"
              onClick={onTriggerPull}
              disabled={isTriggeringPull || isRunning}
              className="btn-primary text-xs px-3 py-1.5"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Pull Again
            </button>
          </div>
        </div>
      )}

      {/* ── Failed banner ──────────────────────────────────────────── */}
      {isFailed && (
        <div className="bg-red-50 border-b border-red-200 animate-fade-in">
          <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-red-800">
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="font-semibold">Pull failed</span>
              {error && (
                <span className="text-red-600 font-mono text-xs hidden sm:inline">
                  — {error}
                </span>
              )}
            </div>
            <button
              id="retry-pull-btn"
              onClick={onTriggerPull}
              disabled={isTriggeringPull}
              className="btn-primary text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Idle info bar ──────────────────────────────────────────── */}
      {isIdle && pullStatus === 'idle' && (
        <div className="bg-slate-100 border-b border-slate-200">
          <div className="max-w-screen-xl mx-auto px-6 py-2.5 flex items-center gap-2 text-xs text-slate-500">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
            No pull has been triggered yet. Click <strong className="text-slate-700 mx-1">"Trigger BSE API Pull"</strong>
            to start background ingestion.
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBanner;
