import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  FileCheck,
  HardDrive,
  Clock,
  Zap,
  Eye,
} from 'lucide-react';
import { TransferHistoryItem } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';
import { getFileTypeLabel } from '../utils/mime';
import { getTransferHistory, clearTransferHistory } from '../utils/history';

interface TransferHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreviewItem?: (item: TransferHistoryItem) => void;
}

export const TransferHistoryModal: React.FC<TransferHistoryModalProps> = ({
  isOpen,
  onClose,
  onPreviewItem,
}) => {
  const [history, setHistory] = useState<TransferHistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all');

  useEffect(() => {
    if (isOpen) {
      setHistory(getTransferHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    if (window.confirm('Clear all transfer history records?')) {
      clearTransferHistory();
      setHistory([]);
    }
  };

  const filtered = history.filter((item) => {
    if (filter === 'sent') return item.direction === 'sent';
    if (filter === 'received') return item.direction === 'received';
    return true;
  });

  const totalBytes = history.reduce((acc, curr) => acc + curr.size, 0);
  const totalItems = history.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/70 border border-purple-800/60 text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-100">Transfer History Log</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                {totalItems} files transferred • {formatBytes(totalBytes)} total data moved
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-rose-400 text-xs font-medium transition cursor-pointer"
                title="Clear history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-neutral-800/80 bg-neutral-950/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === 'all'
                  ? 'bg-cyan-500 text-neutral-950'
                  : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All ({history.length})
            </button>
            <button
              onClick={() => setFilter('sent')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === 'sent'
                  ? 'bg-cyan-500 text-neutral-950'
                  : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sent ({history.filter((i) => i.direction === 'sent').length})
            </button>
            <button
              onClick={() => setFilter('received')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                filter === 'received'
                  ? 'bg-cyan-500 text-neutral-950'
                  : 'bg-neutral-800/80 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Received ({history.filter((i) => i.direction === 'received').length})
            </button>
          </div>
        </div>

        {/* List Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 text-xs flex flex-col items-center gap-2">
              <HardDrive className="w-8 h-8 stroke-[1.2] text-neutral-600" />
              <span>No completed transfers in history yet.</span>
            </div>
          ) : (
            filtered.map((item) => {
              const isSent = item.direction === 'sent';
              return (
                <div
                  key={item.id}
                  className="bg-neutral-950/70 border border-neutral-800/90 rounded-xl p-3.5 flex items-center justify-between gap-4 transition hover:border-neutral-700/80"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        isSent
                          ? 'bg-cyan-950/70 text-cyan-400 border border-cyan-800/50'
                          : 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/50'
                      }`}
                    >
                      {isSent ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-200 truncate">
                          {item.name}
                        </span>
                        {item.relativePath && item.relativePath !== item.name && (
                          <span className="hidden sm:inline-block text-[10px] text-neutral-500 font-mono truncate max-w-[140px]">
                            {item.relativePath}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-1">
                        <span>{formatBytes(item.size)}</span>
                        <span className="text-[11px] font-medium text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                          {getFileTypeLabel(item.name, item.type)}
                        </span>
                        {item.averageSpeed > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-cyan-300 text-[11px]">
                            <Zap className="w-3 h-3 text-cyan-400" />
                            {formatSpeed(item.averageSpeed)}
                          </span>
                        )}
                        {item.durationSeconds > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-neutral-500">
                            <Clock className="w-3 h-3" />
                            {formatTime(item.durationSeconds)}
                          </span>
                        )}
                        {item.checksum && (
                          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                            <FileCheck className="w-3 h-3" /> CRC: {item.checksum}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-neutral-500 font-mono hidden sm:inline">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {item.blobUrl && onPreviewItem && (
                      <button
                        onClick={() => onPreviewItem(item)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 transition cursor-pointer"
                        title="Preview media file"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                    {item.blobUrl && (
                      <a
                        href={item.blobUrl}
                        download={item.name}
                        className="p-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 transition cursor-pointer"
                        title="Re-download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
