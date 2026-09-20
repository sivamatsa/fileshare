import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  HardDrive,
  ArrowUpRight,
  ArrowDownLeft,
  Gauge,
  ChevronDown,
  ChevronUp,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { SpeedTelemetry } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';

interface SpeedMonitorProps {
  telemetry?: SpeedTelemetry;
  isConnected: boolean;
  chunkSize: number;
  onUpdateChunkSize?: (chunkSize: number) => void;
}

export const SpeedMonitor: React.FC<SpeedMonitorProps> = ({
  telemetry,
  isConnected,
  chunkSize,
  onUpdateChunkSize,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('speed_monitor_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMinimized = () => {
    const next = !isMinimized;
    setIsMinimized(next);
    try {
      localStorage.setItem('speed_monitor_minimized', String(next));
    } catch {
      // Ignore
    }
  };

  const cycleChunkSize = () => {
    if (!onUpdateChunkSize) return;
    if (chunkSize >= 256 * 1024) {
      onUpdateChunkSize(64 * 1024);
    } else if (chunkSize >= 64 * 1024) {
      onUpdateChunkSize(16 * 1024);
    } else {
      onUpdateChunkSize(256 * 1024);
    }
  };

  const currentSpeed = telemetry?.currentSpeed || 0;
  const averageSpeed = telemetry?.averageSpeed || 0;
  const peakSpeed = telemetry?.peakSpeed || 0;
  const history = telemetry?.history && telemetry.history.length > 0 ? telemetry.history : [0];
  const direction = telemetry?.activeDirection || 'idle';
  const bufferedAmount = telemetry?.bufferedAmount || 0;

  // Max value for scaling SVG chart (minimum 5 MB/s scale so flat line isn't huge)
  const maxHistorySpeed = Math.max(peakSpeed, ...history, 5 * 1024 * 1024);

  // SVG dimensions
  const width = 360;
  const height = 56;

  const points = history.map((val, idx) => {
    const x = (idx / Math.max(1, history.length - 1)) * width;
    const y = height - (val / maxHistorySpeed) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');
  const areaPoints = `0,${height} ${polylineStr} ${width},${height}`;

  // SCTP buffer percentage (out of 4MB high watermark)
  const bufferPercent = Math.min(100, Math.round((bufferedAmount / (4 * 1024 * 1024)) * 100));

  const getChunkLabel = (size: number) => {
    if (size >= 256 * 1024) return 'Turbo 256KB';
    if (size >= 64 * 1024) return 'Fast 64KB';
    return 'Safe 16KB';
  };

  /* Compact / Minimized View */
  if (isMinimized) {
    return (
      <div
        id="live-speed-monitor-compact"
        className="bg-neutral-900/95 border border-neutral-800 rounded-xl px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-1.5 rounded-lg border flex items-center justify-center shrink-0 ${
              direction === 'uploading'
                ? 'bg-cyan-950/60 border-cyan-700/60 text-cyan-400 animate-pulse'
                : direction === 'downloading'
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400 animate-pulse'
                : 'bg-neutral-800 border-neutral-700/60 text-neutral-400'
            }`}
          >
            {direction === 'uploading' ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : direction === 'downloading' ? (
              <ArrowDownLeft className="w-3.5 h-3.5" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
          </div>

          <div className="flex items-center gap-2 font-mono whitespace-nowrap">
            <span className="text-neutral-400 font-sans hidden sm:inline">Speed:</span>
            <span className="text-sm font-bold text-neutral-100 tabular-nums min-w-[75px]">
              {formatSpeed(currentSpeed)}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 font-mono text-neutral-400 whitespace-nowrap border-l border-neutral-800 pl-3">
            <span className="font-sans text-[11px]">Peak:</span>
            <span className="text-emerald-400 font-bold tabular-nums min-w-[70px]">
              {formatSpeed(peakSpeed)}
            </span>
          </div>

          {onUpdateChunkSize && (
            <button
              onClick={cycleChunkSize}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border bg-neutral-800 hover:bg-neutral-750 border-neutral-700 text-cyan-300 transition cursor-pointer shrink-0"
              title="Click to cycle chunk transfer speed (Turbo / Fast / Safe)"
            >
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>{getChunkLabel(chunkSize)}</span>
            </button>
          )}

          {telemetry?.activeFileName && (
            <span className="text-neutral-400 truncate max-w-[150px] sm:max-w-xs text-[11px] hidden sm:inline">
              {telemetry.activeFileName}
            </span>
          )}
        </div>

        <button
          onClick={toggleMinimized}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[11px] font-medium transition cursor-pointer shrink-0"
          title="Expand Throughput Curve & Graph"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Graph</span>
        </button>
      </div>
    );
  }

  /* Full Expanded View with Constant Locked Heights */
  return (
    <div
      id="live-speed-monitor"
      className="bg-neutral-900/95 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-3.5 relative overflow-hidden"
    >
      {/* Subtle background glow when active */}
      {direction !== 'idle' && (
        <div
          className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
            direction === 'uploading' ? 'bg-cyan-500' : 'bg-emerald-500'
          }`}
        />
      )}

      {/* Top Header: Constant single-line row with no flex-wrap jumping */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center transition shrink-0 ${
              direction === 'uploading'
                ? 'bg-cyan-950/60 border-cyan-700/60 text-cyan-400 animate-pulse'
                : direction === 'downloading'
                ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400 animate-pulse'
                : 'bg-neutral-800 border-neutral-700/60 text-neutral-400'
            }`}
          >
            {direction === 'uploading' ? (
              <ArrowUpRight className="w-5 h-5" />
            ) : direction === 'downloading' ? (
              <ArrowDownLeft className="w-5 h-5" />
            ) : (
              <Activity className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 whitespace-nowrap">
                Live Throughput
              </span>
              {onUpdateChunkSize ? (
                <button
                  type="button"
                  onClick={cycleChunkSize}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border transition cursor-pointer shrink-0 ${
                    chunkSize >= 256 * 1024
                      ? 'bg-amber-950/70 border-amber-600/50 text-amber-300 hover:bg-amber-900/60'
                      : 'bg-cyan-950/70 border-cyan-600/50 text-cyan-300 hover:bg-cyan-900/60'
                  }`}
                  title="Click to cycle chunk size (Turbo 256KB / Fast 64KB / Safe 16KB)"
                >
                  <Zap className="w-2.5 h-2.5" />
                  <span>{getChunkLabel(chunkSize)}</span>
                </button>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                    chunkSize >= 256 * 1024
                      ? 'bg-amber-950/70 border-amber-600/50 text-amber-300'
                      : 'bg-cyan-950/70 border-cyan-600/50 text-cyan-300'
                  }`}
                >
                  <Zap className="w-2.5 h-2.5" />
                  <span>{getChunkLabel(chunkSize)}</span>
                </span>
              )}
            </div>

            {/* Stable numerical width & fixed height container */}
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-mono font-extrabold text-neutral-100 tracking-tight tabular-nums min-w-[125px] sm:min-w-[155px] inline-block whitespace-nowrap">
                {formatSpeed(currentSpeed)}
              </span>
              <div className="h-5 flex items-center whitespace-nowrap">
                {direction !== 'idle' ? (
                  <span className="text-xs font-semibold uppercase text-cyan-400">
                    {direction === 'uploading' ? 'Streaming to Peer' : 'Receiving from Peer'}
                  </span>
                ) : (
                  <span className="text-xs text-neutral-500 font-medium">Channel Ready</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Metrics & Collapse Button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5 text-xs font-mono">
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-1.5 text-right w-24">
              <div className="text-[10px] text-neutral-400 font-sans uppercase font-medium">
                Average
              </div>
              <div className="text-neutral-200 font-bold tabular-nums">
                {formatSpeed(averageSpeed)}
              </div>
            </div>

            <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-1.5 text-right w-24">
              <div className="text-[10px] text-neutral-400 font-sans uppercase font-medium">
                Session Peak
              </div>
              <div className="text-emerald-400 font-bold tabular-nums">
                {formatSpeed(peakSpeed)}
              </div>
            </div>
          </div>

          <button
            onClick={toggleMinimized}
            className="p-2 rounded-xl bg-neutral-950/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
            title="Minimize Speed Monitor to Compact Bar"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Real-time Sparkline Graph */}
      <div className="bg-neutral-950/90 border border-neutral-850 rounded-xl p-3 relative">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1 font-mono">
          <span className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Throughput Curve (Last 30s)</span>
          </span>
          <span className="text-neutral-400 font-mono tabular-nums">
            Scale: 0 — {formatSpeed(maxHistorySpeed)}
          </span>
        </div>

        <div className="w-full h-14 relative overflow-hidden rounded-lg bg-neutral-950">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            <defs>
              <linearGradient id="speedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={direction === 'downloading' ? '#10b981' : '#06b6d4'}
                  stopOpacity="0.4"
                />
                <stop
                  offset="100%"
                  stopColor={direction === 'downloading' ? '#10b981' : '#06b6d4'}
                  stopOpacity="0.0"
                />
              </linearGradient>
            </defs>

            {/* Grid guides */}
            <line
              x1="0"
              y1={height / 2}
              x2={width}
              y2={height / 2}
              stroke="#262626"
              strokeDasharray="4 4"
            />

            {/* Filled Area */}
            <polygon points={areaPoints} fill="url(#speedGradient)" />

            {/* Sparkline Stroke */}
            <polyline
              points={polylineStr}
              fill="none"
              stroke={direction === 'downloading' ? '#34d399' : '#22d3ee'}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Stable Active File Mini-Status row (constant reserved height to avoid layout shift) */}
        <div className="mt-2 pt-2 border-t border-neutral-850/80 flex items-center justify-between gap-2 text-xs min-h-[22px]">
          {telemetry?.activeFileName && direction !== 'idle' ? (
            <>
              <div className="flex items-center gap-2 truncate max-w-sm">
                <span className="font-semibold text-neutral-200 truncate">
                  {telemetry.activeFileName}
                </span>
                {telemetry.activeProgress !== undefined && (
                  <span className="text-cyan-400 font-mono font-bold tabular-nums">
                    {telemetry.activeProgress}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                {telemetry.activeEtaSeconds !== undefined && (
                  <span className="tabular-nums">ETA: {formatTime(telemetry.activeEtaSeconds)}</span>
                )}
                <span className="tabular-nums">Pipe: {formatBytes(bufferedAmount)}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full text-[11px] text-neutral-500 font-mono">
              <span>Ready for high-speed P2P transmission</span>
              <span className="hidden sm:inline">Buffer Ready: 0 B</span>
            </div>
          )}
        </div>
      </div>

      {/* SCTP Pipeline Backpressure Indicator */}
      <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span className="whitespace-nowrap">SCTP Buffer Flow:</span>
          <div className="w-24 sm:w-36 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                bufferPercent > 80 ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.max(2, bufferPercent)}%` }}
            />
          </div>
          <span className="font-mono text-neutral-400 tabular-nums min-w-[50px]">
            {formatBytes(bufferedAmount)}
          </span>
        </div>

        <span className="font-medium text-neutral-400 hidden sm:inline whitespace-nowrap">
          {isConnected ? 'Hardware-accelerated DTLS 1.2 Encrypted' : 'P2P Offline'}
        </span>
      </div>
    </div>
  );
};
