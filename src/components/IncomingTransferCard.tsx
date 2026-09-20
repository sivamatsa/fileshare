import React from 'react';
import {
  DownloadCloud,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Check,
  X,
  ShieldAlert,
  HardDrive,
  Eye,
  Folder,
  Trash2,
} from 'lucide-react';
import { IncomingTransfer } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';
import { getFileTypeLabel } from '../utils/mime';

interface IncomingTransfersProps {
  transfers: IncomingTransfer[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onPreview?: (transfer: IncomingTransfer) => void;
  onClearFinished?: () => void;
}

export const IncomingTransfers: React.FC<IncomingTransfersProps> = ({
  transfers,
  onAccept,
  onReject,
  onPreview,
  onClearFinished,
}) => {
  const hasFinished = transfers.some(
    (t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'error'
  );

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <DownloadCloud className="w-5 h-5 text-emerald-400" />
            <span>Received Transfers</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Files streaming into your browser via WebRTC • Direct disk/memory download
          </p>
        </div>

        {hasFinished && onClearFinished && (
          <button
            id="btn-clear-incoming"
            onClick={onClearFinished}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
            title="Clear finished downloads"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[460px] space-y-3 pr-1">
        {transfers.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-xs flex flex-col items-center gap-2">
            <DownloadCloud className="w-8 h-8 stroke-[1.2] text-neutral-600" />
            <span>No incoming files yet. When the peer sends a file, it will appear here.</span>
          </div>
        ) : (
          transfers.map((item) => {
            const isPending = item.status === 'pending-approval';
            const isTransferring = item.status === 'transferring';
            const isCompleted = item.status === 'completed';
            const isError = item.status === 'error';
            const isCancelled = item.status === 'cancelled';

            return (
              <div
                key={item.id}
                className="bg-neutral-950/70 border border-neutral-800/90 rounded-xl p-4 transition hover:border-neutral-700/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isError || isCancelled ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : isPending ? (
                        <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                      ) : (
                        <DownloadCloud className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-neutral-200 truncate" title={item.name}>
                        {item.name}
                      </div>
                      {item.relativePath && item.relativePath !== item.name && (
                        <div className="text-[11px] text-neutral-400 font-mono truncate flex items-center gap-1 mt-0.5">
                          <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="text-neutral-500">path:</span> {item.relativePath}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span>{formatBytes(item.size)}</span>
                        <span className="text-[11px] font-medium text-neutral-400 bg-neutral-900/90 px-1.5 py-0.5 rounded border border-neutral-800">
                          {getFileTypeLabel(item.name, item.type)}
                        </span>
                        {item.isDiskStreamed && (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                            <HardDrive className="w-3 h-3" /> Zero-RAM Disk Stream
                          </span>
                        )}
                        {item.checksum && (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-800/40">
                            <FileCheck className="w-3 h-3" /> CRC: {item.checksum}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions / Download & Preview */}
                  {isCompleted && item.blobUrl && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onPreview && (
                        <button
                          onClick={() => onPreview(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-cyan-300 text-xs font-semibold transition cursor-pointer"
                          title="Preview media in browser"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>
                      )}
                      <a
                        href={item.blobUrl}
                        download={item.name}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 hover:text-emerald-100 text-xs font-semibold transition cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save Again</span>
                      </a>
                    </div>
                  )}
                </div>

                {/* Handshake Approval Prompt */}
                {isPending && (
                  <div className="mt-3 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-3">
                    <div className="text-xs text-amber-300/90 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Peer requests to send this file ({formatBytes(item.size)})</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onReject(item.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                      <button
                        onClick={() => onAccept(item.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept & Stream</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Transfer Progress with tabular-nums */}
                {isTransferring && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono text-emerald-400 font-bold tabular-nums min-w-[36px]">
                        {item.progress}%
                      </span>
                      <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                        <span className="tabular-nums min-w-[65px] text-right">{formatSpeed(item.speed)}</span>
                        <span className="tabular-nums min-w-[55px] text-right">ETA: {formatTime(item.etaSeconds)}</span>
                        <span className="tabular-nums">
                          {formatBytes(item.bytesReceived)} / {formatBytes(item.size)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {(isError || isCancelled) && (
                  <div className="mt-2 text-xs text-rose-400 font-medium">
                    {item.error || 'Transfer cancelled'}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
