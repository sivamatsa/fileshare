import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  File as FileIcon,
  Play,
  Pause,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  FileCheck,
  HardDrive,
  Send,
  FolderUp,
  FileUp,
  Folder,
} from 'lucide-react';
import { FileQueueItem } from '../types';
import { formatBytes, formatSpeed, formatTime } from '../utils/formatters';
import { getFileTypeLabel } from '../utils/mime';
import { scanDroppedItems } from '../utils/folderScanner';

interface FileSenderProps {
  queue: FileQueueItem[];
  isPeerConnected: boolean;
  onAddFiles: (files: Array<{ file: File; relativePath?: string }> | FileList | File[]) => void;
  onSendItem: (id: string) => void;
  onSendAll: () => void;
  onPauseItem: (id: string) => void;
  onResumeItem: (id: string) => void;
  onCancelItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearQueue: () => void;
}

export const FileSender: React.FC<FileSenderProps> = ({
  queue,
  isPeerConnected,
  onAddFiles,
  onSendItem,
  onSendAll,
  onPauseItem,
  onResumeItem,
  onCancelItem,
  onRemoveItem,
  onClearQueue,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const scanned = await scanDroppedItems(e.dataTransfer.items);
      if (scanned.length > 0) {
        onAddFiles(scanned);
      }
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files: Array<{ file: File; relativePath?: string }> = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const relativePath = (file as any).webkitRelativePath || file.name;
        files.push({ file, relativePath });
      }
      onAddFiles(files);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const queuedCount = queue.filter((i) => i.status === 'queued').length;
  const activeItem = queue.find((i) => i.status === 'transferring' || i.status === 'paused');

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-cyan-400" />
            <span>Send Files to Peer</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Streaming directly to peer device • No file size limit
          </p>
        </div>

        {queue.length > 0 && (
          <div className="flex items-center gap-2">
            {queuedCount > 0 && isPeerConnected && !activeItem && (
              <button
                id="btn-send-all"
                onClick={onSendAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send All ({queuedCount})</span>
              </button>
            )}
            <button
              id="btn-clear-queue"
              onClick={onClearQueue}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition cursor-pointer"
              title="Clear finished items"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <div
        id="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-5 sm:p-7 text-center transition-all duration-200 flex flex-col items-center justify-center ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/30'
            : 'border-neutral-700/80 bg-neutral-950/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          id="file-input"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: '', directory: '' } as any)}
          onChange={handleFolderChange}
          className="hidden"
          id="folder-input"
        />

        <div className="p-3 rounded-full bg-neutral-900 border border-neutral-800 text-cyan-400 mb-3 shadow-inner">
          <UploadCloud className="w-6 h-6" />
        </div>

        <p className="text-sm font-semibold text-neutral-200">
          Drag & drop files or entire folders here
        </p>
        <p className="text-xs text-neutral-500 mt-1 mb-4">
          All formats supported • Preserves folder hierarchies • Zero cloud storage
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            id="btn-browse-files"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Browse Files</span>
          </button>
          <button
            type="button"
            id="btn-upload-folder"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-semibold transition cursor-pointer"
          >
            <FolderUp className="w-4 h-4 text-amber-400" />
            <span>Upload Folder</span>
          </button>
        </div>
      </div>

      {/* File Queue List */}
      <div className="mt-5 flex-1 overflow-y-auto max-h-[380px] space-y-3 pr-1">
        {queue.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-xs flex flex-col items-center gap-2">
            <HardDrive className="w-8 h-8 stroke-[1.2] text-neutral-600" />
            <span>No files queued. Add files or folders above to begin sending.</span>
          </div>
        ) : (
          queue.map((item) => {
            const isTransferring = item.status === 'transferring';
            const isPaused = item.status === 'paused';
            const isCompleted = item.status === 'completed';
            const isError = item.status === 'error';
            const isRequesting = item.status === 'requesting';

            return (
              <div
                key={item.id}
                className="bg-neutral-950/70 border border-neutral-800/90 rounded-xl p-3.5 transition hover:border-neutral-700/80"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isError ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : item.relativePath && item.relativePath !== item.name ? (
                        <Folder className="w-4 h-4 text-amber-400" />
                      ) : (
                        <FileIcon className="w-4 h-4 text-cyan-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-neutral-200 truncate" title={item.name}>
                        {item.name}
                      </div>
                      {item.relativePath && item.relativePath !== item.name && (
                        <div className="text-[11px] text-neutral-400 font-mono truncate flex items-center gap-1 mt-0.5">
                          <span className="text-neutral-500">path:</span> {item.relativePath}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-0.5">
                        <span>{formatBytes(item.size)}</span>
                        <span className="text-[11px] font-medium text-neutral-400 bg-neutral-900/90 px-1.5 py-0.5 rounded border border-neutral-800">
                          {getFileTypeLabel(item.name, item.type)}
                        </span>
                        {item.checksum && (
                          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-800/40">
                            <FileCheck className="w-3 h-3" /> CRC: {item.checksum}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === 'queued' && (
                      <button
                        onClick={() => onSendItem(item.id)}
                        disabled={!isPeerConnected || !!activeItem}
                        className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 hover:text-cyan-100 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title={isPeerConnected ? 'Send now' : 'Peer not connected'}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isTransferring && (
                      <button
                        onClick={() => onPauseItem(item.id)}
                        className="p-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-800/60 text-amber-300 transition cursor-pointer"
                        title="Pause transfer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isPaused && (
                      <button
                        onClick={() => onResumeItem(item.id)}
                        className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 transition cursor-pointer"
                        title="Resume transfer"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(isTransferring || isPaused || isRequesting) && (
                      <button
                        onClick={() => onCancelItem(item.id)}
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 transition cursor-pointer"
                        title="Cancel transfer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isTransferring && !isPaused && !isRequesting && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
                        title="Remove from queue"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Status or Progress */}
                {isRequesting && (
                  <div className="mt-2 text-xs text-cyan-400 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Awaiting peer approval...</span>
                  </div>
                )}

                {isError && (
                  <div className="mt-2 text-xs text-rose-400 font-medium">
                    {item.error || 'Transfer failed'}
                  </div>
                )}

                {(isTransferring || isPaused) && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-mono text-cyan-300 font-medium">
                        {item.progress}%
                      </span>
                      <div className="flex items-center gap-3 text-neutral-400 font-mono text-[11px]">
                        <span>{formatSpeed(item.speed)}</span>
                        <span>ETA: {formatTime(item.etaSeconds)}</span>
                        <span>
                          {formatBytes(item.bytesTransferred)} / {formatBytes(item.size)}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          isPaused ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                        }`}
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
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
