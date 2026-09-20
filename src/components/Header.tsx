import React from 'react';
import {
  ShieldCheck,
  Radio,
  Share2,
  Settings,
  Activity,
  LogOut,
  Wifi,
  WifiOff,
  Sparkles,
  History,
  Laptop,
  Smartphone,
} from 'lucide-react';
import { ConnectionState, WebRTCStats, DeviceInfo } from '../types';
import { formatSpeed } from '../utils/formatters';

interface HeaderProps {
  roomCode: string;
  connectionState: ConnectionState;
  stats: WebRTCStats;
  peerDevice?: DeviceInfo;
  onOpenInvite: () => void;
  onOpenSettings: () => void;
  onOpenDiagnostics: () => void;
  onOpenHistory: () => void;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomCode,
  connectionState,
  stats,
  peerDevice,
  onOpenInvite,
  onOpenSettings,
  onOpenDiagnostics,
  onOpenHistory,
  onDisconnect,
}) => {
  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        const liveSpeed = stats.telemetry?.currentSpeed || 0;
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs font-medium shadow-sm shadow-emerald-900/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">Connected</span>
            {peerDevice?.name ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-200 border-l border-emerald-800/80 pl-2">
                {peerDevice.type === 'mobile' ? (
                  <Smartphone className="w-3 h-3 text-cyan-300" />
                ) : (
                  <Laptop className="w-3 h-3 text-cyan-300" />
                )}
                <span>{peerDevice.name}</span>
              </span>
            ) : (
              <span>P2P Direct</span>
            )}
            {liveSpeed > 0 && (
              <span className="font-mono text-cyan-300 font-bold border-l border-emerald-800/80 pl-2">
                {formatSpeed(liveSpeed)}
              </span>
            )}
            {stats.currentRttMs !== undefined && (
              <span className="hidden md:inline text-emerald-400/80 border-l border-emerald-800 pl-2">
                {stats.currentRttMs}ms RTT
              </span>
            )}
          </div>
        );
      case 'waiting-peer':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/80 border border-amber-600/40 text-amber-300 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Waiting for 2nd Device</span>
          </div>
        );
      case 'connecting-signal':
      case 'connecting-webrtc':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-600/40 text-cyan-300 text-xs font-medium">
            <Radio className="w-3.5 h-3.5 animate-spin" />
            <span>Negotiating WebRTC Handshake</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-600/40 text-rose-300 text-xs font-medium">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Connection Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-medium">
            <Wifi className="w-3.5 h-3.5" />
            <span>Ready to Connect</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <div className="h-full w-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-neutral-100 text-base sm:text-lg">
                Direct P2P
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-neutral-800/80 text-cyan-400 border border-neutral-700/60">
                <Sparkles className="w-2.5 h-2.5" /> Zero Cloud
              </span>
            </div>
            {roomCode && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>Room:</span>
                <span className="font-mono font-medium text-cyan-300 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                  {roomCode}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {getStatusBadge()}

          {roomCode && (
            <>
              <button
                id="btn-invite-peer"
                onClick={onOpenInvite}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium transition cursor-pointer"
                title="Pair another device"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pair Device</span>
              </button>

              <button
                id="btn-diagnostics"
                onClick={onOpenDiagnostics}
                className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                title="WebRTC Connection Diagnostics"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
              </button>
            </>
          )}

          <button
            id="btn-history"
            onClick={onOpenHistory}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-cyan-300 transition cursor-pointer"
            title="Transfer History Log"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            id="btn-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
            title="Transfer Settings & Device Name"
          >
            <Settings className="w-4 h-4" />
          </button>

          {roomCode && (
            <button
              id="btn-disconnect"
              onClick={onDisconnect}
              className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 transition cursor-pointer"
              title="Leave Room"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
