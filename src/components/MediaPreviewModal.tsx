import React, { useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Music,
  Video,
  Image as ImageIcon,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';
import { getFileTypeLabel } from '../utils/mime';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  size: number;
  type: string;
  blobUrl?: string;
  checksum?: string;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  onClose,
  name,
  size,
  type,
  blobUrl,
  checksum,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !blobUrl) return null;

  const isImage = type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico)$/i.test(name);
  const isVideo = type.startsWith('video/') || /\.(mp4|webm|mov|mkv|ogg)$/i.test(name);
  const isAudio = type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(name);
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name);
  const isText =
    type.startsWith('text/') ||
    type.includes('json') ||
    type.includes('javascript') ||
    /\.(txt|md|csv|json|js|ts|tsx|jsx|html|css|py|rs|go|sh)$/i.test(name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-950/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 shrink-0">
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isVideo && <Video className="w-5 h-5" />}
              {isAudio && <Music className="w-5 h-5" />}
              {isPdf && <FileText className="w-5 h-5" />}
              {isText && <FileCode className="w-5 h-5" />}
              {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-neutral-100 truncate">{name}</h3>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                <span>{formatBytes(size)}</span>
                <span className="text-[11px] font-medium text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                  {getFileTypeLabel(name, type)}
                </span>
                {checksum && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> CRC: {checksum}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={blobUrl}
              download={name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold transition cursor-pointer"
              title="Download file to device"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>
            <a
              href={blobUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 transition cursor-pointer"
              title="Open in new window"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-100 transition cursor-pointer"
              title="Close preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-neutral-950/40 min-h-[300px]">
          {isImage && (
            <img
              src={blobUrl}
              alt={name}
              className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-lg border border-neutral-800/80 select-none"
            />
          )}

          {isVideo && (
            <video
              src={blobUrl}
              controls
              autoPlay
              playsInline
              className="max-h-[70vh] w-full max-w-3xl rounded-xl shadow-lg border border-neutral-800/80 bg-black"
            />
          )}

          {isAudio && (
            <div className="w-full max-w-md p-8 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col items-center gap-6 shadow-xl">
              <div className="w-20 h-20 rounded-full bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 shadow-inner">
                <Music className="w-10 h-10 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-neutral-200 text-sm">{name}</p>
                <p className="text-xs text-neutral-400 mt-1">{formatBytes(size)}</p>
              </div>
              <audio src={blobUrl} controls autoPlay className="w-full" />
            </div>
          )}

          {isPdf && (
            <iframe
              src={blobUrl}
              title={name}
              className="w-full h-[68vh] rounded-xl border border-neutral-800 bg-neutral-900"
            />
          )}

          {isText && (
            <iframe
              src={blobUrl}
              title={name}
              className="w-full h-[68vh] rounded-xl border border-neutral-800 bg-neutral-950 font-mono text-xs text-neutral-300 p-2"
            />
          )}

          {!isImage && !isVideo && !isAudio && !isPdf && !isText && (
            <div className="text-center py-12 px-4 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-neutral-200">Binary Container File</h4>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                This file format is designed to be opened with its native operating system application
                or utility. Click download to save and run it directly.
              </p>
              <div className="mt-6 flex justify-center">
                <a
                  href={blobUrl}
                  download={name}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-sm transition shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {formatBytes(size)}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
