import React, { useState } from 'react';
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
  Volume2,
  VolumeX,
  Copy,
  Check,
} from 'lucide-react';
import { ConnectionState, WebRTCStats, DeviceInfo } from '../types';

interface HeaderProps {
  roomCode: string;
  connectionState: ConnectionState;
  stats: WebRTCStats;
  peerDevice?: DeviceInfo;
  enableSoundAlerts?: boolean;
  onToggleSound?: () => void;
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
  enableSoundAlerts = true,
  onToggleSound,
  onOpenInvite,
  onOpenSettings,
  onOpenDiagnostics,
  onOpenHistory,
  onDisconnect,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyRoom = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore
    }
  };

  const getStatusBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-600/50 text-emerald-300 text-xs font-medium shadow-sm shadow-emerald-900/40 whitespace-nowrap">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">P2P:</span>
            {peerDevice?.name ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-200 truncate max-w-[130px] sm:max-w-[180px]">
                {peerDevice.type === 'mobile' ? (
                  <Smartphone className="w-3 h-3 text-cyan-300 shrink-0" />
                ) : (
                  <Laptop className="w-3 h-3 text-cyan-300 shrink-0" />
                )}
                <span className="truncate">{peerDevice.name}</span>
              </span>
            ) : (
              <span className="font-semibold text-emerald-200">Direct Stream</span>
            )}
            {stats.currentRttMs !== undefined && (
              <span className="hidden md:inline text-emerald-400/80 border-l border-emerald-800/80 pl-2 font-mono tabular-nums text-[11px]">
                {stats.currentRttMs}ms
              </span>
            )}
          </div>
        );
      case 'waiting-peer':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/80 border border-amber-600/40 text-amber-300 text-xs font-medium whitespace-nowrap">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
            <span className="hidden sm:inline">Waiting for Peer</span>
            <span className="sm:hidden">Waiting...</span>
          </div>
        );
      case 'connecting-signal':
      case 'connecting-webrtc':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-600/40 text-cyan-300 text-xs font-medium whitespace-nowrap">
            <Radio className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span className="hidden sm:inline">Connecting WebRTC...</span>
            <span className="sm:hidden">Connecting...</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-950/80 border border-rose-600/40 text-rose-300 text-xs font-medium whitespace-nowrap">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Connection Failed</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-medium whitespace-nowrap">
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <span>Ready</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-neutral-800/80 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand & Room Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <div className="h-full w-full bg-neutral-950 rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-neutral-100 text-base sm:text-lg whitespace-nowrap">
                Direct P2P
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-neutral-800/80 text-cyan-400 border border-neutral-700/60 whitespace-nowrap">
                <Sparkles className="w-2.5 h-2.5" /> Zero Cloud
              </span>
            </div>
            {roomCode && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>Room:</span>
                <button
                  type="button"
                  onClick={handleCopyRoom}
                  className="font-mono font-bold text-cyan-300 bg-neutral-900 hover:bg-neutral-850 px-2 py-0.5 rounded border border-neutral-800 flex items-center gap-1 transition cursor-pointer"
                  title="Click to copy room code"
                >
                  <span>{roomCode}</span>
                  {copiedCode ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-neutral-500 hover:text-cyan-300" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge (in center-right slot) */}
        <div className="hidden sm:flex items-center min-w-0">
          {getStatusBadge()}
        </div>

        {/* Controls - Fixed Width & Shrink-0 to completely eliminate layout shifts */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile status badge fallback */}
          <div className="sm:hidden">
            {getStatusBadge()}
          </div>

          {roomCode && (
            <>
              <button
                id="btn-invite-peer"
                onClick={onOpenInvite}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-medium transition cursor-pointer shrink-0"
                title="Pair another device"
              >
                <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Pair Device</span>
              </button>

              <button
                id="btn-diagnostics"
                onClick={onOpenDiagnostics}
                className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-emerald-300 transition cursor-pointer shrink-0"
                title="WebRTC Connection Diagnostics & Latency"
              >
                <Activity className="w-4 h-4 text-emerald-400" />
              </button>
            </>
          )}

          {/* Quick Sound/Mute Toggle Action */}
          {onToggleSound && (
            <button
              id="btn-toggle-sound"
              onClick={onToggleSound}
              className={`p-2 rounded-lg border transition cursor-pointer shrink-0 ${
                enableSoundAlerts
                  ? 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-cyan-400'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-600'
              }`}
              title={enableSoundAlerts ? 'Sound alerts: ON (Click to mute)' : 'Sound alerts: MUTED (Click to unmute)'}
            >
              {enableSoundAlerts ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
          )}

          <button
            id="btn-history"
            onClick={onOpenHistory}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-cyan-300 transition cursor-pointer shrink-0"
            title="Transfer History Log"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            id="btn-settings"
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition cursor-pointer shrink-0"
            title="Transfer Settings & Network Modes"
          >
            <Settings className="w-4 h-4" />
          </button>

          {roomCode && (
            <button
              id="btn-disconnect"
              onClick={onDisconnect}
              className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 transition cursor-pointer shrink-0"
              title="Leave Room & Disconnect"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
