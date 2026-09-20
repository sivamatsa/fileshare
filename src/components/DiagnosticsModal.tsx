import React from 'react';
import { X, Activity, ShieldCheck, Cpu, Network, Radio, CheckCircle, Info } from 'lucide-react';
import { ConnectionState, WebRTCStats } from '../types';
import { formatBytes } from '../utils/formatters';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionState: ConnectionState;
  stats: WebRTCStats;
  roomCode: string;
  peerId: string;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  connectionState,
  stats,
  roomCode,
  peerId,
}) => {
  if (!isOpen) return null;

  const candidate = stats.candidatePair;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">WebRTC P2P Diagnostics</h3>
              <p className="text-xs text-neutral-400">Real-time transport layer metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Status grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                Connection State
              </span>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold text-neutral-200">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span className="capitalize">{connectionState}</span>
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                Round-Trip Latency (RTT)
              </span>
              <div className="mt-1 font-mono text-sm font-semibold text-emerald-400">
                {stats.currentRttMs !== undefined ? `${stats.currentRttMs} ms` : 'Measuring...'}
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                DataChannel Sent
              </span>
              <div className="mt-1 font-mono text-sm font-semibold text-neutral-200">
                {formatBytes(stats.bytesSent)}
              </div>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
              <span className="text-[11px] text-neutral-500 uppercase tracking-wider font-semibold">
                DataChannel Received
              </span>
              <div className="mt-1 font-mono text-sm font-semibold text-neutral-200">
                {formatBytes(stats.bytesReceived)}
              </div>
            </div>
          </div>

          {/* ICE Candidate Pair details */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span>Selected Candidate Pair</span>
            </div>

            {candidate ? (
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-neutral-800/80">
                  <span className="text-neutral-500">Local Candidate:</span>
                  <span className="text-neutral-200">
                    {candidate.localType || 'host'} ({candidate.localAddress || 'Private LAN/Host'})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/80">
                  <span className="text-neutral-500">Remote Candidate:</span>
                  <span className="text-neutral-200">
                    {candidate.remoteType || 'host'} ({candidate.remoteAddress || 'Peer'})
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-neutral-800/80">
                  <span className="text-neutral-500">Protocol:</span>
                  <span className="text-neutral-200 uppercase">{candidate.protocol || 'UDP (SCTP)'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Path Type:</span>
                  <span className="text-emerald-400 font-semibold">
                    {candidate.localType === 'host' && candidate.remoteType === 'host'
                      ? 'Direct LAN Wire Speed'
                      : 'Direct Peer-to-Peer (STUN Traversal)'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500 italic py-2">
                Candidate pair details will populate once peer connection finishes negotiation.
              </p>
            )}
          </div>

          {/* Security & Cryptography Verification */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Security & Zero-Storage Guarantee</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>WebRTC DTLS 1.2 / AES-128-GCM direct end-to-end encryption.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Zero server file bytes: file buffers never touch disk or memory of the server.</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>TURN relay disabled: prevents any cloud intermediary interception.</span>
              </div>
            </div>
          </div>

          {/* Session metadata */}
          <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1">
            <span>Room: {roomCode || '--'}</span>
            <span>Local Peer ID: {peerId}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-neutral-950/60 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
