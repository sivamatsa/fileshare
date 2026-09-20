import React from 'react';
import { Activity, Zap, HardDrive, ArrowUpRight, ArrowDownLeft, Gauge } from 'lucide-react';
import { SpeedTelemetry } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';

interface SpeedMonitorProps {
  telemetry?: SpeedTelemetry;
  isConnected: boolean;
  chunkSize: number;
}

export const SpeedMonitor: React.FC<SpeedMonitorProps> = ({
  telemetry,
  isConnected,
  chunkSize,
}) => {
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
  const height = 64;

  const points = history.map((val, idx) => {
    const x = (idx / Math.max(1, history.length - 1)) * width;
    const y = height - (val / maxHistorySpeed) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const polylineStr = points.join(' ');
  const areaPoints = `0,${height} ${polylineStr} ${width},${height}`;

  // SCTP buffer percentage (out of 4MB high watermark)
  const bufferPercent = Math.min(100, Math.round((bufferedAmount / (4 * 1024 * 1024)) * 100));

  return (
    <div
      id="live-speed-monitor"
      className="bg-neutral-900/95 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-4 relative overflow-hidden"
    >
      {/* Subtle background glow when active */}
      {direction !== 'idle' && (
        <div
          className={`absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
            direction === 'uploading' ? 'bg-cyan-500' : 'bg-emerald-500'
          }`}
        />
      )}

      {/* Top Header: Current status & Speedometer metric */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
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

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Live Speed & Throughput
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  chunkSize >= 256 * 1024
                    ? 'bg-amber-950/70 border-amber-600/50 text-amber-300'
                    : 'bg-cyan-950/70 border-cyan-600/50 text-cyan-300'
                }`}
              >
                <Zap className="w-2.5 h-2.5" />
                {chunkSize >= 256 * 1024 ? 'Turbo 256KB' : `${chunkSize / 1024}KB Chunks`}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-mono font-extrabold text-neutral-100 tracking-tight">
                {formatSpeed(currentSpeed)}
              </span>
              {direction !== 'idle' && (
                <span className="text-xs font-semibold uppercase text-neutral-400">
                  {direction === 'uploading' ? 'Streaming to Peer' : 'Receiving from Peer'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Secondary Metrics: Average & Peak */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-1.5 text-right">
            <div className="text-[10px] text-neutral-400 font-sans uppercase font-medium">
              Average
            </div>
            <div className="text-neutral-200 font-bold">{formatSpeed(averageSpeed)}</div>
          </div>

          <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl px-3 py-1.5 text-right">
            <div className="text-[10px] text-neutral-400 font-sans uppercase font-medium">
              Session Peak
            </div>
            <div className="text-emerald-400 font-bold">{formatSpeed(peakSpeed)}</div>
          </div>
        </div>
      </div>

      {/* Real-time Sparkline Graph */}
      <div className="bg-neutral-950/90 border border-neutral-850 rounded-xl p-3 relative">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1 font-mono">
          <span className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span>Throughput Curve (Last 30s)</span>
          </span>
          <span className="text-neutral-400 font-mono">
            Scale: 0 — {formatSpeed(maxHistorySpeed)}
          </span>
        </div>

        <div className="w-full h-16 relative overflow-hidden rounded-lg bg-neutral-950">
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

        {/* Live Active File Mini-Status (if active) */}
        {telemetry?.activeFileName && direction !== 'idle' && (
          <div className="mt-2.5 pt-2.5 border-t border-neutral-850 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 truncate max-w-sm">
              <span className="font-semibold text-neutral-200 truncate">
                {telemetry.activeFileName}
              </span>
              {telemetry.activeProgress !== undefined && (
                <span className="text-cyan-400 font-mono font-bold">
                  {telemetry.activeProgress}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-400">
              {telemetry.activeEtaSeconds !== undefined && (
                <span>ETA: {formatTime(telemetry.activeEtaSeconds)}</span>
              )}
              <span>SCTP Pipe: {formatBytes(bufferedAmount)}</span>
            </div>
          </div>
        )}
      </div>

      {/* SCTP Pipeline Backpressure Indicator */}
      <div className="flex items-center justify-between gap-3 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-neutral-400" />
          <span>SCTP Buffer Flow:</span>
          <div className="w-24 sm:w-36 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                bufferPercent > 80 ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{ width: `${Math.max(2, bufferPercent)}%` }}
            />
          </div>
          <span className="font-mono text-neutral-400">{formatBytes(bufferedAmount)}</span>
        </div>

        <span className="font-medium text-neutral-400 hidden sm:inline">
          {isConnected ? 'Hardware-accelerated DTLS 1.2 Encrypted' : 'P2P Offline'}
        </span>
      </div>
    </div>
  );
};
