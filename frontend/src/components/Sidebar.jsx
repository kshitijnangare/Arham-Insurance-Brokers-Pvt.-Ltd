import React, { useState } from 'react';
import {
  TrendingUp,
  Activity,
  LayoutDashboard,
  BarChart3,
  Database,
  History,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';

/**
 * Sidebar
 *
 * Professional vertical collapsible navigation bar fixed to the left.
 * Supports expanded and collapsed mini-icon modes with smooth animation.
 *
 * @param {{
 *   sseStatus: 'connecting' | 'connected' | 'disconnected',
 *   collapsed: boolean,
 *   setCollapsed: (val: boolean | ((prev: boolean) => boolean)) => void
 * }} props
 */
const Sidebar = ({ sseStatus, collapsed, setCollapsed }) => {
  const [activeItem, setActiveItem] = useState('trades');

  const sseLabel = {
    connecting: 'Connecting',
    connected: 'Live Stream',
    disconnected: 'Offline',
  }[sseStatus] || 'Unknown';

  const sseDotClass = {
    connecting: 'bg-amber-400',
    connected: 'bg-emerald-500',
    disconnected: 'bg-rose-500',
  }[sseStatus] || 'bg-slate-400';

  const navItems = [
    { id: 'trades', label: 'Trades Dashboard', icon: LayoutDashboard },
    { id: 'analytics', label: 'Market Analytics', icon: BarChart3 },
    { id: 'database', label: 'PostgreSQL DB', icon: Database },
    { id: 'audit', label: 'Sync History', icon: History },
  ];

  return (
    <aside
      className={`fixed top-0 left-0 bottom-0 z-40 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Section: Brand + Navigation */}
      <div className="flex flex-col">
        {/* Header / Brand */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <div className="min-w-0 animate-fade-in">
                <h1 className="text-sm font-bold text-slate-800 tracking-tight leading-none truncate">
                  BSE Trades
                </h1>
                <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                  Arham Insurance
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <div className="p-3 space-y-1">
          <div
            className={`px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider ${
              collapsed ? 'text-center' : ''
            }`}
          >
            {collapsed ? '•••' : 'Main Menu'}
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveItem(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                } ${collapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 ${
                    isActive ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: SSE Connection Status & System Badge */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {/* SSE Indicator Card */}
        <div
          className={`rounded-lg border border-slate-200/80 bg-slate-50 p-2.5 transition-all ${
            collapsed ? 'flex justify-center' : 'flex items-center gap-2.5'
          }`}
          title={`SSE Status: ${sseLabel}`}
        >
          <span
            className={`status-dot ${sseDotClass} ${
              sseStatus === 'connected' ? 'animate-pulse' : ''
            }`}
          />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  SSE Stream
                </span>
                <Activity className="w-3 h-3 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-700 capitalize truncate">
                {sseLabel}
              </p>
            </div>
          )}
        </div>

        {/* Security badge / system note */}
        {!collapsed && (
          <div className="px-2 pt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span className="truncate">PostgreSQL & BullMQ Ingestion</span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
